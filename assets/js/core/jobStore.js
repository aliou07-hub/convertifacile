// Conversion state lives here, outside the page DOM, so a job keeps running (and its
// results stay downloadable) when the user navigates elsewhere in the site and comes back.

const states = new Map();
const listeners = new Set();

export function getToolState(tool) {
  if (!states.has(tool.id)) {
    states.set(tool.id, {
      tool,
      options: { ...tool.defaultOptions },
      entries: [],
      running: false,
      stopRequested: false,
      engineLoadingPct: null,
      batchTotal: 0,
      batchIndex: 0,
      unseenResults: false,
      view: null,
    });
  }
  return states.get(tool.id);
}

export function notifyJobs() {
  for (const fn of listeners) fn();
}

export function subscribeJobs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** What the global progress bar should show, or null when there is nothing to report. */
export function jobSummary() {
  const all = [...states.values()];
  const active = all.find((s) => s.running && s.entries.some((e) => e.status === 'running'))
    || all.find((s) => s.running);
  if (active) {
    const current = active.entries.find((e) => e.status === 'running');
    return {
      kind: 'running',
      toolId: active.tool.id,
      title: active.tool.title,
      pct: current ? current.progress : 0,
      fileIndex: active.batchIndex,
      fileCount: active.batchTotal,
      loadingEngine: active.engineLoadingPct != null,
    };
  }
  const finished = all.find((s) => s.unseenResults);
  if (finished) {
    const failed = finished.entries.some((e) => e.status === 'error');
    return { kind: failed ? 'failed' : 'done', toolId: finished.tool.id, title: finished.tool.title };
  }
  return null;
}

export function anyJobRunning() {
  return [...states.values()].some((s) => s.running);
}
