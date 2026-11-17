import { TOOLS, getToolById } from './toolRegistry.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function renderBreadcrumb(currentTitle) {
  return el('nav', { class: 'breadcrumb', 'aria-label': 'Fil d’Ariane' }, [
    el('a', { href: '#/' }, 'Accueil'),
    el('span', {}, '›'),
    el('span', { 'aria-current': 'page' }, currentTitle),
  ]);
}

export function renderToolHeader({ icon, title, description }) {
  return el('header', { class: 'tool-header' }, [
    el('div', { class: 'tool-header-icon' }, icon),
    el('div', {}, [el('h1', {}, title), el('p', { class: 'tool-header-desc' }, description)]),
  ]);
}

export function renderOtherTools(currentId) {
  const others = TOOLS.filter((t) => t.id !== currentId);
  return el('section', { class: 'other-tools' }, [
    el('h2', {}, 'Les autres outils'),
    el(
      'div',
      { class: 'other-tools-grid' },
      others.map((t) =>
        el('a', { class: 'other-tool-card', href: `#/${t.id}` }, [
          el('span', { class: 'other-tool-icon' }, t.icon),
          el('span', {}, t.title),
        ])
      )
    ),
  ]);
}

export function createDropzone({ accept, multiple = true, onFiles, hint }) {
  const input = el('input', {
    type: 'file',
    accept,
    multiple: multiple ? true : undefined,
    class: 'visually-hidden',
    'data-testid': 'file-input',
  });
  const zone = el('div', { class: 'dropzone', tabindex: '0', role: 'button', 'aria-label': 'Ajouter des fichiers' }, [
    el('div', { class: 'dropzone-icon' }, '📁'),
    el('p', { class: 'dropzone-title' }, 'Glisse-dépose tes fichiers ici'),
    el('p', { class: 'dropzone-hint' }, hint || 'ou clique pour parcourir'),
    el('button', { type: 'button', class: 'btn btn-primary dropzone-btn' }, 'Choisir des fichiers'),
    input,
  ]);

  const open = () => input.click();
  zone.addEventListener('click', open);
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('change', () => {
    if (input.files && input.files.length) onFiles(Array.from(input.files));
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('is-dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-dragover');
    })
  );
  zone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onFiles(files);
  });

  return zone;
}

export function showToast(message, type = 'info') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = el('div', { id: 'toast-host', class: 'toast-host' });
    document.body.append(host);
  }
  const toast = el('div', { class: `toast toast-${type}` }, message);
  host.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

export function openPreviewModal({ kind, url, name }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const closeBtn = el('button', { class: 'modal-close', 'aria-label': 'Fermer' }, '✕');
  let mediaEl;
  if (kind === 'video') {
    mediaEl = el('video', { src: url, controls: true, autoplay: true, class: 'modal-media' });
  } else if (kind === 'audio') {
    mediaEl = el('audio', { src: url, controls: true, autoplay: true, class: 'modal-media modal-audio' });
  } else {
    mediaEl = el('img', { src: url, alt: name, class: 'modal-media' });
  }
  const modal = el('div', { class: 'modal' }, [closeBtn, el('p', { class: 'modal-filename' }, name), mediaEl]);
  backdrop.append(modal);
  document.body.append(backdrop);
  document.body.classList.add('modal-open');
  const close = () => {
    backdrop.remove();
    document.body.classList.remove('modal-open');
  };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
}

export function buildField(labelText, controlEl, extra) {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, labelText), controlEl, extra]);
}

export function buildSelect({ value, options, onChange, ariaLabel, field }) {
  const select = el(
    'select',
    { class: 'select', 'aria-label': ariaLabel || '', 'data-field': field || undefined, onChange: (e) => onChange(e.target.value) },
    options.map((opt) => el('option', { value: opt.value, selected: opt.value === value ? true : undefined }, opt.label))
  );
  return select;
}

export function buildRadioGroup({ name, value, options, onChange, field }) {
  return el(
    'div',
    { class: 'radio-group', role: 'radiogroup', 'data-field': field || undefined },
    options.map((opt) =>
      el('label', { class: 'radio-pill' }, [
        el('input', {
          type: 'radio',
          name,
          value: opt.value,
          checked: opt.value === value ? true : undefined,
          onChange: () => onChange(opt.value),
        }),
        el('span', {}, opt.label),
      ])
    )
  );
}

export function buildRange({ min, max, step = 1, value, onInput, display, field }) {
  const valueEl = el('span', { class: 'range-value' }, display ? display(value) : String(value));
  const input = el('input', {
    type: 'range',
    min,
    max,
    step,
    value,
    class: 'range',
    'data-field': field || undefined,
    onInput: (e) => {
      const v = Number(e.target.value);
      valueEl.textContent = display ? display(v) : String(v);
      onInput(v);
    },
  });
  return el('div', { class: 'range-row' }, [input, valueEl]);
}

export function buildCheckbox({ checked, label, onChange, field }) {
  return el('label', { class: 'checkbox-field' }, [
    el('input', { type: 'checkbox', checked: checked ? true : undefined, 'data-field': field || undefined, onChange: (e) => onChange(e.target.checked) }),
    el('span', {}, label),
  ]);
}

export function buildNumberInput({ value, placeholder, min, onInput, field }) {
  return el('input', {
    type: 'number',
    class: 'input-number',
    value: value ?? '',
    placeholder: placeholder || '',
    min: min ?? undefined,
    'data-field': field || undefined,
    onInput: (e) => onInput(e.target.value === '' ? null : Number(e.target.value)),
  });
}

export function buildTextInput({ value, placeholder, onInput, field }) {
  return el('input', {
    'data-field': field || undefined,
    type: 'text',
    class: 'input-text',
    value: value ?? '',
    placeholder: placeholder || '',
    onInput: (e) => onInput(e.target.value),
  });
}

export function kindFromMime(mime) {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return 'file';
}
