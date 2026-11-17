import { sanitizeBaseName } from '../format.js';
import { renderImageOptions } from '../imageOptions.js';

export const defaultOptions = { format: 'auto', quality: 92, maxWidth: 1280 };

export function renderOptions(panel, options, emitChange) {
  renderImageOptions(panel, options, emitChange, { maxWidthLabel: 'Largeur maximale (px)' });
}

export function toImageOptions(file, options) {
  return { format: options.format, quality: options.quality, maxWidth: options.maxWidth };
}

export function outputFileName(file, options, format) {
  return `${sanitizeBaseName(file.name)}-redimensionnee.${format}`;
}
