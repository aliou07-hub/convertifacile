import { el } from '../core/ui.js';
import { TOOLS, CATEGORIES, toolsByCategory } from '../core/toolRegistry.js';

export function renderHome(container) {
  document.title = 'ConvertiFacile — Compresser et convertir vidéos, audios, images gratuitement';
  setMeta('ConvertiFacile compresse et convertit tes vidéos, audios et images gratuitement, 100 % dans ton navigateur. Aucun envoi sur internet, sans inscription, sans filigrane.');

  const page = el('div', { class: 'home-page' });

  page.append(
    el('section', { class: 'hero' }, [
      el('h1', {}, ['Compresse et convertis tes fichiers ', el('span', { class: 'text-gradient' }, 'sans jamais les envoyer en ligne')]),
      el('p', { class: 'hero-subtitle' }, "ConvertiFacile traite tes vidéos, audios et images directement dans ton navigateur. Rien ne quitte ton ordinateur."),
      el('div', { class: 'badges' }, [
        badge('🔒', '100 % privé'),
        badge('🆓', 'Gratuit'),
        badge('✉️', 'Sans inscription'),
        badge('🚫', 'Sans filigrane'),
        badge('📚', 'Plusieurs fichiers à la fois'),
      ]),
    ])
  );

  for (const [key, label] of Object.entries(CATEGORIES)) {
    page.append(renderCategorySection(key, label));
  }

  page.append(
    el('section', { class: 'how-it-works' }, [
      el('h2', {}, 'Comment ça marche'),
      el('div', { class: 'steps' }, [
        step('1', '📂', 'Choisis un outil', 'Sélectionne le traitement qu’il te faut dans la liste ci-dessus.'),
        step('2', '⚙️', 'Ajuste les réglages', 'Formats, qualité, taille : tout se règle avant de lancer.'),
        step('3', '⬇️', 'Télécharge le résultat', 'Le traitement se fait dans ton navigateur puis tu récupères ton fichier.'),
      ]),
    ])
  );

  page.append(renderFaq());

  container.append(page);
}

function badge(icon, text) {
  return el('span', { class: 'badge-pill' }, [icon, ' ', text]);
}

function step(num, icon, title, desc) {
  return el('div', { class: 'step' }, [
    el('div', { class: 'step-number' }, num),
    el('div', { class: 'step-icon' }, icon),
    el('h3', {}, title),
    el('p', {}, desc),
  ]);
}

function renderCategorySection(categoryKey, label) {
  const tools = toolsByCategory(categoryKey);
  return el('section', { class: 'tools-section' }, [
    el('h2', {}, label),
    el(
      'div',
      { class: 'tools-grid' },
      tools.map((tool) =>
        el('a', { class: 'tool-card', href: `#/${tool.id}` }, [
          el('div', { class: 'tool-card-icon' }, tool.icon),
          el('h3', {}, tool.title),
          el('p', {}, tool.description),
        ])
      )
    ),
  ]);
}

function renderFaq() {
  const items = [
    {
      q: 'Mes fichiers sont-ils envoyés sur un serveur ?',
      a: "Non. Tout le traitement (compression, conversion, redimensionnement) se fait directement dans ton navigateur, avec FFmpeg compilé en WebAssembly. Aucun fichier n'est envoyé sur internet.",
    },
    {
      q: 'Est-ce que la qualité est dégradée ?',
      a: "Tu choisis le niveau de qualité ou de compression. Pour une qualité maximale, choisis les réglages les plus élevés (CRF bas, débit audio élevé). Il y a toujours un compromis entre taille et qualité.",
    },
    {
      q: "Y a-t-il une limite de taille ?",
      a: "Techniquement non, mais au-delà de 1,5 Go le traitement peut devenir lent ou consommer beaucoup de mémoire selon ton appareil. Les fichiers de plusieurs centaines de Mo fonctionnent bien sur un ordinateur récent.",
    },
    {
      q: 'Pourquoi le premier chargement est-il plus long ?',
      a: "Le moteur de conversion (FFmpeg WebAssembly) pèse environ 31 Mo. Il est téléchargé une seule fois par visite, puis réutilisé pour tous les outils sans être rechargé.",
    },
    {
      q: 'Est-ce que ça fonctionne hors ligne ?',
      a: "Une fois la page et le moteur chargés, oui : aucune connexion n'est nécessaire pour traiter tes fichiers, puisque tout se passe dans ton navigateur.",
    },
  ];
  return el('section', { class: 'faq' }, [
    el('h2', {}, 'Questions fréquentes'),
    el(
      'div',
      { class: 'faq-list' },
      items.map((item) =>
        el('details', { class: 'faq-item' }, [el('summary', {}, item.q), el('p', {}, item.a)])
      )
    ),
  ]);
}

function setMeta(content) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.append(tag);
  }
  tag.setAttribute('content', content);
}
