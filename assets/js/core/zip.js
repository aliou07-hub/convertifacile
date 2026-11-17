import { zipSync } from '../../../vendor/fflate/index.js';

export function createZipBlob(entries) {
  const files = {};
  const usedNames = new Set();
  for (const { name, data } of entries) {
    let finalName = name;
    let i = 2;
    while (usedNames.has(finalName)) {
      const dot = name.lastIndexOf('.');
      finalName = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
      i += 1;
    }
    usedNames.add(finalName);
    files[finalName] = [data instanceof Uint8Array ? data : new Uint8Array(data), { level: 0 }];
  }
  const zipped = zipSync(files);
  return new Blob([zipped], { type: 'application/zip' });
}
