# ConvertiFacile

Outil gratuit pour compresser et convertir des vidéos, des audios et des images,
**entièrement dans le navigateur**. Aucun fichier n'est jamais envoyé sur internet :
tout le traitement se fait localement grâce à FFmpeg compilé en WebAssembly et à l'API Canvas.

11 outils : compresser / convertir / couper une vidéo, vidéo en GIF, supprimer le son,
vidéo en MP3, convertir / compresser un audio, compresser / convertir / redimensionner une image.

## Qualité : ce que font les réglages par défaut

Les réglages par défaut sont pensés pour **ne pas toucher à la qualité** :

- **Résolution d'origine conservée** : une vidéo 4K reste en 4K, une vidéo HD reste en HD.
  Le site ne réduit jamais l'image sauf si tu choisis une autre résolution, et il ne l'agrandit jamais.
- **Image visuellement identique** : niveau de qualité CRF 18 (H.264).
- **Son d'origine copié tel quel**, sans réencodage. Si le format de sortie ne l'accepte pas,
  il est réencodé en AAC 256 kb/s.
- **Durée, cadence d'images et orientation** (vidéos verticales) inchangées.
- Si le résultat est plus lourd que l'original (vidéo déjà très optimisée), le site le signale
  et conseille de garder l'original.
- Images : qualité 90–92 % par défaut. Si la compression n'apporte aucun gain, le fichier
  d'origine est rendu intact.
- Audio : en mode automatique, un WAV est compressé en FLAC (sans aucune perte).

Compresser sans **aucune** modification des données est impossible : toute compression vidéo
change les pixels. Le niveau 18 donne une image qu'on ne distingue pas de l'original à l'œil,
ce que vérifient les tests ci-dessous (score SSIM 0,997, où 1 = identique).

## Quitter la page pendant une conversion

- **Aller sur une autre page du site** (accueil, autre outil) : la conversion **continue**. Une barre
  en haut de chaque page montre la progression ; quand c'est fini, elle devient verte et un clic
  ramène aux fichiers à télécharger. Le pourcentage s'affiche aussi dans le titre de l'onglet.
- **Lancer un autre outil pendant ce temps** : sa conversion se met **en file d'attente** et démarre
  automatiquement après celle en cours. « Arrêter » n'arrête que l'outil sur lequel on clique.
- **Passer à un autre onglet ou une autre application sur ordinateur** : la conversion tourne dans un
  processus séparé (Web Worker) que les navigateurs ne mettent pas en pause. Attention : les modes
  d'économie de Chrome (« Économiseur de mémoire ») et d'Edge (« onglets en veille ») peuvent endormir un
  onglet inactif depuis longtemps ; ajoute le site à leurs exceptions pour les très longues conversions.
- **Sur téléphone** : l'écran reste allumé pendant la conversion. Si tu quittes le navigateur ou
  verrouilles l'écran, le téléphone met la page en pause ; elle reprend à ton retour, sauf si le
  système a fermé l'onglet pour libérer de la mémoire.
- **Fermer l'onglet ou le navigateur** arrête la conversion (tout se passe dans l'onglet, il n'y a pas
  de serveur). Le site demande une confirmation avant de fermer pendant une conversion.

## Lancer le site en local

Le site est 100 % statique (HTML/CSS/JS, aucune étape de build), mais il doit être servi par
un petit serveur HTTP local. Ouvrir `index.html` directement (`file://`) ne fonctionne pas, à
cause des modules JavaScript et du moteur FFmpeg.

```bash
python -m http.server 8080
```

Puis ouvre **http://localhost:8080** dans ton navigateur.

## Publier sur GitHub Pages

1. Crée un nouveau dépôt **public** nommé `convertifacile` sur GitHub.
2. Envoie le contenu de ce dossier (par exemple avec « Add file → Upload files » sur GitHub,
   ou en ligne de commande) :
   ```bash
   git init
   git add .
   git commit -m "Premier envoi de ConvertiFacile"
   git branch -M main
   git remote add origin https://github.com/TON-UTILISATEUR/convertifacile.git
   git push -u origin main
   ```
3. Sur GitHub, va dans **Settings → Pages**.
4. Dans « Build and deployment », choisis **Deploy from a branch**.
5. Choisis la branche **main** et le dossier **/ (root)**, puis **Save**.
6. Après une à deux minutes, le site est en ligne à l'adresse
   `https://TON-UTILISATEUR.github.io/convertifacile/`.

Le fichier `.nojekyll` est déjà présent à la racine. Le plus gros fichier
(`vendor/core/ffmpeg-core.wasm`, ~31 Mo) reste sous la limite de 100 Mo de GitHub.

## Structure

```
index.html               Page unique (navigation par #/nom-outil)
assets/css/style.css     Design
assets/js/app.js         Démarrage et routes
assets/js/core/          Moteur FFmpeg, moteur image (Canvas), zip, interface partagée
assets/js/core/tools/    Logique de chacun des 11 outils
assets/js/pages/home.js  Page d'accueil
vendor/                  @ffmpeg/ffmpeg 0.12.10, @ffmpeg/util 0.12.1, @ffmpeg/core 0.12.6
                         (mono-thread), fflate — copiés localement, aucun CDN
.nojekyll                Pour GitHub Pages
```

## Résultats des tests

Tests automatiques Playwright (navigateur Microsoft Edge/Chromium) sur le site servi en local,
avec des fichiers générés par FFmpeg. Chaque sortie est relue par FFmpeg pour vérifier qu'elle
est lisible et que sa durée et sa résolution sont correctes. **27/27 réussis**, plus un test
séparé sur un fichier 4K de 1 Go (`tests/run-1go-test.mjs`), réussi lui aussi.

