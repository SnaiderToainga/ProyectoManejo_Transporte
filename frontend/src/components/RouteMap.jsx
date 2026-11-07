import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Info } from 'lucide-react';

// Coordenadas geográficas oficiales de ciudades y terminales en Ecuador
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
  'Machala': [-3.2586, -79.9554]
};

// Paradas intermedias frecuentes según resolución ANT
const PARADAS_INTERMEDIAS = {
  'Pelileo-Ambato': [
    { nombre: 'Salasaca (Parada Artesanal)', coord: [-1.2917, -78.5806] },
    { nombre: 'Totoras', coord: [-1.2650, -78.5980] }
  ],
  'Ambato-Quito': [
    { nombre: 'Latacunga (Terminal)', coord: [-0.9333, -78.6167] },
    { nombre: 'Machachi (Peaje)', coord: [-0.5100, -78.5670] }
  ],
  'Ambato-Guayaquil': [
    { nombre: 'Pallatanga', coord: [-1.9833, -78.9667] },
    { nombre: 'Bucay', coord: [-2.2000, -79.1333] }
  ]
};

function resolverCoord(ciudad) {
  if (!ciudad) return null;
  const c = ciudad.trim();
  for (const [key, val] of Object.entries(COORDENADAS_ECUADOR)) {
    if (c.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(c.toLowerCase())) {
      return val;
    }
  }
  return null;
}

export default function RouteMap({ origen, destino, tipoServicio = 'DIRECTO', cooperativa = '' }) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);

  const coordOrigen = resolverCoord(origen) || COORDENADAS_ECUADOR['Pelileo'];
  const coordDestino = resolverCoord(destino) || COORDENADAS_ECUADOR['Ambato'];

  const rutaKey = `${origen}-${destino}`;
  const rutaKeyInvertida = `${destino}-${origen}`;
  const paradas = (tipoServicio === 'PARADAS' || tipoServicio?.includes('PARADAS'))
    ? (PARADAS_INTERMEDIAS[rutaKey] || PARADAS_INTERMEDIAS[rutaKeyInvertida] || [])
    : [];

  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    // Inicializar mapa centrado en Tungurahua / Ecuador
    const map = L.map(mapContainer.current, {
      center: [-1.28, -78.58],
      zoom: 11,
      scrollWheelZoom: false
    });
    mapInstance.current = map;

    // Capa de mosaicos OpenStreetMap estándar (100% gratuita y sin API keys)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Iconos personalizados con estilos SVG limpios
    const createCustomIcon = (bgColor, label) => L.divIcon({
      className: 'custom-map-marker',
      html: `<div style="background-color: ${bgColor}; color: white; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; box-shadow: 0 3px 6px rgba(0,0,0,0.3);">${label}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const startIcon = createCustomIcon('#15803d', 'A');
    const endIcon = createCustomIcon('#b91c1c', 'B');
    const stopIcon = createCustomIcon('#1e40af', '•');

    // Marcador Origen
    const markerOrigen = L.marker(coordOrigen, { icon: startIcon }).addTo(map);
    markerOrigen.bindPopup(`<strong>Origen: ${origen || 'Punto de Partida'}</strong><br/>Terminal Autorizado ANT`);

    // Marcador Destino
    const markerDestino = L.marker(coordDestino, { icon: endIcon }).addTo(map);
    markerDestino.bindPopup(`<strong>Destino: ${destino || 'Punto de Llegada'}</strong><br/>Terminal Terrestre Oficial`);

    // Marcadores de paradas intermedias
    const puntosRuta = [coordOrigen];
    paradas.forEach((p) => {
      const m = L.marker(p.coord, { icon: stopIcon }).addTo(map);
      m.bindPopup(`<strong>Parada Intermedia:</strong><br/>${p.nombre}<br/><em>Modalidad con Paradas</em>`);
      puntosRuta.push(p.coord);
    });
    puntosRuta.push(coordDestino);

    // Trazar línea de ruta interprovincial
    const polyline = L.polyline(puntosRuta, {
      color: '#1e3a8a',
      weight: 5,
      opacity: 0.85,
      dashArray: tipoServicio === 'PARADAS' ? '6, 8' : undefined
    }).addTo(map);

    // Ajustar vista para abarcar todos los puntos
    try {
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } catch {}

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [origen, destino, tipoServicio]);

  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={18} color="#1e3a8a" />
          <strong style={{ fontSize: '14px', color: '#1e293b' }}>
            Mapa Oficial de Frecuencia ANT: {origen || 'Origen'} &rarr; {destino || 'Destino'}
          </strong>
        </div>
        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '9999px', fontWeight: 'bold', backgroundColor: tipoServicio === 'DIRECTO' ? '#dcfce7' : '#e0e7ff', color: tipoServicio === 'DIRECTO' ? '#166534' : '#3730a3' }}>
          {tipoServicio === 'DIRECTO' ? 'Ruta Directa (Sin Paradas)' : 'Frecuencia con Paradas Intermedias'}
        </span>
      </div>

      <div ref={mapContainer} style={{ width: '100%', height: '260px' }} />

      <div style={{ padding: '10px 16px', backgroundColor: '#ffffff', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9' }}>
        <Info size={15} color="#3b82f6" />
        <span>
          {tipoServicio === 'DIRECTO'
            ? 'Servicio expreso directo de terminal a terminal según Resolución Oficial de la ANT.'
            : 'Frecuencia corriente con habilitación para paradas intermedias de embarque y desembarque.'}
        </span>
      </div>
    </div>
  );
}
