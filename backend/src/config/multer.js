const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `comprobante-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error(
        'Formato no permitido. Adjunta un comprobante PNG, JPG o PDF.'
      );
      error.code = 'INVALID_RECEIPT_TYPE';
      return cb(error);
    }

    cb(null, true);
  }
});

module.exports = upload;