import { registerRoute, registerNotFound, startRouter } from './core/router.js';
import { createFfmpegToolPage } from './core/ffmpegToolPage.js';
import { createImageToolPage } from './core/imageToolPage.js';
import { TOOLS, getToolById } from './core/toolRegistry.js';
import { renderHome } from './pages/home.js';
import { el } from './core/ui.js';
import { initJobIndicator } from './core/jobIndicator.js';

registerRoute('/', renderHome);

for (const tool of TOOLS) {
  registerRoute(`/${tool.id}`, async (container) => {
    const mod = await import(tool.module);
    const factory = tool.engine === 'image' ? createImageToolPage : createFfmpegToolPage;
    const page = factory({ ...tool, ...mod });
    return page(container);
  });
}

registerNotFound((container) => {
  container.append(
    el('div', { class: 'not-found' }, [
      el('h1', {}, 'Page introuvable'),
      el('p', {}, "Cet outil n'existe pas."),
      el('a', { class: 'btn btn-primary', href: '#/' }, "Retour à l'accueil"),
    ])
  );
});

function initHeader() {
  const year = new Date().getFullYear();
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(year);

  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }
}

initHeader();
initJobIndicator();
startRouter();

export { getToolById };
