import { useEffect, useRef } from 'react';

export default function Modal({ title, children, onClose }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="cr01-modal" aria-label={title}
    onCancel={event => { event.preventDefault(); close.current?.(); }}>
    <header className="cr01-modal-header"><h2>{title}</h2><button type="button" className="button secondary" aria-label="Cerrar ventana" disabled={!onClose} onClick={onClose}>✕</button></header>
    {children}
  </dialog>;
}
