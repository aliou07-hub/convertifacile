import { sanitizeBaseName } from '../format.js';
import { buildField, buildSelect, buildCheckbox } from '../ui.js';
import { RESOLUTION_SHORT_SIDE, shortSideScaleFilter, AUDIO_HIGH_QUALITY_FALLBACK } from '../videoFilters.js';

export const defaultOptions = {
  format: 'mp4',
  quality: 'high',
  resolution: 'original',
  fastCopy: false,
};

const CRF_X264 = { high: 18, normal: 23, light: 28 };
// VP8 rather than VP9: libvpx-vp9 crashes ("memory access out of bounds") in the
// single-thread ffmpeg.wasm 0.12.6 core. In VP8 CRF mode, -b:v is the bitrate ceiling.
const VP8_SETTINGS = {
  high: { crf: '6', maxBitrate: '50M' },
  normal: { crf: '14', maxBitrate: '20M' },
  light: { crf: '28', maxBitrate: '6M' },
};
const QSCALE_AVI = { high: 3, normal: 6, light: 12 };

function fastCopyEligible(options) {
  return ['mp4', 'mkv', 'mov'].includes(options.format) && options.resolution === 'original';
}

export function renderOptions(panel, options, emitChange) {
  const zone = document.createElement('div');
  panel.append(zone);

  function draw() {
    zone.innerHTML = '';
    zone.append(
      buildField(
        'Format de sortie',
        buildSelect({
          value: options.format,
          field: 'format',
          options: [
            { value: 'mp4', label: 'MP4' },
            { value: 'webm', label: 'WEBM' },
            { value: 'mkv', label: 'MKV' },
            { value: 'mov', label: 'MOV' },
            { value: 'avi', label: 'AVI' },
          ],
          onChange: (v) => {
            options.format = v;
            draw();
            emitChange();
          },
        })
      ),
      buildField(
        'Qualité',
        buildSelect({
          value: options.quality,
          field: 'quality',
          options: [
            { value: 'high', label: 'Haute — qualité d’origine' },
            { value: 'normal', label: 'Normale (perte légère)' },
            { value: 'light', label: 'Légère (fichier plus petit)' },
          ],
          onChange: (v) => {
            options.quality = v;
            emitChange();
          },
        })
      ),
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
            if (!fastCopyEligible(options)) options.fastCopy = false;
            draw();
            emitChange();
          },
        })
      )
    );

    const eligible = fastCopyEligible(options);
    const checkbox = buildCheckbox({
      checked: options.fastCopy && eligible,
      field: 'fastCopy',
      label: 'Conversion rapide sans réencodage (-c copy)',
      onChange: (v) => {
        options.fastCopy = v;
        emitChange();
      },
    });
    if (!eligible) {
      checkbox.querySelector('input').disabled = true;
    }
    zone.append(checkbox);
    if (!eligible) {
      const note = document.createElement('p');
      note.className = 'option-note';
      note.textContent = 'Disponible pour MP4, MKV, MOV avec la résolution originale.';
      zone.append(note);
    }
  }
  draw();
}

export async function plan(file, options) {
  const scaleArgs = [];
  const shortSide = RESOLUTION_SHORT_SIDE[options.resolution];
  if (shortSide) scaleArgs.push('-vf', shortSideScaleFilter(shortSide));

  const videoArgsFor = (format) => {
    if (format === 'webm') {
      const vp8 = VP8_SETTINGS[options.quality];
      return ['-c:v', 'libvpx', '-crf', vp8.crf, '-b:v', vp8.maxBitrate, '-deadline', 'realtime', '-cpu-used', '5', '-pix_fmt', 'yuv420p'];
    }
    if (format === 'avi') {
      return ['-c:v', 'mpeg4', '-vtag', 'xvid', '-q:v', String(QSCALE_AVI[options.quality])];
    }
    const base = ['-c:v', 'libx264', '-crf', String(CRF_X264[options.quality]), '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];
    if (format === 'mp4') base.push('-movflags', '+faststart');
    return base;
  };

  // WEBM and AVI only accept specific audio codecs, so those are always re-encoded at a high bitrate.
  const audioAttemptsFor = (format) => {
    if (format === 'webm') return [['-c:a', 'libopus', '-b:a', '192k']];
    if (format === 'avi') return [['-c:a', 'libmp3lame', '-b:a', '320k']];
    return [['-c:a', 'copy'], AUDIO_HIGH_QUALITY_FALLBACK];
  };

  const canFastCopy = options.fastCopy && fastCopyEligible(options);

  const build = ({ inputPath, outputName }) => {
    const out = `${outputName}.${options.format}`;
    const reencodeAttempts = audioAttemptsFor(options.format).map((audioArgs) => ({
      args: ['-i', inputPath, '-map', '0:v:0', '-map', '0:a?', ...videoArgsFor(options.format), ...scaleArgs, ...audioArgs, out],
      outputName: out,
    }));
    const attempts = canFastCopy
      ? [{ args: ['-i', inputPath, '-map', '0:v:0', '-map', '0:a?', '-c', 'copy', out], outputName: out }, ...reencodeAttempts]
      : reencodeAttempts;
    const [first, ...fallbacks] = attempts;
    return { args: first.args, outputName: first.outputName, fallbacks };
  };

  return { build };
}

export function outputFileName(file, options) {
  return `${sanitizeBaseName(file.name)}.${options.format}`;
}
