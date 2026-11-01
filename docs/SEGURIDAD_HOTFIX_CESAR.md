# Hotfix de Seguridad v1.0.1: Control de Acceso por Roles (RBAC) — César / Steven (@Steven9tp)

**Materia:** Manejo y Configuración del Software (FISEI - UTA)  
**Rama:** `hotfix/v1.0.1-seguridad-acceso-oficina`  
**Incidente Resuelto:** *Broken Access Control (OWASP Top 1:2021)* en el módulo de Taquilla / Oficina  
**Línea Base Oficial:** `v1.0.0` ➔ `v1.0.1`

---

## 🛡️ Resumen del Incidente y Mitigación

### 1. Diagnóstico del Incidente
En la versión base `v1.0.0`, el enlace hacia *"Taquilla / Oficina"* se encontraba visible para cualquier usuario anónimo en la barra de navegación pública. Adicionalmente, cualquier cliente o visitante podía forzar la ruta `#oficina` por URL en el navegador, accediendo al panel operativo de emisión y validación de boletos sin requerir credenciales autorizadas.

### 2. Solución Técnica Implementada (Ciclo de 5 Commits en Gitflow)
1. **Ocultamiento de Enlace en Barra de Navegación (`d92aa25`):**
   En `frontend/src/App.jsx`, el botón de navegación hacia la oficina ahora se renderiza condicionalmente solo si existe una sesión activa con rol `OFICINISTA` o `SUPERADMIN`.
2. **Guardián de Rutas / Route Guard (`2a06c6c`):**
   Interceptación tanto al arranque de la aplicación (`getInitialPage`) como en el listener reactivo de eventos `hashchange`. Si un usuario no autorizado intenta acceder a `#oficina`, el guardián bloquea la petición y lo redirige automáticamente a `#login`.
3. **Alerta de Seguridad en Pantalla de Login (`33cf301`):**
   En `frontend/src/pages/Admin/Login.jsx`, se implementó la visualización de la alerta destacada: *"Acceso restringido a personal de taquilla autorizado"* con iconografía de seguridad (`ShieldAlert`) y redirección fluida tras la autenticación de personal de taquilla.
4. **Módulo de Validación RBAC y Pruebas Unitarias (`65c251d`):**
   Creación de `frontend/src/lib/authGuard.js` y `frontend/tests/unit/authGuard.test.js`, integrando 5 pruebas unitarias automatizadas que validan roles y permisos (aprobadas al 100% con `npm test`).
5. **Documentación de Control de Acceso y Políticas de Seguridad:**
   Formalización de la matriz de roles y políticas de seguridad para la auditoría técnica y defensa del proyecto ante el docente.

---

## 📊 Matriz de Control de Acceso por Roles (RBAC)

| Rol del Usuario | Portal Público (`/`, `#buscar`, `#boleto`) | Taquilla / Oficina (`#oficina`) | Portal Administrativo (`#admin`) |
| :--- | :---: | :---: | :---: |
| **ANÓNIMO / VISITANTE** | ✅ Permitido | ❌ Denegado (Redirige a `#login`) | ❌ Denegado (Redirige a `#login`) |
| **CLIENTE** | ✅ Permitido | ❌ Denegado (Redirige a `#login`) | ❌ Denegado (Redirige a `#login`) |
| **OFICINISTA** | ✅ Permitido | ✅ Permitido (Gestión y Taquilla) | ❌ Denegado |
| **ADMIN_COOP** | ✅ Permitido | ❌ Denegado | ✅ Permitido (Cooperativa propia) |
| **SUPERADMIN** | ✅ Permitido | ✅ Permitido | ✅ Permitido (Control global del sistema) |

---

## 🧪 Verificación y Pruebas

Para reproducir la verificación técnica:
```bash
# 1. Ejecutar pruebas unitarias automatizadas de seguridad
cd frontend
npm test

# 2. Levantar el frontend y verificar el guardián de rutas en el navegador
npm run dev
# Navegar a http://127.0.0.1:5173/#oficina sin autenticación y constatar la redirección y alerta de seguridad.
```
