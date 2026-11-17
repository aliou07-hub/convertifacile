import { sanitizeBaseName, parseTimeToSeconds, extOf } from '../format.js';
import { buildField, buildTextInput, buildRadioGroup } from '../ui.js';

export const defaultOptions = {
  start: '0',
  end: '10',
  mode: 'precise',
};

export function renderOptions(panel, options, emitChange) {
  panel.append(
    buildField(
      'Début (secondes ou hh:mm:ss)',
      buildTextInput({
        value: options.start,
        field: 'start',
        onInput: (v) => {
          options.start = v;
          emitChange();
        },
      })
    ),
    buildField(
      'Fin (secondes ou hh:mm:ss)',
      buildTextInput({
        value: options.end,
        field: 'end',
        onInput: (v) => {
          options.end = v;
          emitChange();
        },
      })
    ),
    buildField(
      'Mode',
      buildRadioGroup({
        name: 'cut-mode',
        field: 'mode',
        value: options.mode,
        options: [
          { value: 'precise', label: 'Précis (réencodage)' },
          { value: 'fast', label: 'Rapide (sans réencodage)' },
        ],
        onChange: (v) => {
          options.mode = v;
          emitChange();
        },
      })
    )
  );
}

export async function plan(file, options) {
  const start = parseTimeToSeconds(options.start);
  const end = parseTimeToSeconds(options.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('La fin doit être après le début. Vérifie les horaires saisis.');
  }
  const duration = end - start;
  const startArg = start.toFixed(3);
  const durationArg = duration.toFixed(3);

  const build = ({ inputPath, outputName }) => {
    const reencodeOut = `${outputName}.mp4`;
    // Input seeking (-ss before -i) is frame-accurate when re-encoding and avoids
    // decoding everything before the cut point, which matters for 1 GB files.
    const reencodeWith = (audioArgs) => ({
      args: [
        '-ss', startArg,
        '-i', inputPath,
        '-t', durationArg,
        '-map', '0:v:0', '-map', '0:a?',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        ...audioArgs,
        '-movflags', '+faststart',
        reencodeOut,
      ],
      outputName: reencodeOut,
    });
    const reencodeAttempts = [reencodeWith(['-c:a', 'aac', '-b:a', '256k'])];
    if (options.mode === 'fast') {
      const origExt = extOf(file.name) || 'mp4';
      const copyOut = `${outputName}.${origExt}`;
      const copyArgs = ['-ss', startArg, '-i', inputPath, '-t', durationArg, '-map', '0', '-c', 'copy', copyOut];
      return { args: copyArgs, outputName: copyOut, fallbacks: reencodeAttempts };
    }
    const [first] = reencodeAttempts;
    return { args: first.args, outputName: first.outputName };
  };

  return { knownDuration: duration, build };
}

export function outputFileName(file, options, actualExt) {
  const ext = actualExt || (options.mode === 'fast' ? extOf(file.name) || 'mp4' : 'mp4');
  return `${sanitizeBaseName(file.name)}-coupe.${ext}`;
}
