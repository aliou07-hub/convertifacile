const routes = new Map();
let notFoundHandler = null;
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function registerNotFound(handler) {
  notFoundHandler = handler;
}

function getPath() {
  const hash = window.location.hash || '#/';
  return hash.slice(1) || '/';
}

async function render() {
  const app = document.getElementById('app');
  if (!app) return;
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { /* ignore */ }
    currentCleanup = null;
  }
  const path = getPath();
  const handler = routes.get(path) || notFoundHandler;
  app.innerHTML = '<div class="route-loading"><div class="spinner"></div><span>Chargement…</span></div>';
  window.scrollTo(0, 0);
  if (!handler) return;
  const loadingEl = app.firstElementChild;
  const result = await handler(app);
  loadingEl.remove();
  if (typeof result === 'function') currentCleanup = result;
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${path}`);
  });
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

export function navigate(path) {
  window.location.hash = `#${path}`;
}
