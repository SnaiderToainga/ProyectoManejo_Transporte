import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BusFront, Shield, Menu, X, User, LogOut } from 'lucide-react';
import SearchTrips from './pages/Client/SearchTrips.jsx';
import { recalledCode } from './lib/reservation.js';
import { api, isDemo } from './lib/api.js';
import { canAccessOffice, canAccessDriver, canAccessAdmin } from './lib/authGuard.js';
import { loadSelection, saveSelection, selectionKey } from './lib/purchaseFlow.js';

const SeatSelection = lazy(() => import('./pages/Client/SeatSelection.jsx'));
const Checkout = lazy(() => import('./pages/Client/Checkout.jsx'));
const HistorialCompras = lazy(() => import('./pages/Client/HistorialCompras.jsx'));
const CustomerAccount = lazy(() => import('./pages/Client/CustomerAccount.jsx'));
const Login = lazy(() => import('./pages/Admin/Login.jsx'));
const GestionCooperativas = lazy(() => import('./pages/Admin/GestionCooperativas.jsx'));
const OfficeDashboard = lazy(() => import('./pages/Office/OfficeDashboard'));
const ChoferPanel = lazy(() => import('./pages/Driver/ChoferPanel.jsx'));

const isHistoryHash = hash => hash === '#mis-compras' || hash.startsWith('#mis-compras?');
const historyTokenFromHash = () => isHistoryHash(window.location.hash)
  ? new URLSearchParams(window.location.hash.split('?')[1]).get('token') || ''
  : '';

