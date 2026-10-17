import { useEffect, useState } from 'react';
import { BusFront, Ticket } from 'lucide-react';
import SearchTrips from './pages/Client/SearchTrips.jsx';
import SeatSelection from './pages/Client/SeatSelection.jsx';
import Checkout from './pages/Client/Checkout.jsx';
import TicketLookup from './pages/Client/TicketLookup.jsx';
import { recalledCode } from './lib/reservation.js';
import { isDemo } from './lib/api.js';

export default function App() {
  const [trip, setTrip] = useState(null);
  const [category, setCategory] = useState('');
  const [seats, setSeats] = useState([]);
  const [code, setCode] = useState('');
  const [page, setPage] = useState(() => window.location.hash === '#boleto' ? 'ticket' : 'search');
  const goSearch = () => { setTrip(null); setSeats([]); setCode(''); setPage('search'); window.location.hash = 'buscar'; window.scrollTo(0, 0); };
  const goTicket = (nextCode = '') => { setCode(nextCode); setPage('ticket'); window.location.hash = 'boleto'; window.scrollTo(0, 0); };
  useEffect(() => {
    const change = () => { if (window.location.hash === '#boleto') setPage('ticket'); else { setPage('search'); setTrip(null); setSeats([]); } };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return <>
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    {isDemo && <div className="demo-banner">Demostración · Datos ficticios. No se realizan reservas ni pagos reales. <a href="/">Salir</a></div>}
    <header className="site-header"><div className="shell header-inner"><button onClick={goSearch} className="brand" aria-label="En ruta, inicio"><span className="brand-symbol"><BusFront size={26} /></span><span>en ruta<span className="brand-sub">TRANSPORTE UTA</span></span></button><nav aria-label="Principal"><button className={`nav-link ${page === 'search' ? 'active' : ''}`} onClick={goSearch}>Buscar viaje</button><button className={`nav-link ${page === 'ticket' ? 'active' : ''}`} onClick={() => goTicket()}>Mi boleto</button></nav><span className="header-note"><Ticket size={17} /> Tu próximo viaje, a un clic</span></div></header>
    <main id="contenido" className="shell main-content">{page === 'ticket' ? <TicketLookup key={code} initialCode={code} onBack={goSearch} /> : trip && seats.length ? <Checkout trip={trip} seats={seats} onBack={() => setSeats([])} onConsult={goTicket} /> : trip ? <SeatSelection trip={trip} initialCategory={category} onBack={() => setTrip(null)} onContinue={picked => { setSeats(picked); window.scrollTo(0, 0); }} /> : <>{recalledCode() && <div className="resume-banner">¿Deseas retomar tu reserva? <button className="inline-link" onClick={() => goTicket(recalledCode())}>Consultar {recalledCode()}</button></div>}<SearchTrips onChoose={(next, filter) => { setTrip(next); setCategory(filter); window.scrollTo(0, 0); }} /></>}</main>
    <footer className="site-footer shell"><span>En ruta · Proyecto Transporte UTA</span><span>Hecho para acercarte.</span></footer>
  </>;
}
