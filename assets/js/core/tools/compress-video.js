import { ffmpegEngine } from '../ffmpeg-engine.js';
import { sanitizeBaseName } from '../format.js';
import { buildField, buildSelect, buildRadioGroup, buildNumberInput, buildRange } from '../ui.js';
import {
  RESOLUTION_SHORT_SIDE,
  shortSideScaleFilter,
  AUDIO_BITRATE_ARGS,
  AUDIO_BITRATE_KBPS,
  AUDIO_HIGH_QUALITY_FALLBACK,
} from '../videoFilters.js';

export const defaultOptions = {
  mode: 'quality',
  crf: 18,
  targetSizeMB: 10,
  percent: 50,
  codec: 'h264',
  resolution: 'original',
  audio: 'copy',
};

export function renderOptions(panel, options, emitChange) {
  const modeRow = buildField(
    'Méthode',
    buildRadioGroup({
      name: 'compress-mode',
      field: 'mode',
      value: options.mode,
      options: [
        { value: 'quality', label: 'Par qualité' },
        { value: 'size', label: 'Taille cible (Mo)' },
        { value: 'percent', label: 'Pourcentage' },
      ],
      onChange: (v) => {
        options.mode = v;
        rerender();
      },
    })
  );
  panel.append(modeRow);

  const dynamicZone = document.createElement('div');
  panel.append(dynamicZone);

  function rerender() {
    dynamicZone.innerHTML = '';
    dynamicZone.append(buildModeControls());
    emitChange();
  }

  function buildModeControls() {
    if (options.mode === 'quality') {
      return buildField(
        'Qualité (CRF — plus bas = meilleure qualité)',
        buildSelect({
          value: String(options.crf),
          field: 'crf',
          options: [
            { value: '18', label: '18 — Qualité d’origine' },
            { value: '23', label: '23 — Bon compromis' },
            { value: '28', label: '28 — Qualité réduite' },
            { value: '32', label: '32 — Forte compression' },
          ],
          onChange: (v) => {
            options.crf = Number(v);
            emitChange();
          },
        })
      );
    }
    if (options.mode === 'size') {
      return buildField(
        'Taille cible (Mo)',
        buildNumberInput({
          value: options.targetSizeMB,
          min: 0.5,
          field: 'targetSizeMB',
          onInput: (v) => {
            options.targetSizeMB = v || 1;
            emitChange();
          },
        })
      );
    }
    return buildField(
      'Pourcentage de la taille d’origine',
      buildRange({
        min: 10,
        max: 90,
        step: 5,
        value: options.percent,
        field: 'percent',
        display: (v) => `${v} %`,
        onInput: (v) => {
          options.percent = v;
          emitChange();
        },
      })
    );
  }
  dynamicZone.append(buildModeControls());
  panel.append(noteEl('Par défaut : résolution et son d’origine conservés, image identique à l’œil (niveau 18).'));

  const codecZone = document.createElement('div');
  function renderCodecZone() {
    codecZone.innerHTML = '';
    codecZone.append(
      buildField(
        'Codec vidéo',
        buildSelect({
          value: options.codec,
          field: 'codec',
          options: [
            { value: 'h264', label: 'H.264 (compatible partout)' },
            { value: 'h265', label: 'H.265 (plus léger, plus lent)' },
          ],
          onChange: (v) => {
            options.codec = v;
            renderCodecZone();
            emitChange();
          },
        })
      )
    );
    if (options.codec === 'h265') {
      codecZone.append(noteEl('⚠️ Le codec H.265 est plus lent à encoder dans le navigateur.'));
    }
  }
  renderCodecZone();
  panel.append(codecZone);

  panel.append(
    buildField(
      'Résolution',
      buildSelect({
        value: options.resolution,
        field: 'resolution',
        options: [
          { value: 'original', label: 'Originale (4K → 4K, HD → HD)' },
          { value: '1080p', label: '1080p' },
          { value: '720p', label: '720p' },
          { value: '480p', label: '480p' },
          { value: '360p', label: '360p' },
        ],
        onChange: (v) => {
          options.resolution = v;
          emitChange();
        },
      })
    )
  );

  panel.append(
    buildField(
      'Son',
      buildSelect({
        value: options.audio,
        field: 'audio',
        options: [
          { value: 'copy', label: 'Son d’origine (intact)' },
          { value: 'keep128', label: 'Réencoder (128 kb/s)' },
          { value: 'reduce96', label: 'Réduire (96 kb/s)' },
          { value: 'reduce64', label: 'Réduire (64 kb/s)' },
          { value: 'none', label: 'Supprimer' },
        ],
        onChange: (v) => {
          options.audio = v;
          emitChange();
        },
      })
    )
  );
}

function noteEl(text) {
  const p = document.createElement('p');
  p.className = 'option-note';
  p.textContent = text;
  return p;
}

export async function plan(file, options) {
  const videoCodecArgs = options.codec === 'h265' ? ['-c:v', 'libx265', '-tag:v', 'hvc1'] : ['-c:v', 'libx264'];
  const scaleArgs = [];
  const shortSide = RESOLUTION_SHORT_SIDE[options.resolution];
  if (shortSide) scaleArgs.push('-vf', shortSideScaleFilter(shortSide));

  let rateArgs;
  let knownDuration;
  if (options.mode === 'quality') {
    rateArgs = ['-crf', String(options.crf)];
  } else {
    const duration = await ffmpegEngine.probeDuration(file);
    knownDuration = duration;
    const targetMB = options.mode === 'size' ? options.targetSizeMB : (file.size / (1024 * 1024)) * (options.percent / 100);
    const audioKbps = AUDIO_BITRATE_KBPS[options.audio] || 0;
    const safeDuration = duration && duration > 0 ? duration : 60;
    const totalKbps = (targetMB * 8192 * 0.94) / safeDuration;
    const videoKbps = Math.max(80, Math.round(totalKbps - audioKbps));
    rateArgs = ['-b:v', `${videoKbps}k`, '-maxrate', `${videoKbps}k`, '-bufsize', `${videoKbps * 2}k`];
  }

  const build = ({ inputPath, outputName }) => {
    const out = `${outputName}.mp4`;
    const argsWithAudio = (audioArgs) => [
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      ...videoCodecArgs,
      ...rateArgs,
      ...scaleArgs,
      ...audioArgs,
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-movflags',
      '+faststart',
      out,
    ];
    const args = argsWithAudio(AUDIO_BITRATE_ARGS[options.audio]);
    if (options.audio === 'copy') {
      // Some original audio codecs (e.g. PCM from cameras) can't go into MP4 as-is.
      return { args, outputName: out, fallbacks: [{ args: argsWithAudio(AUDIO_HIGH_QUALITY_FALLBACK), outputName: out }] };
    }
    return { args, outputName: out };
  };

  return { knownDuration, build };
}

export function outputFileName(file) {
  return `${sanitizeBaseName(file.name)}-compressee.mp4`;
}
