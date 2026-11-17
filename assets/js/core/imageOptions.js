import { buildField, buildSelect, buildRange, buildNumberInput } from './ui.js';

export function renderImageOptions(panel, options, emitChange, { showMaxWidth = true, maxWidthLabel = 'Largeur maximale (px)' } = {}) {
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
            { value: 'auto', label: "Automatique (garder le format d'origine)" },
            { value: 'jpg', label: 'JPG' },
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WEBP' },
          ],
          onChange: (v) => {
            options.format = v;
            draw();
            emitChange();
          },
        })
      )
    );
    if (options.format !== 'png') {
      zone.append(
        buildField(
          'Qualité',
          buildRange({
            min: 10,
            max: 100,
            field: 'quality',
            step: 5,
            value: options.quality,
            display: (v) => `${v} %`,
            onInput: (v) => {
              options.quality = v;
              emitChange();
            },
          })
        )
      );
    }
    if (showMaxWidth) {
      zone.append(
        buildField(
          maxWidthLabel,
          buildNumberInput({
            value: options.maxWidth,
            field: 'maxWidth',
            placeholder: 'Sans limite',
            min: 1,
            onInput: (v) => {
              options.maxWidth = v;
              emitChange();
            },
          })
        )
      );
    }
  }
  draw();
}
