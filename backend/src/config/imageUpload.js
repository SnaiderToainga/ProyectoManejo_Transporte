const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaDir = path.join(__dirname, '../../uploads/media');

if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif',
  '.bmp', '.svg', '.ico', '.jfif', '.heic', '.heif',
  '.tif', '.tiff', '.pjpeg', '.pjp', '.apng'
]);

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/tiff': '.tiff',
  'image/apng': '.apng'
};

function resolveSafeExtension(file) {
  const rawExt = path.extname(file.originalname || '').toLowerCase();
  if (IMAGE_EXTENSIONS.has(rawExt)) return rawExt;
  const fromMime = MIME_TO_EXT[(file.mimetype || '').toLowerCase()];
  if (fromMime) return fromMime;
  if (/^\.[a-z0-9]{2,6}$/.test(rawExt) && (file.mimetype || '').toLowerCase().startsWith('image/')) {
    return rawExt;
  }
  return '.png';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    cb(null, mediaDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `img-${uniqueSuffix}${resolveSafeExtension(file)}`);
  }
});

const uploadAdminImages = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isImageMime = mime.startsWith('image/');
    const isImageExt = IMAGE_EXTENSIONS.has(ext);

    if (!isImageMime && !isImageExt) {
      const error = new Error('El archivo seleccionado no es una imagen válida.');
      error.code = 'INVALID_IMAGE_TYPE';
      return cb(error);
    }

    cb(null, true);
  }
});

module.exports = uploadAdminImages;
