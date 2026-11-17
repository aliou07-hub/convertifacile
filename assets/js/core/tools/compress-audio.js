import { sanitizeBaseName, extOf } from '../format.js';
import { renderAudioOptions, buildAudioEncodeArgs, AUDIO_FORMATS } from '../audioOptions.js';

export const defaultOptions = { format: 'auto', bitrate: 96, volume: 100 };

const FORMAT_OPTIONS = [{ value: 'auto', label: 'Automatique (WAV → FLAC sans perte, sinon même format)' }, ...AUDIO_FORMATS];
const KNOWN = new Set(AUDIO_FORMATS.map((f) => f.value));
// Re-writing WAV as WAV can't shrink it; FLAC is lossless and roughly halves the size.
const AUTO_TARGET = { wav: 'flac' };

export function renderOptions(panel, options, emitChange) {
  renderAudioOptions(panel, options, emitChange, { formatOptions: FORMAT_OPTIONS });
}

function resolveFormat(file, options) {
  if (options.format !== 'auto') return options.format;
  const ext = extOf(file.name);
  if (AUTO_TARGET[ext]) return AUTO_TARGET[ext];
  return KNOWN.has(ext) ? ext : 'mp3';
}

export async function plan(file, options) {
  const resolvedFormat = resolveFormat(file, options);
  const { codecArgs, filterArgs } = buildAudioEncodeArgs({ ...options, format: resolvedFormat });
  const build = ({ inputPath, outputName }) => {
    const out = `${outputName}.${resolvedFormat}`;
    const args = ['-i', inputPath, '-vn', ...codecArgs, ...filterArgs, out];
    return { args, outputName: out };
  };
  return { build };
}

export function outputFileName(file, options) {
  return `${sanitizeBaseName(file.name)}-compresse.${resolveFormat(file, options)}`;
}
