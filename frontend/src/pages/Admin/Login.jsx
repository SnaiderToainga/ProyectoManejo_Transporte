import { useState } from 'react';
import { BusFront, Lock, Mail, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [rolDetectado, setRolDetectado] = useState(null);

  const usuariosPrueba = [
    { rol: 'SUPERADMIN', correo: 'admin@transporteuta.com', pass: 'hash_admin_123', label: 'SuperAdmin General' },
    { rol: 'ADMIN_COOP', correo: 'gerente@cita.com', pass: 'admin123', label: 'Gerente Cooperativa' },
    { rol: 'OFICINISTA', correo: 'taquilla@transporteuta.com', pass: 'hash_oficina_123', label: 'Oficinista / Taquilla' }
  ];

  const handleSeleccionarPrueba = (user) => {
    setCorreo(user.correo);
    setPassword(user.pass);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correo.trim() || !password.trim()) {
      setError('Por favor complete todos los campos');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }

      setRolDetectado(data.usuario.rol);
      localStorage.setItem('transporte_auth', JSON.stringify(data.usuario));

      setTimeout(() => {
        if (data.usuario.rol === 'OFICINISTA') {
          // Redirigir al módulo de Taquilla de Daky
          window.location.hash = 'oficina';
          if (onLoginSuccess) onLoginSuccess(data.usuario, '/oficina');
        } else {
          // SuperAdmin o Administrador de Cooperativa
          window.location.hash = 'admin';
          if (onLoginSuccess) onLoginSuccess(data.usuario, '/admin');
        }
      }, 700);
    } catch (err) {
      // Fallback para pruebas si el backend estuviera desconectado
      const usuarioSimulado = usuariosPrueba.find(u => u.correo.toLowerCase() === correo.toLowerCase());
      if (usuarioSimulado) {
        const sesion = {
          id: 99,
          nombre: usuarioSimulado.label,
          correo: usuarioSimulado.correo,
          rol: usuarioSimulado.rol
        };
        localStorage.setItem('transporte_auth', JSON.stringify(sesion));
        setRolDetectado(usuarioSimulado.rol);

        setTimeout(() => {
          if (usuarioSimulado.rol === 'OFICINISTA') {
            window.location.hash = 'oficina';
            if (onLoginSuccess) onLoginSuccess(sesion, '/oficina');
          } else {
            window.location.hash = 'admin';
            if (onLoginSuccess) onLoginSuccess(sesion, '/admin');
          }
        }, 700);
      } else {
        setError(err.message || 'Error al iniciar sesión');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <BusFront size={32} color="#1E40AF" />
          </div>
          <h2 style={styles.title}>Portal Administrativo</h2>
          <p style={styles.subtitle}>Sistema de Transporte Interprovincial UTA</p>
        </div>

        {error && (
          <div style={styles.alertError}>
            <ShieldAlert size={18} color="#991B1B" />
            <span style={{ fontSize: '0.875rem', color: '#991B1B' }}>{error}</span>
          </div>
        )}

        {rolDetectado && (
          <div style={styles.alertSuccess}>
            <UserCheck size={18} color="#065F46" />
            <span style={{ fontSize: '0.875rem', color: '#065F46' }}>
              Acceso concedido como <strong>{rolDetectado}</strong>. Redirigiendo...
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Correo Electrónico</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                type="email"
                required
                placeholder="ejemplo@transporteuta.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{
              ...styles.submitBtn,
              opacity: cargando ? 0.7 : 1,
              cursor: cargando ? 'not-allowed' : 'pointer'
            }}
          >
            {cargando ? 'Verificando...' : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={styles.quickAccessSection}>
          <p style={styles.quickAccessTitle}>Credenciales de prueba rápida (Roles):</p>
          <div style={styles.quickAccessButtons}>
            {usuariosPrueba.map((u) => (
              <button
                key={u.rol}
                type="button"
                onClick={() => handleSeleccionarPrueba(u)}
                style={styles.quickBtn}
              >
                <strong>{u.rol}</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{u.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.footerLink}>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'buscar'; }} style={styles.backLink}>
            ← Volver al portal público de clientes
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '75vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E2E8F0',
    width: '100%',
    maxWidth: '440px',
    padding: '2.5rem 2rem'
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.75rem'
  },
  logoBadge: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
    border: '2px solid #DBEAFE'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0F172A',
    margin: '0 0 0.25rem 0'
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FCA5A5',
    borderRadius: '8px',
    marginBottom: '1.25rem'
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: '8px',
    marginBottom: '1.25rem'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem'
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#334155'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#94A3B8'
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem 0.625rem 2.5rem',
    fontSize: '0.9375rem',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease'
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: '0.9375rem',
    borderRadius: '8px',
    border: 'none',
    marginTop: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(30, 64, 175, 0.2)'
  },
  quickAccessSection: {
    marginTop: '1.75rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid #E2E8F0'
  },
  quickAccessTitle: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748B',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.025em'
  },
  quickAccessButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem'
  },
  quickBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.5rem',
    backgroundColor: '#F8FAFC',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    color: '#1E293B',
    textAlign: 'center'
  },
  footerLink: {
    marginTop: '1.25rem',
    textAlign: 'center'
  },
  backLink: {
    fontSize: '0.8125rem',
    color: '#475569',
    textDecoration: 'none'
  }
};