export default function App() {
  const [restored] = useState(() => { try { return loadSelection(sessionStorage, Date.now(), isDemo); } catch { return null; } });
  const [trip, setTrip] = useState(restored?.trip || null);
  const [category, setCategory] = useState(restored?.category || '');
  const [selectedIds, setSelectedIds] = useState(restored?.ids || []);
  const [checkoutDraft, setCheckoutDraft] = useState(null);
  const [reserved, setReserved] = useState(false);
  const [seats, setSeats] = useState([]);
  useEffect(() => { try { saveSelection(sessionStorage, reserved ? null : trip, category, selectedIds, Date.now(), isDemo); } catch {} }, [trip, category, selectedIds, reserved]);
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
  const [customerToken, setCustomerToken] = useState(() => {
    try {
      return sessionStorage.getItem('transporte_cliente_token') || localStorage.getItem('transporte_cliente_token') || '';
    } catch {
      return '';
    }
  });
  const [customer, setCustomer] = useState(null);
  const [customerError, setCustomerError] = useState('');
  const customerFirstName = customerToken && customer?.nombre
    ? customer.nombre.trim().split(/\s+/)[0]
    : '';
  const clearCustomer = () => {
    setCustomerToken(''); setHistoryToken(''); setCustomer(null); setCustomerError(''); setCheckoutDraft(null);
    try {
      sessionStorage.removeItem('transporte_cliente_token');
      localStorage.removeItem('transporte_cliente_token');
    } catch {}
  };
  const handleCustomerSession = (result) => {
    setCustomerToken(result.token); setCustomer(result.cliente); setCustomerError('');
    try {
      sessionStorage.setItem('transporte_cliente_token', result.token);
      localStorage.setItem('transporte_cliente_token', result.token);
    } catch {}
    if (trip && page === 'mi-cuenta') {
      setPage('search');
      window.location.hash = 'buscar';
      window.scrollTo(0, 0);
    }
  };
  useEffect(() => {
    if (!customerToken) return;
    const controller = new AbortController();
    api.customerProfile(customerToken, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        if (!result.cliente?.id) throw new Error('No se pudo verificar la cuenta de cliente.');
        setCustomer(result.cliente); setCustomerError('');
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        if ([401, 403].includes(error.status)) {
          setCustomerToken(''); setCustomer(null);
          try {
            sessionStorage.removeItem('transporte_cliente_token');
            localStorage.removeItem('transporte_cliente_token');
          } catch {}
        }
        setCustomerError('Tu sesión de cliente expiró o no se pudo verificar. Inicia sesión nuevamente para comprar.');
      }
    });
    return () => controller.abort();
  }, [customerToken]);
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
    if (hash === '#mi-cuenta') return 'mi-cuenta';
    let auth = null;
    try {
      auth = JSON.parse(localStorage.getItem('transporte_auth'));
    } catch {}

    if (path === '/admin' || hash === '#admin') return canAccessAdmin(auth) ? 'admin' : 'login';
    if (path === '/login' || hash === '#login') return 'login';
    if (path === '/chofer' || hash === '#chofer') {
      if (!canAccessDriver(auth)) {
        window.location.hash = 'login';
        return 'login';
      }
      return 'chofer';
    }
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
  const goCustomer = () => { setPage('mi-cuenta'); window.location.hash = 'mi-cuenta'; window.scrollTo(0, 0); };
  const resumePurchase = () => { setPage('search'); window.location.hash = 'buscar'; window.scrollTo(0, 0); };

  const goSearch = () => {
    setMenuOpen(false);
    setTrip(null);
    setSeats([]);
    setSelectedIds([]);
    setCheckoutDraft(null);
    setReserved(false);
    setCode('');
    setPage('search');
    if (window.location.search || window.location.pathname !== '/') {
      const keepDemo = isDemo ? '?demo=1' : '';
      window.history.replaceState(null, '', `/${keepDemo}#buscar`);
    } else {
      window.location.hash = 'buscar';
    }
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

  const goChofer = () => {
    setMenuOpen(false);
    if (!canAccessDriver(usuario)) {
      goLogin('Acceso restringido: Se requieren credenciales de Chofer o Administrador');
      return;
    }
    setAuthError('');
    setPage('chofer');
    window.location.hash = 'chofer';
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
      } else if (hash === '#mi-cuenta') {
        setPage('mi-cuenta');
      } else if (hash === '#admin') {
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('transporte_auth')); } catch {}
        if (!canAccessAdmin(stored)) {
          setAuthError('Acceso restringido a administración de cooperativas.'); setPage('login'); window.location.hash = 'login';
        } else setPage('admin');
      } else if (hash === '#login') {
        setPage('login');
      } else if (hash === '#chofer') {
        const storedUser = (() => {
          try {
            return JSON.parse(localStorage.getItem('transporte_auth'));
          } catch {
            return null;
          }
        })();
        if (!canAccessDriver(storedUser)) {
          setAuthError('Acceso restringido: Se requieren credenciales de Chofer o Administrador');
          setPage('login');
          window.location.hash = 'login';
          return;
        }
        setAuthError('');
        setPage('chofer');
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
      } else if (hash === '#boleto' || (hash !== '#buscar' && getUrlCode())) {
        const directCode = getUrlCode();
        if (directCode) setCode(directCode);
        setPage('ticket');
      } else {
        setPage('search');
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
            {usuario ? (
              <>
                <button className={`nav-link ${!['admin', 'oficina', 'chofer', 'login'].includes(page) ? 'active' : ''}`} onClick={goSearch}>
                  Portal de clientes
                </button>
                {(usuario.rol === 'SUPERADMIN' || usuario.rol === 'ADMIN_COOP') && (
                  <button className={`nav-link ${page === 'admin' ? 'active' : ''}`} onClick={goAdmin}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Shield size={15} aria-hidden="true" />
                      {usuario.rol === 'SUPERADMIN' ? 'SuperAdmin' : 'Gerencia'}
                    </span>
                  </button>
                )}
                {(usuario.rol === 'OFICINISTA' || usuario.rol === 'SUPERADMIN') && (
                  <button className={`nav-link ${page === 'oficina' ? 'active' : ''}`} onClick={goOficina}>
                    Taquilla / Oficina
                  </button>
                )}
                {(usuario.rol === 'CHOFER' || usuario.rol === 'SUPERADMIN') && (
                  <button className={`nav-link ${page === 'chofer' ? 'active' : ''}`} onClick={goChofer} style={{ fontWeight: 600 }}>
                    🚍 Cabina Chofer
                  </button>
                )}
                <button
                  className="nav-link"
                  onClick={() => {
                    localStorage.removeItem('transporte_auth');
                    setUsuario(null);
                    goLogin();
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <LogOut size={15} aria-hidden="true" />
                    Cerrar sesión
                  </span>
                </button>
              </>
            ) : customerFirstName ? (
              <>
                <button className={`nav-link ${page === 'search' ? 'active' : ''}`} onClick={goSearch}>
                  Buscar viaje
                </button>
                <div className="nav-account-group">
                  <button
                    className={`nav-link nav-account-btn ${['mi-cuenta', 'mis-compras', 'ticket'].includes(page) ? 'active' : ''}`}
                    onClick={goCustomer}
                  >
                    <span className="nav-account-label">
                      <User size={15} aria-hidden="true" />
                      {`Hola, ${customerFirstName}`}
                    </span>
                  </button>
                  <button className="nav-link nav-logout-btn" onClick={clearCustomer} title="Cerrar sesión de cliente">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <LogOut size={15} aria-hidden="true" />
                      Salir
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`nav-link nav-staff-btn ${page === 'login' ? 'active' : ''}`}
                    onClick={() => goLogin()}
                    title="Ingreso para personal operativo, oficina y choferes"
                  >
                    <Shield size={13} aria-hidden="true" />
                    Acceso operativo
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className={`nav-link ${page === 'search' ? 'active' : ''}`} onClick={goSearch}>
                  Buscar viaje
                </button>
                <div className="nav-account-group">
                  <button
                    className={`nav-link nav-account-btn ${['mi-cuenta', 'mis-compras', 'ticket'].includes(page) ? 'active' : ''}`}
                    onClick={goCustomer}
                  >
                    Mi cuenta
                  </button>
                  <button
                    type="button"
                    className={`nav-link nav-staff-btn ${page === 'login' ? 'active' : ''}`}
                    onClick={() => goLogin()}
                    title="Ingreso para personal operativo, oficina y choferes"
                  >
                    <Shield size={13} aria-hidden="true" />
                    Acceso operativo
                  </button>
                </div>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="contenido" className="shell main-content">
        <Suspense fallback={<div className="empty-state" role="status">Cargando vista…</div>}>
        {page === 'chofer' ? (
          canAccessDriver(usuario) ? (
            <ChoferPanel
              usuario={usuario}
              onVolverInicio={goSearch}
              onLogout={() => {
                localStorage.removeItem('transporte_auth');
                setUsuario(null);
                goLogin();
              }}
            />
          ) : (
            <Login
              alertaSeguridad="Acceso restringido: Se requieren credenciales de Chofer o Administrador"
              onLoginSuccess={(user) => {
                setUsuario(user);
                setAuthError('');
                setPage('chofer');
                window.location.hash = 'chofer';
              }}
            />
          )
        ) : page === 'admin' ? (
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
              } else if (ruta === '/chofer' || user?.rol === 'CHOFER') {
                setPage('chofer');
                window.location.hash = 'chofer';
              } else {
                goAdmin();
              }
            }}
          />
        ) : page === 'oficina' ? (
          canAccessOffice(usuario) ? (
            <OfficeDashboard usuario={usuario} />
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
        ) : page === 'mi-cuenta' || page === 'ticket' ? (
          <>
            {customerError && <p role="alert" className="inline-error">{customerError}</p>}
            <CustomerAccount
              customer={customer}
              token={customerToken}
              pendingTrip={page === 'mi-cuenta' ? trip : null}
              requireTicketLogin={page === 'ticket'}
              initialTab={page === 'ticket' ? 'boleto' : 'compras'}
              initialTicketCode={code}
              onSession={handleCustomerSession}
              onLogout={clearCustomer}
              onHistory={goHistory}
              onSearch={goSearch}
              onAdminLogin={() => goLogin()}
              hasActiveTrip={Boolean(trip)}
              onContinue={trip ? resumePurchase : goSearch}
            />
          </>
        ) : page === 'mis-compras' ? (
          customer && customerToken ? (
            <>
              {trip && <button type="button" className="back-link" onClick={resumePurchase}>Volver a mi compra</button>}
              <HistorialCompras token={customerToken || historyToken} customer={customer}
                onAccount={goCustomer} onClearAccess={() => { clearCustomer(); setHistoryToken(''); }} onVerBoleto={goTicket} />
            </>
          ) : (
            <CustomerAccount
              customer={customer}
              token={customerToken}
              requireTicketLogin
              onSession={handleCustomerSession}
              onLogout={clearCustomer}
              onHistory={goHistory}
              onSearch={goSearch}
              onAdminLogin={() => goLogin()}
            />
          )
        ) : trip && seats.length ? (
          <Checkout key={selectionKey(trip)} trip={trip} seats={seats} draft={checkoutDraft} onDraftChange={setCheckoutDraft}
            customer={customer} customerToken={customerToken || historyToken} onAccount={goCustomer} onCustomerSession={handleCustomerSession} onCustomerLogout={clearCustomer} onHistory={goHistory} onBack={() => setSeats([])} onConsult={goTicket} onBuyAnother={goSearch}
            onReserved={() => { setReserved(true); setSelectedIds([]); setCheckoutDraft(null); }} />
        ) : trip ? (
          <SeatSelection
            trip={trip}
            initialCategory={category}
            initialSelectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onBack={goSearch}
            onContinue={(picked) => {
              setSeats(picked);
              window.scrollTo(0, 0);
            }}
          />
        ) : (
          <>
            {customer && customerToken && recalledCode() && (
              <div className="resume-banner">
                ¿Deseas revisar tu reserva reciente?{' '}
                <button className="inline-link" onClick={() => goTicket(recalledCode())}>
                  Ver boleto {recalledCode()}
                </button>
              </div>
            )}
            <SearchTrips
              onChoose={(next, filter) => {
                setTrip(next);
                setCategory(filter);
                setSelectedIds([]);
                setCheckoutDraft(null);
                setReserved(false);
                window.scrollTo(0, 0);
              }}
            />
          </>
        )}
        </Suspense>
      </main>

      <footer className="site-footer shell">
        <span>En ruta · Proyecto Transporte UTA</span>
        <span>Hecho para acercarte.</span>
      </footer>
    </>
  );
}
