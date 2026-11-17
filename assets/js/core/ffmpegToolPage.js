import { ffmpegEngine } from './ffmpeg-engine.js';
import { createZipBlob } from './zip.js';
import { formatBytes, formatGainPercent, uid } from './format.js';
import { getToolState, notifyJobs } from './jobStore.js';
import {
  el,
  renderBreadcrumb,
  renderToolHeader,
  renderOtherTools,
  createDropzone,
  showToast,
  openPreviewModal,
} from './ui.js';

const BIG_TOTAL_BYTES = 1.5 * 1024 * 1024 * 1024;

const MIME_BY_EXT = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
};

function mimeForName(name) {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function needsWork(entry, snapshot) {
  return entry.status === 'waiting' || entry.status === 'error' || (entry.status === 'done' && entry.optionsSnapshot !== snapshot);
}

/**
 * Processes the tool's pending files one after another. Independent of the page DOM:
 * it keeps going when the user navigates away, and updates the page if one is mounted.
 */
async function processAll(state) {
  const { tool } = state;
  if (state.running || state.entries.length === 0) return;
  const snapshot = JSON.stringify(state.options);
  const optionsAtStart = JSON.parse(snapshot);
  const toProcess = state.entries.filter((e) => needsWork(e, snapshot));
  if (toProcess.length === 0) return;

  state.running = true;
  state.stopRequested = false;
  state.unseenResults = false;
  state.batchTotal = toProcess.length;
  state.batchIndex = 0;
  for (const entry of toProcess) {
    entry.status = 'queued';
    entry.progress = 0;
  }
  refresh(state);

  if (!ffmpegEngine.isLoaded) {
    state.engineLoadingPct = 0;
    refresh(state);
    try {
      await ffmpegEngine.load((pct) => {
        state.engineLoadingPct = pct;
        state.view?.setEngineLoading(pct);
        notifyJobs();
      });
    } catch {
      state.engineLoadingPct = null;
      state.running = false;
      for (const entry of toProcess) entry.status = 'waiting';
      showToast('Impossible de charger le moteur de conversion. Vérifie ta connexion et recharge la page.', 'error');
      refresh(state);
      return;
    }
    state.engineLoadingPct = null;
  }

  for (const entry of toProcess) {
    if (state.stopRequested) break;
    if (!state.entries.includes(entry)) continue;
    state.batchIndex += 1;
    entry.errorMsg = null;
    refresh(state);
    try {
      const { knownDuration, build } = await tool.plan(entry.file, optionsAtStart);
      const { data, outputName: internalName } = await ffmpegEngine.runCommand({
        owner: tool.id,
        file: entry.file,
        buildArgs: build,
        knownDuration,
        onStart: () => {
          entry.status = 'running';
          refresh(state);
        },
        onProgress: (pct) => {
          entry.progress = pct;
          state.view?.updateRowProgress(entry);
          notifyJobs();
        },
      });
      const actualExt = internalName.slice(internalName.lastIndexOf('.') + 1).toLowerCase();
      entry.resultName = tool.outputFileName(entry.file, optionsAtStart, actualExt);
      entry.resultBlob = new Blob([data], { type: mimeForName(entry.resultName) });
      entry.sizeAfter = entry.resultBlob.size;
      entry.optionsSnapshot = snapshot;
      entry.status = 'done';
    } catch (err) {
      if (err && err.message === 'Annulé.') {
        entry.status = 'waiting';
        entry.progress = 0;
        break;
      }
      entry.status = 'error';
      entry.errorMsg = (err && err.message) || 'Erreur inconnue.';
    }
    refresh(state);
  }

  for (const entry of state.entries) {
    if (entry.status === 'queued' || entry.status === 'running') {
      entry.status = 'waiting';
      entry.progress = 0;
    }
  }
  state.running = false;
  state.unseenResults = !state.view;
  refresh(state);
}

function refresh(state) {
  state.view?.refresh();
  notifyJobs();
}

function stopProcessing(state) {
  state.stopRequested = true;
  ffmpegEngine.cancel(state.tool.id);
  showToast('Arrêt demandé…', 'info');
  refresh(state);
}

/**
 * @param {Object} tool  registry metadata merged with the tool module's exports
 *   (defaultOptions, renderOptions, plan, outputFileName, accept, fileKind).
 */
export function createFfmpegToolPage(tool) {
  return function render(container) {
    document.title = `${tool.title} — ConvertiFacile`;
    setMetaDescription(tool.metaDescription);

    const state = getToolState(tool);
    const { entries, options } = state;

    const page = el('div', { class: 'tool-page' });
    page.append(renderBreadcrumb(tool.title));
    page.append(renderToolHeader({ icon: tool.icon, title: tool.title, description: tool.description }));

    const bigWarning = el(
      'div',
      { class: 'notice notice-warning', style: 'display:none' },
      'Attention : le total dépasse 1,5 Go. Le traitement peut être long et demander beaucoup de mémoire au navigateur.'
    );
    page.append(bigWarning);

    const engineBannerText = el('span', { class: 'engine-banner-text' }, 'Chargement du moteur de conversion (environ 31 Mo, une seule fois)…');
    const engineBanner = el('div', { class: 'engine-banner', style: 'display:none' }, [el('div', { class: 'spinner' }), engineBannerText]);
    page.append(engineBanner);

    const backgroundNote = el(
      'p',
      { class: 'background-note', style: 'display:none' },
      'Tu peux aller sur une autre page du site ou un autre onglet : la conversion continue. Ne ferme pas cet onglet.'
    );

    const dropzone = createDropzone({
      accept: tool.accept,
      multiple: true,
      hint: `Formats acceptés : ${tool.accept}`,
      onFiles: handleNewFiles,
    });

    const fileListEl = el('div', { class: 'file-list' });

    const actionsRow = el('div', { class: 'actions-row' });
    const convertBtn = el('button', { class: 'btn btn-primary', disabled: true, 'data-testid': 'convert-btn', onClick: () => processAll(state) }, 'Convertir');
    const stopBtn = el('button', { class: 'btn btn-danger', style: 'display:none', 'data-testid': 'stop-btn', onClick: () => stopProcessing(state) }, 'Arrêter');
    const zipBtn = el('button', { class: 'btn btn-secondary', style: 'display:none', 'data-testid': 'zip-btn', onClick: () => downloadZip() }, 'Tout télécharger (ZIP)');
    actionsRow.append(convertBtn, stopBtn, zipBtn, backgroundNote);

    const optionsPanel = el('div', { class: 'options-panel' }, [el('h2', {}, 'Options')]);
    const optionsBody = el('div', { class: 'options-body' });
    optionsPanel.append(optionsBody);
    tool.renderOptions(optionsBody, options, () => updateButtons());

    const mainGrid = el('div', { class: 'tool-grid' }, [el('div', { class: 'tool-main' }, [dropzone, actionsRow, fileListEl]), optionsPanel]);
    page.append(mainGrid);
    page.append(renderOtherTools(tool.id));
    container.append(page);

    function updateButtons() {
      const snapshot = JSON.stringify(options);
      const anyDone = entries.some((e) => e.status === 'done');
      const anyPendingWork = entries.some((e) => needsWork(e, snapshot));
      convertBtn.textContent = anyDone && anyPendingWork ? 'Reconvertir avec les nouveaux réglages' : 'Convertir';
      convertBtn.disabled = state.running || !anyPendingWork;
      stopBtn.style.display = state.running ? '' : 'none';
      backgroundNote.style.display = state.running ? '' : 'none';
      zipBtn.style.display = entries.filter((e) => e.status === 'done').length >= 2 ? '' : 'none';
      const total = entries.reduce((sum, e) => sum + e.file.size, 0);
      bigWarning.style.display = total > BIG_TOTAL_BYTES ? '' : 'none';
    }

    function setEngineLoading(pct) {
      engineBanner.style.display = pct == null ? 'none' : '';
      if (pct != null) engineBannerText.textContent = `Chargement du moteur de conversion (environ 31 Mo, une seule fois)… ${pct.toFixed(0)} %`;
    }

    function refreshView() {
      fileListEl.innerHTML = '';
      for (const entry of entries) fileListEl.append(renderRow(entry));
      setEngineLoading(state.engineLoadingPct);
      updateButtons();
    }

    function updateRowProgress(entry) {
      const row = fileListEl.querySelector(`[data-entry-id="${entry.id}"]`);
      if (!row) return;
      const fill = row.querySelector('.progress-bar-fill');
      const pct = row.querySelector('.progress-pct');
      if (fill) fill.style.width = `${entry.progress.toFixed(0)}%`;
      if (pct) pct.textContent = `${entry.progress.toFixed(0)} %`;
    }

    function handleNewFiles(files) {
      for (const file of files) {
        entries.push({
          id: uid(),
          file,
          status: 'waiting',
          progress: 0,
          resultBlob: null,
          resultName: null,
          errorMsg: null,
          sizeAfter: null,
          optionsSnapshot: null,
        });
      }
      refresh(state);
    }

    function removeEntry(id) {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1 || entries[idx].status === 'running') return;
      entries.splice(idx, 1);
      refresh(state);
    }

    function renderRow(entry) {
      const row = el('div', { class: `file-row file-row-${entry.status}`, 'data-entry-id': entry.id });
      row.append(el('div', { class: 'file-row-name' }, entry.file.name));
      row.append(el('div', { class: 'file-row-size' }, formatBytes(entry.file.size)));

      const statusCell = el('div', { class: 'file-row-status' });
      if (entry.status === 'waiting') {
        statusCell.append(el('span', { class: 'badge badge-waiting' }, 'En attente'));
      } else if (entry.status === 'queued') {
        statusCell.append(el('span', { class: 'badge badge-waiting' }, 'Dans la file — démarre après la conversion en cours'));
      } else if (entry.status === 'running') {
        statusCell.append(
          el('div', { class: 'progress-bar' }, [el('div', { class: 'progress-bar-fill', style: `width:${entry.progress.toFixed(0)}%` })]),
          el('span', { class: 'progress-pct' }, `${entry.progress.toFixed(0)} %`)
        );
      } else if (entry.status === 'done') {
        const gain = formatGainPercent(entry.file.size, entry.sizeAfter);
        statusCell.append(
          el('span', { class: 'badge badge-done' }, 'Terminé'),
          el('span', { class: 'file-row-sizeafter' }, `${formatBytes(entry.sizeAfter)}${gain != null ? ` (${gain >= 0 ? '-' : '+'}${Math.abs(gain)} %)` : ''}`)
        );
        if (entry.sizeAfter > entry.file.size) {
          statusCell.append(
            el('span', { class: 'badge badge-warning' }, 'Plus gros que l’original'),
            el(
              'span',
              { class: 'file-row-hint' },
              'Cette vidéo était déjà très optimisée : garde plutôt l’original. Pour gagner de la place malgré tout, choisis le niveau 23 ou une résolution plus basse (perte légère).'
            )
          );
        }
      } else if (entry.status === 'error') {
        statusCell.append(el('span', { class: 'badge badge-error' }, 'Erreur'), el('span', { class: 'file-row-error' }, entry.errorMsg));
      }
      row.append(statusCell);

      const actions = el('div', { class: 'file-row-actions' });
      if (entry.status === 'done') {
        actions.append(
          el(
            'button',
            { class: 'btn btn-ghost', onClick: () => openPreviewModal({ kind: tool.fileKind, url: URL.createObjectURL(entry.resultBlob), name: entry.resultName }) },
            'Aperçu'
          ),
          el('button', { class: 'btn btn-secondary', onClick: () => triggerDownload(entry.resultBlob, entry.resultName) }, 'Télécharger')
        );
      }
      if (entry.status !== 'running' && entry.status !== 'queued') {
        actions.append(el('button', { class: 'btn btn-icon', 'aria-label': 'Retirer', onClick: () => removeEntry(entry.id) }, '✕'));
      }
      row.append(actions);
      return row;
    }

    function downloadZip() {
      const done = entries.filter((e) => e.status === 'done');
      if (done.length < 2) return;
      Promise.all(done.map(async (e) => ({ name: e.resultName, data: new Uint8Array(await e.resultBlob.arrayBuffer()) })))
        .then((zipEntries) => triggerDownload(createZipBlob(zipEntries), 'convertifacile.zip'));
    }

    const view = { refresh: refreshView, updateRowProgress, setEngineLoading };
    state.view = view;
    state.unseenResults = false;
    refresh(state);

    return () => {
      if (state.view === view) state.view = null;
    };
  };
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name, style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

function setMetaDescription(content) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.append(tag);
  }
  tag.setAttribute('content', content);
}
