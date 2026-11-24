import { useRef, useState } from 'react';
import { Upload, ImagePlus, Loader2, CheckCircle2 } from 'lucide-react';
import { uploadAdminImages } from '../lib/mediaUpload.js';

export default function ImageUploadControl({
  user,
  multiple = false,
  disabled = false,
  compact = false,
  buttonLabel = multiple ? 'Subir imágenes desde tu dispositivo' : 'Subir imagen desde tu dispositivo',
  hint = 'Cualquier formato de imagen (JPG, PNG, WEBP, GIF, AVIF, SVG, HEIC…) · máx. 15 MB',
  onUploaded
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function processFiles(fileList) {
    if (!fileList || fileList.length === 0 || uploading || disabled) return;
    setUploading(true);
    setError('');
    setSuccessMsg('');
    try {
      const selected = multiple ? fileList : [fileList[0]];
      const urls = await uploadAdminImages(user, selected);
      if (onUploaded) onUploaded(urls);
      setSuccessMsg(
        urls.length === 1
          ? 'Imagen cargada correctamente.'
          : `${urls.length} imágenes cargadas correctamente.`
      );
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (disabled || uploading) return;
    processFiles(event.dataTransfer?.files);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={disabled || uploading}
        onChange={(event) => processFiles(event.target.files)}
        style={{ display: 'none' }}
      />

      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-label={buttonLabel}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled && !uploading) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'space-between' : 'center',
          flexDirection: compact ? 'row' : 'column',
          gap: compact ? '0.65rem' : '0.35rem',
          flexWrap: 'wrap',
          padding: compact ? '0.6rem 0.85rem' : '0.9rem 1rem',
          borderRadius: '10px',
          border: `1.5px dashed ${dragActive ? '#2563EB' : '#94A3B8'}`,
          background: dragActive ? '#EFF6FF' : '#F8FAFC',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          textAlign: compact ? 'left' : 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1E293B', fontWeight: 700, fontSize: '0.84rem' }}>
          {uploading ? (
            <Loader2 size={17} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
          ) : multiple ? (
            <ImagePlus size={17} color="#2563EB" />
          ) : (
            <Upload size={17} color="#2563EB" />
          )}
          <span>{uploading ? 'Subiendo imagen…' : buttonLabel}</span>
        </div>

        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
          {compact ? 'Haz clic o arrastra aquí (JPG, PNG, WEBP, SVG…)' : `Arrastra archivos aquí o haz clic · ${hint}`}
        </span>
      </div>

      {successMsg && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
          <CheckCircle2 size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <span role="alert" className="inline-error" style={{ fontSize: '0.78rem' }}>
          {error}
        </span>
      )}
    </div>
  );
}