| Outil | Fichier d'entrée | Avant | Après | Vérification |
|---|---|---|---|---|
| **Compresser une vidéo — fichier de 1 Go** | caméra 4K, 1 min 45 s, 78 Mbit/s | 983 Mo | 411 Mo (−58 %) | 3840×2160 conservé, SSIM 0,997 sur toute la durée, son AAC d'origine, durée identique, 38,6 min |
| Compresser une vidéo (qualité stricte) | caméra 4K, 80 Mbit/s | 37,9 Mo | 15,8 Mo (−58 %) | 3840×2160 conservé, SSIM 0,997, son AAC d'origine, durée identique |
| Compresser une vidéo (qualité stricte) | caméra 1080p, 21 Mbit/s | 12,3 Mo | 5,3 Mo (−57 %) | 1920×1080 conservé, SSIM 0,997, son AAC d'origine, durée identique |
| Compresser une vidéo (qualité, défaut) | MP4 720p déjà compressé | 2,3 Mo | 2,8 Mo | Lisible ; plus lourd car déjà optimisé → avertissement affiché |
| Compresser une vidéo (taille cible 0,5 Mo) | MP4 720p | 2,3 Mo | 432 Ko | Proche de la cible |
| Compresser une vidéo (verticale, 720p) | MP4 720×1280 | 1,6 Mo | 2,0 Mo | Reste 720×1280, non déformée |
| Convertir une vidéo → WEBM | MP4 720p | 2,3 Mo | 6,0 Mo | Lisible, 1280×720 |
| Convertir une vidéo → MKV | MP4 720p | 2,3 Mo | 2,8 Mo | Lisible, 1280×720 |
| Convertir une vidéo → AVI | MP4 720p | 2,3 Mo | 6,8 Mo | Lisible, 1280×720 |
| Convertir une vidéo (2 fichiers) | MP4 720p + verticale | — | — | 2/2 terminés |
| Vidéo en GIF | MP4 720p | 2,3 Mo | 785 Ko | 5 s, 480×270 |
| Couper une vidéo (1 s → 3 s) | MP4 720p | 2,3 Mo | 990 Ko | Durée 2 s, 1280×720 |
| Supprimer le son | MP4 720p | 2,3 Mo | 2,2 Mo | Vidéo copiée sans réencodage |
| Vidéo en MP3 | MP4 720p | 2,3 Mo | 143 Ko | Durée 6 s |
| Convertir un audio | WAV | 345 Ko | 96 Ko | MP3 lisible |
| Convertir un audio | OPUS (type note vocale WhatsApp) | 32 Ko | 71 Ko | MP3 lisible |
| Compresser un audio | WAV | 345 Ko | 55 Ko | FLAC sans perte |
| Quitter la page pendant la conversion | caméra 1080p | 12,3 Mo | 5,3 Mo | Conversion terminée hors de la page, barre de progression visible, fichier récupéré au retour (1920×1080) |
| File d'attente entre deux outils | caméra 1080p + MP4 720p | — | — | Le 2e outil attend son tour ; « Arrêter » n'arrête que lui |
| Fermer l'onglet pendant une conversion | — | — | — | Le navigateur demande confirmation |
| Compresser une image | PNG 1920×1080 | 226 Ko | 226 Ko | Déjà optimisée → original rendu intact |
| Convertir une image → WEBP | PNG 1920×1080 | 226 Ko | 73 Ko | Lisible |
| Redimensionner une image (400 px) | PNG 1920×1080 | 226 Ko | 26 Ko | Largeur ≤ 400 px |

Vitesse mesurée sur la machine de test : environ 1,4 image/s en 4K et 3 à 4 images/s en 1080p.

Pour relancer les tests (nécessite Node.js) :

```bash
npm install
npm run fixtures
npm test
```

Ces fichiers de test (`package.json`, `scripts/`, `tests/`) ne font pas partie du site : ils sont
dans le dossier de travail, pas dans le dossier `convertifacile/` à publier.

## Limites connues

- **Vitesse** : le moteur tourne sur un seul cœur du processeur (version mono-thread, imposée
  par GitHub Pages). Mesuré : une vidéo 4K de 1 Go (1 min 45 s de film) a pris **38,6 minutes**
  sur le PC de test. C'est bien plus long sur un ordinateur ancien ou un téléphone. Il faut
  laisser l'onglet ouvert pendant le traitement.
- **Mémoire** : le fichier d'entrée est lu directement depuis le disque (WORKERFS) ; le fichier
  produit est gardé en mémoire dans le navigateur. Un fichier 4K de 1 Go passe sans problème
  sur ordinateur (testé). Au-delà de 1,5 Go, ou sur téléphone, la mémoire peut manquer : un
  message clair s'affiche alors.
- **HDR** : les vidéos HDR (souvent la 4K iPhone) sont converties en couleurs standard (SDR,
  8 bits). Le moteur du navigateur ne peut pas conserver le HDR.
- **WEBM** utilise le codec VP8 : le codec VP9 plante dans cette version de FFmpeg WebAssembly.
  Après tout plantage, le moteur redémarre automatiquement.
- **HEIC** (photos iPhone) : la plupart des navigateurs ne savent pas les lire ; un message
  invite à les exporter en JPG depuis le téléphone.
- **WEBP** : la création dépend du navigateur ; un message s'affiche si ce n'est pas possible.
- Le premier traitement télécharge le moteur (~31 Mo), une seule fois par visite.
- La « conversion rapide sans réencodage » repasse automatiquement en réencodage si le format
  de destination n'accepte pas le codec d'origine.
- Les tests utilisent des mires et des tonalités générées, pas de vrais fichiers de caméra.
