import { useEffect, useState } from 'react';
import { BusFront, Ticket, Shield } from 'lucide-react';
import SearchTrips from './pages/Client/SearchTrips.jsx';
import SeatSelection from './pages/Client/SeatSelection.jsx';
import Checkout from './pages/Client/Checkout.jsx';
import TicketLookup from './pages/Client/TicketLookup.jsx';
import Login from './pages/Admin/Login.jsx';
import GestionCooperativas from './pages/Admin/GestionCooperativas.jsx';
import OfficeDashboard from './pages/Office/OfficeDashboard';
import { recalledCode } from './lib/reservation.js';
import { isDemo } from './lib/api.js';
import { canAccessOffice } from './lib/authGuard.js';

export default function App() {
  const [trip, setTrip] = useState(null);
  const [category, setCategory] = useState('');
  const [seats, setSeats] = useState([]);
  const [code, setCode] = useState('');

  // Detección inicial de página por URL o hash con guardián de ruta
  const getInitialPage = () => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    let auth = null;
    try {
      auth = JSON.parse(localStorage.getItem('transporte_auth'));
    } catch {}

    if (path === '/admin' || hash === '#admin') return 'admin';
    if (path === '/login' || hash === '#login') return 'login';
    if (path === '/oficina' || hash === '#oficina') {
      if (!canAccessOffice(auth)) {
        window.location.hash = 'login';
        return 'login';
      }
      return 'oficina';
    }
    if (hash === '#boleto') return 'ticket';
    return 'search';
  };



  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('transporte_auth'));
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState(getInitialPage);

  const goSearch = () => {
    setTrip(null);
    setSeats([]);
    setCode('');
    setPage('search');
    window.location.hash = 'buscar';
    window.scrollTo(0, 0);
  };

  const goTicket = (nextCode = '') => {
    setCode(nextCode);
    setPage('ticket');
    window.location.hash = 'boleto';
    window.scrollTo(0, 0);
  };

  const goLogin = (msg = '') => {
    setAuthError(msg);
    setPage('login');
    window.location.hash = 'login';
    window.scrollTo(0, 0);
  };

  const goAdmin = () => {
    setPage('admin');
    window.location.hash = 'admin';
    window.scrollTo(0, 0);
  };

  const goOficina = () => {
    if (!canAccessOffice(usuario)) {
      goLogin('Acceso restringido a personal de taquilla autorizado');
      return;
    }
    setAuthError('');
    setPage('oficina');
    window.location.hash = 'oficina';
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const change = () => {
      const hash = window.location.hash;
      if (hash === '#admin') {
        setPage('admin');
      } else if (hash === '#login') {
        setPage('login');
      } else if (hash === '#oficina') {
        const storedUser = (() => {
          try {
            return JSON.parse(localStorage.getItem('transporte_auth'));
          } catch {
            return null;
          }
        })();
        if (!canAccessOffice(storedUser)) {
          setAuthError('Acceso restringido a personal de taquilla autorizado');
          setPage('login');
          window.location.hash = 'login';
          return;
        }
        setAuthError('');
        setPage('oficina');
      } else if (hash === '#boleto') {
        setPage('ticket');
      } else {
        setPage('search');
        setTrip(null);
        setSeats([]);
      }
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);

  return (
    <>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {isDemo && (
        <div className="demo-banner">
          Demostración · Datos de transporte interprovincial UTA. No se realizan cobros reales.{' '}
          <a href="/">Salir</a>
        </div>
      )}

      <header className="site-header">
        <div className="shell header-inner">
          <button onClick={goSearch} className="brand" aria-label="En ruta, inicio">
            <span className="brand-symbol">
              <BusFront size={26} />
            </span>
            <span>
              en ruta<span className="brand-sub">TRANSPORTE UTA</span>
            </span>
          </button>

          <nav aria-label="Principal">
            <button className={`nav-link ${page === 'search' ? 'active' : ''}`} onClick={goSearch}>
              Buscar viaje
            </button>
            <button className={`nav-link ${page === 'ticket' ? 'active' : ''}`} onClick={() => goTicket()}>
              Mi boleto
            </button>
            {usuario && (usuario.rol === 'OFICINISTA' || usuario.rol === 'SUPERADMIN') && (
              <button className={`nav-link ${page === 'oficina' ? 'active' : ''}`} onClick={goOficina}>
                Taquilla / Oficina
              </button>
            )}
           <button
            className={`nav-link ${page === 'admin' || page === 'login' ? 'active' : ''}`}
            onClick={() => {
            if (usuario) {
            // Si ya hay sesión, permite cerrar sesión o ir a admin
            if (confirm(`Sesión activa como: ${usuario.nombre || usuario.rol}. ¿Deseas cerrar sesión?`)) {
             localStorage.removeItem('transporte_auth');
             setUsuario(null);
             goLogin();
            }
           } else {
           goLogin();
           }
             }}
            >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
           <Shield size={15} />
           {usuario ? (usuario.rol === 'SUPERADMIN' ? 'SuperAdmin' : 'Cerrar Sesión') : 'Administración'}
             </span>
        </button>
          </nav>

          <span className="header-note">
            <Ticket size={17} /> Tu próximo viaje, a un clic
          </span>
        </div>
      </header>

      <main id="contenido" className="shell main-content">
        {page === 'admin' ? (
          <GestionCooperativas
            onLogout={() => {
              setUsuario(null);
              goLogin();
            }}
          />
        ) : page === 'login' ? (
          <Login
            alertaSeguridad={authError}
            onLoginSuccess={(user, ruta) => {
              setUsuario(user);
              setAuthError('');
              if (ruta === '/oficina' || user?.rol === 'OFICINISTA') {
                setPage('oficina');
                window.location.hash = 'oficina';
              } else {
                goAdmin();
              }
            }}
          />
        ) : page === 'oficina' ? (
          canAccessOffice(usuario) ? (
            <OfficeDashboard />
          ) : (
            <Login
              alertaSeguridad="Acceso restringido a personal de taquilla autorizado"
              onLoginSuccess={(user) => {
                setUsuario(user);
                setAuthError('');
                setPage('oficina');
                window.location.hash = 'oficina';
              }}
            />
          )
        ) : page === 'ticket' ? (
          <TicketLookup key={code} initialCode={code} onBack={goSearch} />
        ) : trip && seats.length ? (
          <Checkout trip={trip} seats={seats} onBack={() => setSeats([])} onConsult={goTicket} />
        ) : trip ? (
          <SeatSelection
            trip={trip}
            initialCategory={category}
            onBack={() => setTrip(null)}
            onContinue={(picked) => {
              setSeats(picked);
              window.scrollTo(0, 0);
            }}
          />
        ) : (
          <>
            {recalledCode() && (
              <div className="resume-banner">
                ¿Deseas retomar tu reserva?{' '}
                <button className="inline-link" onClick={() => goTicket(recalledCode())}>
                  Consultar {recalledCode()}
                </button>
              </div>
            )}
            <SearchTrips
              onChoose={(next, filter) => {
                setTrip(next);
                setCategory(filter);
                window.scrollTo(0, 0);
              }}
            />
          </>
        )}
      </main>

      <footer className="site-footer shell">
        <span>En ruta · Proyecto Transporte UTA</span>
        <span>Hecho para acercarte.</span>
      </footer>
    </>
  );
}