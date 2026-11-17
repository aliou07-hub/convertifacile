import { subscribeJobs, jobSummary, anyJobRunning } from './jobStore.js';

const TITLE_PREFIX = /^(\(\d+ %\) |✅ |⚠️ )/;

let wakeLock = null;

async function updateWakeLock(running) {
  // Keeps a phone screen on while converting: a locked screen lets the OS suspend the tab.
  if (!('wakeLock' in navigator)) return;
  try {
    if (running && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!running && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* refused (battery saver, permissions): conversion continues anyway */
  }
}

function render() {
  const bar = document.getElementById('job-bar');
  const summary = jobSummary();
  const baseTitle = document.title.replace(TITLE_PREFIX, '');

  if (!summary) {
    bar.hidden = true;
    document.title = baseTitle;
    updateWakeLock(false);
    return;
  }

  // On the tool's own page the progress is already visible in the file list.
  bar.hidden = window.location.hash === `#/${summary.toolId}`;
  bar.href = `#/${summary.toolId}`;
  bar.dataset.kind = summary.kind;
  if (summary.kind === 'running') {
    const pct = Math.floor(summary.pct);
    const files = summary.fileCount > 1 ? ` — fichier ${summary.fileIndex}/${summary.fileCount}` : '';
    bar.textContent = summary.loadingEngine
      ? `⏳ ${summary.title} : chargement du moteur…`
      : `⏳ ${summary.title} en cours : ${pct} %${files} — la conversion continue, tu peux naviguer`;
    document.title = `(${pct} %) ${baseTitle}`;
    updateWakeLock(true);
  } else {
    const ok = summary.kind === 'done';
    bar.textContent = ok ? `✅ ${summary.title} terminé — clique pour récupérer tes fichiers` : `⚠️ ${summary.title} : une erreur est survenue — clique pour voir`;
    document.title = `${ok ? '✅' : '⚠️'} ${baseTitle}`;
    updateWakeLock(false);
  }
}

export function initJobIndicator() {
  subscribeJobs(render);
  window.addEventListener('hashchange', () => setTimeout(render, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateWakeLock(anyJobRunning());
  });
  window.addEventListener('beforeunload', (e) => {
    if (!anyJobRunning()) return;
    // Closing or reloading the tab would kill the conversion: ask the browser to confirm.
    e.preventDefault();
    e.returnValue = '';
  });
  render();
}
