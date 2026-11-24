import Modal from './Modal.jsx';
import { safeImageUrl } from '../lib/cooperativeForm.js';

export default function BusDetails({ bus, onClose }) {
  const photos = [...new Set([...(Array.isArray(bus.fotos) ? bus.fotos : []), bus.foto_url].map(photo =>
    safeImageUrl(typeof photo === 'string' ? photo : photo?.url)).filter(Boolean))];
  const fields = [['Cooperativa', bus.cooperativa_nombre], ['Placa', bus.placa], ['Capacidad', bus.capacidad ? `${bus.capacidad} asientos` : ''],
    ['Marca de chasis', bus.marca_chasis], ['Carrocería', bus.carroceria], ['Modelo', bus.modelo], ['Año', bus.anio],
    ['Socio / propietario', bus.socio_nombre || bus.socio?.nombre], ['Servicio', bus.tipo_servicio],
    ['Baño posterior', bus.tiene_bano_posterior === true ? 'Sí' : bus.tiene_bano_posterior === false ? 'No' : '']];
  return <Modal title={`Ficha del bus · Unidad ${bus.numero_disco ?? 'sin número'}`} onClose={onClose}>
    {photos.length ? <div className="cr01-gallery">{photos.map((url, index) => <img key={url} src={url} alt={`Bus ${bus.numero_disco}, fotografía ${index + 1}`} loading="lazy" />)}</div> : <p>No hay fotografías registradas para esta unidad.</p>}
    <dl className="bank-details">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'No registrado'}</dd></div>)}</dl>
  </Modal>;
}
