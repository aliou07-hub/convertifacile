import { sanitizeBaseName } from '../format.js';
import { renderImageOptions } from '../imageOptions.js';

export const defaultOptions = { format: 'auto', quality: 90, maxWidth: null };

export function renderOptions(panel, options, emitChange) {
  renderImageOptions(panel, options, emitChange, { maxWidthLabel: 'Largeur maximale (optionnel)' });
}

export function toImageOptions(file, options) {
  return { format: options.format, quality: options.quality, maxWidth: options.maxWidth };
}

export function outputFileName(file, options, format) {
  return `${sanitizeBaseName(file.name)}-compressee.${format}`;
}
