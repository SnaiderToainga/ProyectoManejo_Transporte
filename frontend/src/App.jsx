import { useState } from 'react';
import { BusFront, Ticket } from 'lucide-react';
import SearchTrips from './pages/Client/SearchTrips.jsx';
import { isDemo } from './lib/api.js';

export default function App() {
  const [trip, setTrip] = useState(null);
  return <>
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    {isDemo && <div className="demo-banner">Demostración · Datos ficticios. No se realizan reservas ni pagos reales. <a href="/">Salir</a></div>}
    <header className="site-header"><div className="shell header-inner"><a href="./" className="brand" aria-label="En ruta, inicio"><span className="brand-symbol"><BusFront size={26} /></span><span>en ruta<span className="brand-sub">TRANSPORTE UTA</span></span></a><nav aria-label="Principal"><button className="nav-link active" onClick={() => setTrip(null)}>Buscar viaje</button></nav><span className="header-note"><Ticket size={17} /> Tu próximo viaje, a un clic</span></div></header>
    <main id="contenido" className="shell main-content">{trip ? <section className="panel"><h1>{trip.origen} → {trip.destino}</h1><p>Viaje seleccionado</p><button className="button secondary" onClick={() => setTrip(null)}>Volver a viajes</button></section> : <SearchTrips onChoose={setTrip} />}</main>
    <footer className="site-footer shell"><span>En ruta · Proyecto Transporte UTA</span><span>Hecho para acercarte.</span></footer>
  </>;
}
