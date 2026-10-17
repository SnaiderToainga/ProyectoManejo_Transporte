import { useState } from 'react';
import { BusFront, Ticket } from 'lucide-react';
import SearchTrips from './pages/Client/SearchTrips.jsx';
import SeatSelection from './pages/Client/SeatSelection.jsx';
import Checkout from './pages/Client/Checkout.jsx';
import { isDemo } from './lib/api.js';

export default function App() {
  const [trip, setTrip] = useState(null);
  const [category, setCategory] = useState('');
  const [seats, setSeats] = useState([]);
  const [code, setCode] = useState('');
  return <>
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    {isDemo && <div className="demo-banner">Demostración · Datos ficticios. No se realizan reservas ni pagos reales. <a href="/">Salir</a></div>}
    <header className="site-header"><div className="shell header-inner"><a href="./" className="brand" aria-label="En ruta, inicio"><span className="brand-symbol"><BusFront size={26} /></span><span>en ruta<span className="brand-sub">TRANSPORTE UTA</span></span></a><nav aria-label="Principal"><button className="nav-link active" onClick={() => setTrip(null)}>Buscar viaje</button></nav><span className="header-note"><Ticket size={17} /> Tu próximo viaje, a un clic</span></div></header>
    <main id="contenido" className="shell main-content">{code ? <div className="panel"><h2>Reserva {code}</h2><p>Tu comprobante fue procesado. Conserva tu código para consultar el boleto.</p></div> : trip && seats.length ? <Checkout trip={trip} seats={seats} onBack={() => setSeats([])} onConsult={setCode} /> : trip ? <SeatSelection trip={trip} initialCategory={category} onBack={() => setTrip(null)} onContinue={picked => { setSeats(picked); window.scrollTo(0, 0); }} /> : <SearchTrips onChoose={(next, filter) => { setTrip(next); setCategory(filter); window.scrollTo(0, 0); }} />}</main>
    <footer className="site-footer shell"><span>En ruta · Proyecto Transporte UTA</span><span>Hecho para acercarte.</span></footer>
  </>;
}
