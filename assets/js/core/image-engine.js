const MIME_BY_FORMAT = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export class ImageEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImageEngineError';
  }
}

async function decodeToBitmap(file) {
  try {
    const bitmap = await createImageBitmap(file);
    return bitmap;
  } catch (e) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(e);
        el.src = url;
      });
      return img;
    } catch {
      throw new ImageEngineError(
        `Ce fichier (${file.type || 'format inconnu'}) ne peut pas être lu par ton navigateur. ` +
          "Si c'est un fichier HEIC (photo iPhone), convertis-le d'abord en JPG depuis ton téléphone."
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function pickOutputFormat(requested, inputMime) {
  if (requested && requested !== 'auto') return requested;
  if (inputMime === 'image/png') return 'png';
  if (inputMime === 'image/webp') return 'webp';
  return 'jpg';
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageEngineError("La création de l'image a échoué."))),
      mime,
      quality
    );
  });
}

/**
 * @param {File} file
 * @param {{format?: 'auto'|'jpg'|'png'|'webp', quality?: number, maxWidth?: number|null}} options
 */
export async function processImage(file, options = {}) {
  const { format = 'auto', quality = 85, maxWidth = null } = options;
  const source = await decodeToBitmap(file);
  const srcWidth = source.width || source.naturalWidth;
  const srcHeight = source.height || source.naturalHeight;
  if (!srcWidth || !srcHeight) {
    throw new ImageEngineError('Image invalide ou vide.');
  }

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;
  if (maxWidth && maxWidth > 0 && srcWidth > maxWidth) {
    targetWidth = Math.round(maxWidth);
    targetHeight = Math.max(1, Math.round((srcHeight * targetWidth) / srcWidth));
  }

  const outputFormat = pickOutputFormat(format, file.type);
  const mime = MIME_BY_FORMAT[outputFormat] || 'image/jpeg';

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (outputFormat === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  if (source.close) source.close();

  const q = outputFormat === 'png' ? undefined : Math.min(1, Math.max(0.01, quality / 100));
  const blob = await canvasToBlob(canvas, mime, q);

  if (outputFormat === 'webp' && blob.type !== 'image/webp') {
    throw new ImageEngineError(
      "Ton navigateur ne sait pas créer de fichiers WEBP. Choisis plutôt JPG ou PNG, ou utilise une version récente de Chrome, Edge ou Firefox."
    );
  }

  const resized = targetWidth !== srcWidth || targetHeight !== srcHeight;
  const sameFormat = MIME_BY_FORMAT[outputFormat] === file.type;
  return { blob, width: targetWidth, height: targetHeight, format: outputFormat, resized, sameFormat };
}
