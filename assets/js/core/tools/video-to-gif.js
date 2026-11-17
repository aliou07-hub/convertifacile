import { sanitizeBaseName, formatSecondsToHMS, parseTimeToSeconds } from '../format.js';
import { buildField, buildTextInput, buildSelect, buildRange } from '../ui.js';

export const defaultOptions = {
  start: '0',
  duration: 5,
  fps: 12,
  width: 480,
};

export function renderOptions(panel, options, emitChange) {
  panel.append(
    buildField(
      'Début (secondes ou hh:mm:ss)',
      buildTextInput({
        value: options.start,
        placeholder: '0',
        field: 'start',
        onInput: (v) => {
          options.start = v;
          emitChange();
        },
      })
    ),
    buildField(
      'Durée (max 30 s)',
      buildRange({
        min: 1,
        max: 30,
        step: 1,
        value: options.duration,
        field: 'duration',
        display: (v) => `${v} s`,
        onInput: (v) => {
          options.duration = v;
          emitChange();
        },
      })
    ),
    buildField(
      'Images par seconde',
      buildSelect({
        value: String(options.fps),
        field: 'fps',
        options: [8, 12, 15, 20].map((v) => ({ value: String(v), label: `${v} ips` })),
        onChange: (v) => {
          options.fps = Number(v);
          emitChange();
        },
      })
    ),
    buildField(
      'Largeur (px)',
      buildRange({
        min: 320,
        max: 800,
        step: 10,
        value: options.width,
        field: 'width',
        display: (v) => `${v} px`,
        onInput: (v) => {
          options.width = v;
          emitChange();
        },
      })
    )
  );
}

export async function plan(file, options) {
  const startSeconds = Math.max(0, parseTimeToSeconds(options.start) || 0);
  const duration = Math.min(30, Math.max(1, Number(options.duration) || 5));
  const filter = `fps=${options.fps},scale=${options.width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`;

  const build = ({ inputPath, outputName }) => {
    const out = `${outputName}.gif`;
    const args = [
      '-ss',
      formatSecondsToHMS(startSeconds),
      '-t',
      String(duration),
      '-i',
      inputPath,
      '-filter_complex',
      filter,
      '-loop',
      '0',
      out,
    ];
    return { args, outputName: out };
  };

  return { knownDuration: duration, build };
}

export function outputFileName(file) {
  return `${sanitizeBaseName(file.name)}.gif`;
}
