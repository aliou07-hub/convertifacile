import { FFmpeg } from '../../../vendor/ffmpeg/index.js';
import { toBlobURL, fetchFile } from '../../../vendor/util/index.js';

const CORE_JS_URL = new URL('../../../vendor/core/ffmpeg-core.js', import.meta.url).href;
const CORE_WASM_URL = new URL('../../../vendor/core/ffmpeg-core.wasm', import.meta.url).href;

class EngineError extends Error {
  constructor(message, { logs = [] } = {}) {
    super(message);
    this.name = 'EngineError';
    this.logs = logs;
  }
}

class FfmpegEngine {
  #ffmpeg = null;
  #loaded = false;
  #loadingPromise = null;
  #activeRun = null;
  #mounted = false;
  #cancelled = false;
  // One worker can only run one command: jobs from every tool page go through this queue.
  #queue = Promise.resolve();
  #currentOwner = null;
  #waitingJobs = new Set();

  get isLoaded() {
    return this.#loaded;
  }

  #exclusive(owner, fn) {
    const job = { owner, cancelled: false, rejectWait: null };
    const cancelledWhileWaiting = new Promise((_, reject) => {
      job.rejectWait = reject;
    });
    this.#waitingJobs.add(job);
    const run = this.#queue.then(async () => {
      this.#waitingJobs.delete(job);
      if (job.cancelled) throw new EngineError('Annulé.');
      this.#currentOwner = owner;
      this.#cancelled = false;
      try {
        return await fn();
      } finally {
        this.#currentOwner = null;
      }
    });
    this.#queue = run.catch(() => {});
    // A queued job that gets cancelled must settle immediately, not when its turn comes.
    return Promise.race([run, cancelledWhileWaiting]);
  }

  async #ensureFfmpeg() {
    if (!this.#ffmpeg) {
      this.#ffmpeg = new FFmpeg();
      this.#ffmpeg.on('log', ({ message }) => this.#onLog(message));
    }
    return this.#ffmpeg;
  }

  #onLog(message) {
    if (!this.#activeRun) return;
    this.#activeRun.logs.push(message);
    if (this.#activeRun.logs.length > 400) this.#activeRun.logs.shift();
    if (this.#activeRun.totalDuration == null) {
      const m = /Duration:\s*(\d{2}:\d{2}:\d{2}\.\d{2})/.exec(message);
      if (m) {
        const sec = hmsToSeconds(m[1]);
        if (Number.isFinite(sec) && sec > 0) this.#activeRun.totalDuration = sec;
      }
    }
    const t = /time=\s*(\d{2}:\d{2}:\d{2}\.\d{2})/.exec(message);
    if (t && this.#activeRun.totalDuration) {
      const cur = hmsToSeconds(t[1]);
      const pct = Math.max(0, Math.min(99, (cur / this.#activeRun.totalDuration) * 100));
      this.#activeRun.onProgress && this.#activeRun.onProgress(pct);
    }
  }

  async load(onDownloadProgress) {
    if (this.#loaded) return;
    if (this.#loadingPromise) return this.#loadingPromise;
    this.#loadingPromise = (async () => {
      const ffmpeg = await this.#ensureFfmpeg();
      const coreURL = await toBlobURL(CORE_JS_URL, 'text/javascript');
      const wasmURL = await toBlobURL(CORE_WASM_URL, 'application/wasm', true, (p) => {
        if (onDownloadProgress && p.total > 0) {
          onDownloadProgress(Math.min(100, (p.received / p.total) * 100));
        }
      });
      await ffmpeg.load({ coreURL, wasmURL });
      this.#loaded = true;
    })();
    try {
      await this.#loadingPromise;
    } finally {
      this.#loadingPromise = null;
    }
  }

  /**
   * Runs an ffmpeg command against a single input File.
   * @param {Object} opts
   * @param {File} opts.file
   * @param {(ctx:{inputPath:string, outputName:string}) => {args:string[], outputName:string, fallbacks?:{args:string[], outputName:string}[]}} opts.buildArgs
   *   `fallbacks` are tried in order when the previous attempt exits with a non-zero code.
   * @param {number} [opts.knownDuration] seconds, used instead of parsed input duration (e.g. trimmed clips)
   * @param {(pct:number) => void} [opts.onProgress]
   * @param {string} [opts.owner] identifies the caller so cancel(owner) only stops its own jobs
   * @param {() => void} [opts.onStart] called once the job leaves the queue and actually starts
   */
  runCommand({ owner, onStart, ...opts }) {
    return this.#exclusive(owner, () => {
      onStart && onStart();
      return this.#runCommandNow(opts);
    });
  }

  async #runCommandNow({ file, buildArgs, knownDuration, onProgress }) {
    await this.load();
    const ffmpeg = this.#ffmpeg;
    const inputPath = await this.#mountInput(file);
    const outputNameGuess = 'output';
    this.#activeRun = {
      totalDuration: Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : null,
      onProgress,
      logs: [],
    };
    let attempts = [];
    let crashed = false;
    try {
      const built = buildArgs({ inputPath, outputName: outputNameGuess });
      attempts = [{ args: built.args, outputName: built.outputName }, ...(built.fallbacks || [])];
      let code = -1;
      let effectiveOutputName = null;
      for (const attempt of attempts) {
        this.#activeRun.logs = [];
        try {
          code = await ffmpeg.exec(attempt.args);
        } catch (e) {
          if (this.#cancelled) throw new EngineError('Annulé.', { logs: this.#activeRun.logs });
          // A thrown exec means the WebAssembly instance aborted; it is unusable afterwards.
          crashed = true;
          throw new EngineError(describeFailure([...this.#activeRun.logs, String(e)]), { logs: this.#activeRun.logs });
        }
        if (this.#cancelled) throw new EngineError('Annulé.', { logs: this.#activeRun.logs });
        effectiveOutputName = attempt.outputName;
        if (code === 0) break;
      }
      if (code !== 0) {
        throw new EngineError(describeFailure(this.#activeRun.logs), { logs: this.#activeRun.logs });
      }
      let data;
      try {
        data = await ffmpeg.readFile(effectiveOutputName);
      } catch {
        throw new EngineError(describeFailure(this.#activeRun.logs), { logs: this.#activeRun.logs });
      }
      if (!data || data.length === 0) {
        throw new EngineError(describeFailure(this.#activeRun.logs, true), { logs: this.#activeRun.logs });
      }
      onProgress && onProgress(100);
      return { data, outputName: effectiveOutputName, logs: this.#activeRun.logs };
    } finally {
      if (crashed) {
        this.#discardInstance();
      } else {
        await this.#cleanup(inputPath, null);
        for (const name of new Set(attempts.map((a) => a.outputName))) {
          try { await ffmpeg.deleteFile(name); } catch { /* ignore: attempt never wrote it */ }
        }
      }
      this.#activeRun = null;
    }
  }

  /** Drops the current worker; the next command transparently reloads a fresh engine. */
  #discardInstance() {
    if (this.#ffmpeg) {
      try { this.#ffmpeg.terminate(); } catch { /* ignore */ }
    }
    this.#ffmpeg = null;
    this.#loaded = false;
    this.#mounted = false;
  }

  /** Probes a file's duration by letting ffmpeg print it, without producing output. */
  probeDuration(file) {
    return this.#exclusive(null, () => this.#probeDurationNow(file));
  }

  async #probeDurationNow(file) {
    await this.load();
    const ffmpeg = this.#ffmpeg;
    const inputPath = await this.#mountInput(file);
    this.#activeRun = { totalDuration: null, onProgress: null, logs: [] };
    let crashed = false;
    try {
      // Exits non-zero ("no output file specified") but prints the input's Duration first.
      await ffmpeg.exec(['-i', inputPath]);
    } catch {
      crashed = true;
    }
    const duration = this.#activeRun.totalDuration;
    this.#activeRun = null;
    if (crashed) this.#discardInstance();
    else await this.#cleanup(inputPath, null);
    return duration;
  }

  async #mountInput(file) {
    const ffmpeg = this.#ffmpeg;
    try {
      await ffmpeg.createDir('/work').catch(() => {});
      await ffmpeg.mount('WORKERFS', { files: [file] }, '/work');
      this.#mounted = true;
      return `/work/${file.name}`;
    } catch {
      this.#mounted = false;
      const data = await fetchFile(file);
      await ffmpeg.writeFile(file.name, data);
      return file.name;
    }
  }

  async #cleanup(inputPath, outputName) {
    const ffmpeg = this.#ffmpeg;
    if (!ffmpeg) return;
    try {
      if (this.#mounted) {
        await ffmpeg.unmount('/work');
        this.#mounted = false;
      } else if (inputPath) {
        await ffmpeg.deleteFile(inputPath).catch(() => {});
      }
    } catch { /* ignore */ }
    if (outputName) {
      try { await ffmpeg.deleteFile(outputName); } catch { /* ignore */ }
    }
  }

  /** Stops the owner's running job (killing the worker) and drops its jobs still in the queue. */
  cancel(owner) {
    for (const job of this.#waitingJobs) {
      if (job.owner !== owner) continue;
      job.cancelled = true;
      job.rejectWait(new EngineError('Annulé.'));
    }
    if (this.#currentOwner === owner) {
      this.#cancelled = true;
      this.#discardInstance();
    }
  }
}

function hmsToSeconds(hms) {
  const m = /(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(hms);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

function describeFailure(logs, emptyOutput = false) {
  const tail = logs.slice(-12).join(' | ');
  if (/out of memory|Aborted\(OOM\)|Cannot enlarge memory|allocation failed/i.test(tail)) {
    return "Mémoire insuffisante dans le navigateur pour ce fichier. Ferme les autres onglets et réessaie, ou utilise un ordinateur plutôt qu'un téléphone.";
  }
  if (/RuntimeError|Aborted\(/.test(tail)) {
    return "Le moteur de conversion a planté sur ce fichier avec ces réglages. Essaie un autre format de sortie ; le moteur a été redémarré automatiquement.";
  }
  if (/Invalid data found|moov atom not found|Unsupported codec/i.test(tail)) {
    return "Le fichier semble invalide ou dans un format non pris en charge par le navigateur.";
  }
  if (emptyOutput) {
    return "La conversion n'a produit aucun fichier. Vérifie le fichier source et réessaie.";
  }
  return `Le traitement a échoué. Détail : ${tail.slice(-220) || 'erreur inconnue'}`;
}

export const ffmpegEngine = new FfmpegEngine();
export { EngineError };
