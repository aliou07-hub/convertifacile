import { sanitizeBaseName, extOf } from '../format.js';

export const defaultOptions = {};

export function renderOptions(panel) {
  const p = document.createElement('p');
  p.className = 'option-note';
  p.textContent = "Aucun réglage nécessaire : le flux vidéo est copié tel quel, sans sa bande son.";
  panel.append(p);
}

export async function plan(file) {
  const build = ({ inputPath, outputName }) => {
    const origExt = extOf(file.name) || 'mp4';
    const copyOut = `${outputName}.${origExt}`;
    const reencodeOut = `${outputName}.mp4`;
    const copyArgs = ['-i', inputPath, '-map', '0:v:0', '-c:v', 'copy', '-an', copyOut];
    const reencodeArgs = ['-i', inputPath, '-map', '0:v:0', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an', reencodeOut];
    return { args: copyArgs, outputName: copyOut, fallbacks: [{ args: reencodeArgs, outputName: reencodeOut }] };
  };
  return { build };
}

export function outputFileName(file, options, actualExt) {
  return `${sanitizeBaseName(file.name)}-sans-son.${actualExt || extOf(file.name) || 'mp4'}`;
}
