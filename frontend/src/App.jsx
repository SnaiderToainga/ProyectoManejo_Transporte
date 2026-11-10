import { useEffect, useRef, useState } from 'react';
import { BusFront, Ticket, Shield, Menu, X } from 'lucide-react';
import SearchTrips from './pages/Client/SearchTrips.jsx';
import SeatSelection from './pages/Client/SeatSelection.jsx';
import Checkout from './pages/Client/Checkout.jsx';
import TicketLookup from './pages/Client/TicketLookup.jsx';
import HistorialCompras from './pages/Client/HistorialCompras.jsx';
import Login from './pages/Admin/Login.jsx';
import GestionCooperativas from './pages/Admin/GestionCooperativas.jsx';
import OfficeDashboard from './pages/Office/OfficeDashboard';
import { recalledCode } from './lib/reservation.js';
import { isDemo } from './lib/api.js';
import { canAccessOffice } from './lib/authGuard.js';

const isHistoryHash = hash => hash === '#mis-compras' || hash.startsWith('#mis-compras?');
const historyTokenFromHash = () => isHistoryHash(window.location.hash)
  ? new URLSearchParams(window.location.hash.split('?')[1]).get('token') || ''
  : '';

export default function App() {
  const [trip, setTrip] = useState(null);
  const [category, setCategory] = useState('');
  const [seats, setSeats] = useState([]);
  const getUrlCode = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('codigo') || params.get('reserva') || '').trim().toUpperCase();
    } catch {
      return '';
    }
  };

  const [code, setCode] = useState(getUrlCode);
  const [historyToken, setHistoryToken] = useState(historyTokenFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)');
    const closeOnDesktop = () => { if (!mobile.matches) setMenuOpen(false); };
    mobile.addEventListener('change', closeOnDesktop);
    return () => mobile.removeEventListener('change', closeOnDesktop);
  }, []);

  // Detección inicial de página por URL o hash con guardián de ruta
  const getInitialPage = () => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (isHistoryHash(hash)) return 'mis-compras';
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
    if (getUrlCode() || hash === '#boleto') return 'ticket';
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

  useEffect(() => {
    if (historyToken && historyTokenFromHash()) {
      window.history.replaceState(null, '', '#mis-compras');
    }
  }, [historyToken]);

  const goHistory = () => {
    setPage('mis-compras');
    window.location.hash = 'mis-compras';
    window.scrollTo(0, 0);
  };

  const goSearch = () => {
    setMenuOpen(false);
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
      setMenuOpen(false);
      const hash = window.location.hash;
      if (isHistoryHash(hash)) {
        const token = historyTokenFromHash();
        if (token) {
          setHistoryToken(token);
          window.history.replaceState(null, '', '#mis-compras');
        }
        setPage('mis-compras');
      } else if (hash === '#admin') {
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
      } else if (hash === '#boleto' || getUrlCode()) {
        const directCode = getUrlCode();
        if (directCode) setCode(directCode);
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

      <header className="site-header" onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}>
        <div className="shell header-inner">
          <button onClick={goSearch} className="brand" aria-label="En ruta, inicio">
            <span className="brand-symbol">
              <BusFront size={26} />
            </span>
            <span>
              en ruta<span className="brand-sub">TRANSPORTE UTA</span>
            </span>
          </button>

          <button
            ref={menuButton}
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            Menú
          </button>

          <nav id="main-navigation" className={`site-nav flex-wrap ${menuOpen ? 'is-open' : ''}`} aria-label="Principal" onClick={() => setMenuOpen(false)}>
            <button className={`nav-link ${page === 'search' ? 'active' : ''}`} onClick={goSearch}>
              Buscar viaje
            </button>
            <button className={`nav-link ${page === 'ticket' ? 'active' : ''}`} onClick={() => goTicket()}>
              Mi boleto
            </button>
            <button className={`nav-link ${page === 'mis-compras' ? 'active' : ''}`} onClick={goHistory}>
              Mis compras
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
                if (page !== 'admin' && (usuario.rol === 'SUPERADMIN' || usuario.rol === 'ADMIN_COOP')) {
                  goAdmin();
                } else {
                  if (confirm(`Sesión activa como: ${usuario.nombre || usuario.rol}. ¿Deseas cerrar sesión?`)) {
                    localStorage.removeItem('transporte_auth');
                    setUsuario(null);
                    goLogin();
                  }
                }
              } else {
                goLogin();
              }
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Shield size={15} />
              {usuario ? (usuario.rol === 'SUPERADMIN' ? 'SuperAdmin' : usuario.rol === 'ADMIN_COOP' ? 'Gerencia' : 'Cerrar Sesión') : 'Administración'}
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
            usuario={usuario}
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
        ) : page === 'mis-compras' ? (
          <HistorialCompras token={historyToken} onClearAccess={() => setHistoryToken('')} onVerBoleto={goTicket} />
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
