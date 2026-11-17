import { sanitizeBaseName } from '../format.js';
import { renderAudioOptions, buildAudioEncodeArgs, AUDIO_FORMATS } from '../audioOptions.js';

export const defaultOptions = { format: 'mp3', bitrate: 192, volume: 100 };

export function renderOptions(panel, options, emitChange) {
  renderAudioOptions(panel, options, emitChange, { formatOptions: AUDIO_FORMATS });
}

export async function plan(file, options) {
  const { codecArgs, filterArgs } = buildAudioEncodeArgs(options);
  const build = ({ inputPath, outputName }) => {
    const out = `${outputName}.${options.format}`;
    const args = ['-i', inputPath, '-vn', ...codecArgs, ...filterArgs, out];
    return { args, outputName: out };
  };
  return { build };
}

export function outputFileName(file, options) {
  return `${sanitizeBaseName(file.name)}.${options.format}`;
}
