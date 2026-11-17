import { processImage } from './image-engine.js';
import { createZipBlob } from './zip.js';
import { formatBytes, formatGainPercent, uid } from './format.js';
import {
  el,
  renderBreadcrumb,
  renderToolHeader,
  renderOtherTools,
  createDropzone,
  openPreviewModal,
} from './ui.js';

/**
 * @param {Object} tool
 * @param {string} tool.id
 * @param {string} tool.title
 * @param {string} tool.icon
 * @param {string} tool.description
 * @param {string} tool.metaDescription
 * @param {string} tool.accept
 * @param {Object} tool.defaultOptions
 * @param {(panel:HTMLElement, options:Object, emitChange:Function) => void} tool.renderOptions
 * @param {(file:File, options:Object) => {format?:string, quality?:number, maxWidth?:number|null}} tool.toImageOptions
 * @param {(file:File, options:Object, outputFormat:string) => string} tool.outputFileName
 */
export function createImageToolPage(tool) {
  return function render(container) {
    document.title = `${tool.title} — ConvertiFacile`;
    setMetaDescription(tool.metaDescription);

    const options = { ...tool.defaultOptions };
    const entries = [];

    const page = el('div', { class: 'tool-page' });
    page.append(renderBreadcrumb(tool.title));
    page.append(renderToolHeader({ icon: tool.icon, title: tool.title, description: tool.description }));

    const dropzone = createDropzone({
      accept: tool.accept,
      multiple: true,
      hint: `Formats acceptés : ${tool.accept}`,
      onFiles: handleNewFiles,
    });

    const fileListEl = el('div', { class: 'file-list' });
    const actionsRow = el('div', { class: 'actions-row' });
    const zipBtn = el('button', { class: 'btn btn-secondary', style: 'display:none', onClick: () => downloadZip() }, 'Tout télécharger (ZIP)');
    actionsRow.append(zipBtn);

    const optionsPanel = el('div', { class: 'options-panel' }, [el('h2', {}, 'Options')]);
    const optionsBody = el('div', { class: 'options-body' });
    optionsPanel.append(optionsBody);
    tool.renderOptions(optionsBody, options, () => reprocessAll());

    const mainGrid = el('div', { class: 'tool-grid' }, [
      el('div', { class: 'tool-main' }, [dropzone, actionsRow, fileListEl]),
      optionsPanel,
    ]);
    page.append(mainGrid);
    page.append(renderOtherTools(tool.id));
    container.append(page);

    function handleNewFiles(files) {
      for (const file of files) {
        const entry = { id: uid(), file, status: 'waiting', resultBlob: null, resultName: null, errorMsg: null, sizeAfter: null };
        entries.push(entry);
        processEntry(entry);
      }
      renderFileList();
    }

    async function processEntry(entry) {
      entry.status = 'running';
      renderFileList();
      try {
        const imgOpts = tool.toImageOptions(entry.file, options);
        const { blob, format, resized, sameFormat } = await processImage(entry.file, imgOpts);
        const noGain = blob.size >= entry.file.size && !resized && sameFormat;
        entry.note = noGain ? 'Image déjà optimisée : fichier d’origine conservé, sans aucune perte.' : null;
        entry.resultBlob = noGain ? entry.file : blob;
        entry.resultName = tool.outputFileName(entry.file, options, format);
        entry.sizeAfter = entry.resultBlob.size;
        entry.status = 'done';
      } catch (err) {
        entry.status = 'error';
        entry.errorMsg = (err && err.message) || 'Erreur inconnue.';
      }
      renderFileList();
      zipBtn.style.display = entries.filter((e) => e.status === 'done').length >= 2 ? '' : 'none';
    }

    function reprocessAll() {
      for (const entry of entries) {
        if (entry.status === 'done' || entry.status === 'error') processEntry(entry);
      }
    }

    function removeEntry(id) {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1) return;
      entries.splice(idx, 1);
      renderFileList();
      zipBtn.style.display = entries.filter((e) => e.status === 'done').length >= 2 ? '' : 'none';
    }

    function renderFileList() {
      fileListEl.innerHTML = '';
      for (const entry of entries) fileListEl.append(renderRow(entry));
    }

    function renderRow(entry) {
      const row = el('div', { class: `file-row file-row-${entry.status}` });
      row.append(el('div', { class: 'file-row-name' }, entry.file.name));
      row.append(el('div', { class: 'file-row-size' }, formatBytes(entry.file.size)));

      const statusCell = el('div', { class: 'file-row-status' });
      if (entry.status === 'running') {
        statusCell.append(el('span', { class: 'badge badge-waiting' }, 'Traitement…'));
      } else if (entry.status === 'done') {
        const gain = formatGainPercent(entry.file.size, entry.sizeAfter);
        statusCell.append(
          el('span', { class: 'badge badge-done' }, 'Terminé'),
          el('span', { class: 'file-row-sizeafter' }, `${formatBytes(entry.sizeAfter)}${gain != null ? ` (${gain >= 0 ? '-' : '+'}${Math.abs(gain)} %)` : ''}`)
        );
        if (entry.note) {
          statusCell.append(el('span', { class: 'file-row-hint' }, entry.note));
        } else if (entry.sizeAfter > entry.file.size) {
          statusCell.append(el('span', { class: 'badge badge-warning' }, 'Plus gros que l’original'));
        }
      } else if (entry.status === 'error') {
        statusCell.append(el('span', { class: 'badge badge-error' }, 'Erreur'), el('span', { class: 'file-row-error' }, entry.errorMsg));
      }
      row.append(statusCell);

      const actions = el('div', { class: 'file-row-actions' });
      if (entry.status === 'done') {
        actions.append(
          el(
            'button',
            { class: 'btn btn-ghost', onClick: () => openPreviewModal({ kind: 'image', url: URL.createObjectURL(entry.resultBlob), name: entry.resultName }) },
            'Aperçu'
          ),
          el('button', { class: 'btn btn-secondary', onClick: () => triggerDownload(entry.resultBlob, entry.resultName) }, 'Télécharger')
        );
      }
      actions.append(el('button', { class: 'btn btn-icon', 'aria-label': 'Retirer', onClick: () => removeEntry(entry.id) }, '✕'));
      row.append(actions);
      return row;
    }

    function triggerDownload(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: name, style: 'display:none' });
      document.body.append(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 2000);
    }

    function downloadZip() {
      const done = entries.filter((e) => e.status === 'done');
      if (done.length < 2) return;
      Promise.all(done.map(async (e) => ({ name: e.resultName, data: new Uint8Array(await e.resultBlob.arrayBuffer()) })))
        .then((zipEntries) => createZipBlob(zipEntries))
        .then((blob) => triggerDownload(blob, 'convertifacile.zip'));
    }

    return () => {};
  };
}

function setMetaDescription(content) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.append(tag);
  }
  tag.setAttribute('content', content);
}
