import { buildField, buildSelect, buildRange } from './ui.js';

export const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' },
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'ogg', label: 'OGG' },
  { value: 'opus', label: 'OPUS' },
];

const NO_BITRATE_FORMATS = new Set(['wav', 'flac']);

export function renderAudioOptions(panel, options, emitChange, { formatOptions = AUDIO_FORMATS, showFormat = true } = {}) {
  const zone = document.createElement('div');
  panel.append(zone);

  function draw() {
    zone.innerHTML = '';
    if (showFormat) {
      zone.append(
        buildField(
          'Format de sortie',
          buildSelect({
            value: options.format,
            field: 'format',
            options: formatOptions,
            onChange: (v) => {
              options.format = v;
              draw();
              emitChange();
            },
          })
        )
      );
    }
    if (!NO_BITRATE_FORMATS.has(options.format)) {
      zone.append(
        buildField(
          'Débit (kb/s)',
          buildSelect({
            value: String(options.bitrate),
            field: 'bitrate',
            options: [64, 96, 128, 160, 192, 256, 320].map((v) => ({ value: String(v), label: `${v} kb/s` })),
            onChange: (v) => {
              options.bitrate = Number(v);
              emitChange();
            },
          })
        )
      );
    }
    zone.append(
      buildField(
        'Volume',
        buildRange({
          min: 0,
          max: 200,
          field: 'volume',
          step: 5,
          value: options.volume,
          display: (v) => `${v} %`,
          onInput: (v) => {
            options.volume = v;
            emitChange();
          },
        })
      )
    );
  }
  draw();
}

export function buildAudioEncodeArgs(options) {
  const filterArgs = options.volume !== 100 ? ['-af', `volume=${(options.volume / 100).toFixed(2)}`] : [];
  switch (options.format) {
    case 'mp3':
      return { codecArgs: ['-c:a', 'libmp3lame', '-b:a', `${options.bitrate}k`], filterArgs };
    case 'm4a':
      return { codecArgs: ['-c:a', 'aac', '-b:a', `${options.bitrate}k`], filterArgs };
    case 'wav':
      return { codecArgs: ['-c:a', 'pcm_s16le'], filterArgs };
    case 'flac':
      return { codecArgs: ['-c:a', 'flac'], filterArgs };
    case 'ogg':
      return { codecArgs: ['-c:a', 'libvorbis', '-b:a', `${options.bitrate}k`], filterArgs };
    case 'opus':
      return { codecArgs: ['-c:a', 'libopus', '-b:a', `${options.bitrate}k`], filterArgs };
    default:
      return { codecArgs: ['-c:a', 'libmp3lame', '-b:a', `${options.bitrate}k`], filterArgs };
  }
}
