import { API_BASE } from './env.js';

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg|ico|jfif|heic|heif|tiff?|pjpeg|pjp|apng)$/i;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function resolveAuthToken(user) {
  if (user?.token) return user.token;
  try {
    return JSON.parse(localStorage.getItem('transporte_auth') || 'null')?.token || '';
  } catch {
    return '';
  }
}

export function validateImageFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return { files: [], error: 'Selecciona al menos una imagen.' };
  if (files.length > 10) return { files: [], error: 'Puedes subir hasta 10 imágenes a la vez.' };

  for (const file of files) {
    if (file.size <= 0) return { files: [], error: `El archivo "${file.name}" está vacío.` };
    if (file.size > MAX_IMAGE_BYTES) {
      return { files: [], error: `"${file.name}" supera el límite de 15 MB.` };
    }
    const isImageMime = typeof file.type === 'string' && file.type.toLowerCase().startsWith('image/');
    const isImageExt = IMAGE_EXT_RE.test(file.name || '');
    if (!isImageMime && !isImageExt) {
      return { files: [], error: `"${file.name}" no parece ser una imagen válida.` };
    }
  }

  return { files, error: '' };
}

export async function uploadAdminImages(user, fileList) {
  const { files, error } = validateImageFiles(fileList);
  if (error) throw new Error(error);

  const token = resolveAuthToken(user);
  if (!token) throw new Error('Inicia sesión como administrador para subir imágenes.');

  const body = new FormData();
  files.forEach((file) => body.append('imagenes', file));

  const response = await fetch(`${API_BASE}/admin/imagenes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `No se pudo subir la imagen (${response.status}).`);
  }

  const urls = Array.isArray(data?.urls) ? data.urls : (data?.url ? [data.url] : []);
  if (!urls.length) throw new Error('El servidor no devolvió la ruta de la imagen subida.');
  return urls;
}
