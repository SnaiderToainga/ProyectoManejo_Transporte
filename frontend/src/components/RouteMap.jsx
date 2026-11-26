import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Info } from 'lucide-react';
import { normalize } from '../lib/format.js';

const COORDENADAS_ECUADOR = {
  'Pelileo': [-1.3325, -78.5439],
  'Ambato': [-1.2491, -78.6168],
  'Salasaca': [-1.2917, -78.5806],
  'Baños': [-1.3964, -78.4247],
  'Quito': [-0.2298, -78.5249],
  'Quito (Quitumbe)': [-0.2922, -78.5528],
  'Quito (Carcelén)': [-0.1069, -78.4839],
  'Latacunga': [-0.9333, -78.6167],
  'Riobamba': [-1.6709, -78.6471],
  'Guayaquil': [-2.1894, -79.8891],
  'Cuenca': [-2.9001, -79.0059],
  'Loja': [-3.9931, -79.2042],
  'Puyo': [-1.4883, -77.9986],
  'Machala': [-3.2586, -79.9554],
  'Manta': [-0.9677, -80.7089],
  'Portoviejo': [-1.0546, -80.4545],
  'Ibarra': [0.3517, -78.1223],
  'Otavalo': [0.2346, -78.2625],
  'Tulcán': [0.8119, -77.7173],
  'Esmeraldas': [0.9682, -79.6517],
  'Santo Domingo': [-0.2531, -79.1754],
  'Guaranda': [-1.5926, -79.0010],
  'Azogues': [-2.7397, -78.8486],
  'Tena': [-0.9938, -77.8129],
  'Macas': [-2.3087, -78.1114],
  'Quevedo': [-1.0286, -79.4635],
  'Babahoyo': [-1.8022, -79.5344],
  'Salinas': [-2.2145, -80.9515],
  'Cayambe': [0.0408, -78.1452],
  'Nueva Loja': [0.0847, -76.8828],
  'Salcedo': [-1.0455, -78.5906],
  'Machachi': [-0.5101, -78.5671],
  'Alausi': [-2.2033, -78.8471]
};

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolverCoord(ciudad) {
  if (!ciudad) return null;
  const clean = normalize(ciudad);
  for (const [key, val] of Object.entries(COORDENADAS_ECUADOR)) {
    const normKey = normalize(key);
    if (clean === normKey) return val;
  }
  for (const [key, val] of Object.entries(COORDENADAS_ECUADOR)) {
    const normKey = normalize(key);
    if (clean.includes(normKey) || normKey.includes(clean)) return val;
  }
  return null;
}

export default function RouteMap({
  origen,
  destino,
  tipoServicio = 'DIRECTO',
  paradasIntermedias = [],
  cooperativa = '',
  numeroDisco = '',
  horaSalida = '',
  compact = false
}) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);

  const coordOrigen = resolverCoord(origen) || COORDENADAS_ECUADOR['Ambato'];
  const coordDestino = resolverCoord(destino) || COORDENADAS_ECUADOR['Quito'];

  const paradasReales = Array.isArray(paradasIntermedias)
    ? paradasIntermedias
        .map((nombre) => ({ nombre, coord: resolverCoord(nombre) }))
        .filter((p) => Boolean(p.coord))
    : [];

  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapContainer.current, {
      center: [-1.28, -78.58],
      zoom: 11,
      scrollWheelZoom: false
    });
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const createCustomIcon = (bgColor, label) => L.divIcon({
      className: 'custom-map-marker',
      html: `<div style="background-color: ${bgColor}; color: white; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${label}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const startIcon = createCustomIcon('#15803d', 'A');
    const endIcon = createCustomIcon('#b91c1c', 'B');
    const stopIcon = createCustomIcon('#1e40af', '•');

    const safeOrigen = escapeHtml(origen || 'Punto de Partida');
    const safeDestino = escapeHtml(destino || 'Punto de Llegada');
    const safeCoop = escapeHtml(cooperativa || 'Terminal Autorizado ANT');

    const markerOrigen = L.marker(coordOrigen, { icon: startIcon }).addTo(map);
    markerOrigen.bindPopup(`<strong>Origen: ${safeOrigen}</strong><br/>${safeCoop}`);

    const markerDestino = L.marker(coordDestino, { icon: endIcon }).addTo(map);
    markerDestino.bindPopup(`<strong>Destino: ${safeDestino}</strong><br/>Terminal Terrestre Oficial`);

    const puntosRuta = [coordOrigen];
    paradasReales.forEach((p, idx) => {
      const m = L.marker(p.coord, { icon: stopIcon }).addTo(map);
      m.bindPopup(`<strong>Parada ${idx + 1}:</strong><br/>${escapeHtml(p.nombre)}<br/><em>Modalidad con Paradas</em>`);
      puntosRuta.push(p.coord);
    });
    puntosRuta.push(coordDestino);

    const isDashed = tipoServicio === 'PARADAS' || paradasReales.length > 0;
    const polyline = L.polyline(puntosRuta, {
      color: '#1e3a8a',
      weight: 5,
      opacity: 0.85,
      dashArray: isDashed ? '6, 8' : undefined
    }).addTo(map);

    const frame = requestAnimationFrame(() => {
      try {
        map.invalidateSize();
        map.fitBounds(polyline.getBounds(), { padding: [40, 40], animate: false });
      } catch {}
    });

    return () => {
      cancelAnimationFrame(frame);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [origen, destino, tipoServicio, cooperativa, JSON.stringify(paradasIntermedias)]);

  const isParadas = tipoServicio === 'PARADAS' || String(tipoServicio || '').includes('PARADAS') || paradasReales.length > 0;
  const metaBits = [
    cooperativa,
    numeroDisco ? `Unidad #${numeroDisco}` : '',
    horaSalida ? `Salida ${horaSalida}` : ''
  ].filter(Boolean);

  return (
    <div className="route-map-panel" style={{ marginTop: compact ? '0.75rem' : '1.5rem', marginBottom: compact ? '0.25rem' : '1.5rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={17} color="#1e3a8a" />
            <strong style={{ fontSize: '14px', color: '#1e293b' }}>
              Ruta: {origen || 'Origen'} &rarr; {destino || 'Destino'}
            </strong>
          </div>
          {metaBits.length > 0 && (
            <span style={{ fontSize: '12px', color: '#475569', paddingLeft: '25px' }}>
              {metaBits.join(' · ')}
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '9999px', fontWeight: 'bold', backgroundColor: isParadas ? '#e0e7ff' : '#dcfce7', color: isParadas ? '#3730a3' : '#166534' }}>
          {isParadas ? 'Con Paradas Intermedias' : 'Ruta Directa'}
        </span>
      </div>

      <div ref={mapContainer} style={{ width: '100%', height: compact ? '230px' : '260px' }} />

      <div style={{ padding: '9px 14px', backgroundColor: '#ffffff', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
        <Info size={15} color="#3b82f6" />
        <span>
          {paradasReales.length > 0
            ? `Trazado completo: ${[origen, ...paradasReales.map(p => p.nombre), destino].filter(Boolean).join(' → ')}.`
            : isParadas
              ? 'Frecuencia corriente con habilitación para paradas intermedias de embarque y desembarque.'
              : 'Servicio expreso directo de terminal a terminal según Resolución Oficial de la ANT.'}
        </span>
      </div>
    </div>
  );
}
