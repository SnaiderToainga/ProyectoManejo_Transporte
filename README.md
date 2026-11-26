# 🚌 Plataforma Web para la Gestión y Venta de Pasajes Interprovinciales
[![Licencia: GPL v3](https://img.shields.io/badge/Licencia-GPLv3-blue.svg)](LICENSE)
[![Gobernanza: ITIL 4](https://img.shields.io/badge/Gobernanza-ITIL%204%20%2F%20CAB-blue.svg)](CONTRIBUTING.md)
[![Institución: UTA FISEI](https://img.shields.io/badge/UTA-FISEI-red.svg)](https://fisei.uta.edu.ec)
[![Version: 1.10.0](https://img.shields.io/badge/Versi%C3%B3n-1.10.0-green.svg)](#)

Proyecto de desarrollo colaborativo de software correspondiente a la cátedra de **Manejo y Configuración de Software**, Carrera de Software, Facultad de Ingeniería en Sistemas, Electrónica e Industrial (**FISEI**), **Universidad Técnica de Ambato**.

---

## 📋 1. Información General y Alcance del Sistema
Solución web integral para digitalizar la operativa entre cooperativas de transporte interprovincial y usuarios finales en Ecuador, administrando frecuencias validadas por la Agencia Nacional de Tránsito (ANT), compra de boletos en línea (Stripe Sandbox y comprobantes bancarios), gestión de flota, planificación de hojas de ruta y emisión de pasajes digitales mediante códigos QR verificables por choferes.

### 🏛️ Cumplimiento Normativo (Regulaciones ANT)
* **Frecuencias Autorizadas:** Cada frecuencia (origen, destino y hora de salida) cuenta con respaldo de resolución emitida por la **ANT**, permitiendo compra en tramos y paradas intermedias habilitadas.
* **Hojas de Ruta y Rotación:** Asignación matricial de unidades disponibles a frecuencias activas, respetando rotación equitativa (3+2), días reglamentarios de parada y mantenimiento.
* **Descuentos de Ley:** Aplicación de tarifas preferenciales (50% de descuento) para adultos mayores, menores de edad y personas con discapacidad validadas contra cédula.

---

## 👥 2. Matriz de Responsabilidades y Gobernanza SCM / ITIL 4

| Integrante | Rol Oficial en el Proyecto | Perfil y Responsabilidad Técnica |
| :--- | :--- | :--- |
| **Ing. Snaider Toainga** | **Líder SCM & Gestor CAB** | Aprobador oficial de `main`, verificación de PIR, seguridad RBAC (`CR-10`, `CR-03`), mapa por ruta y empaquetado Docker (`CR-15`), release tag (`v1.10.0`). |
| **Ing. Joel Poaquiza** | **Presidente CAB & Auditor QA** | Dictamen de cambios, validación de calidad, módulo chofer QR (`CR-04`), frecuencias (`CR-05`) y hotfix de estabilización (`CR-13`). |
| **Ing. Cristian Sivinta** | **Backend Core & Matriz SCM** | Modelado relacional, matriz pizarrón de hojas de ruta (`CR-08`) y boleto térmico con tarifas diferenciadas (`CR-07`). |
| **Ing. Cesar Carrasco** | **Backend Transaccional & Pagos** | Pasarela Stripe Sandbox (`CR-01`), contingencia de comprobantes Render (`CR-11`) y trámite de solicitud rechazada (`CR-12`). |
| **Ing. Sonia Toapanta** | **Frontend Lead & UX** | Buscador predictivo de 4 filtros (`CR-06`), normalización ortográfica (`CR-02`) y asistente Wizard de cooperativas (`CR-01`). |

---

## 🚌 3. Reglas del Negocio y Lógica de Flotas
### A. Tipología y Configuración de Asientos del Bus
* **Unidades de 40 Asientos:** Distribución 2x2 con servicio higiénico (baño) en el extremo posterior derecho, suprimiendo la última plaza con compensación automática al fondo.
* **Unidades de 41 Asientos:** Distribución 2x2 continua sin interrupción, contando con una fila posterior de 5 asientos continuos.
* **Segmentación de Servicios:** Clasificación entre asientos **VIP** (primeras filas con tarifa diferencial) y asientos **Normales**.

### B. Métodos de Pago y Emisión
1. **Pago Digital (Stripe Sandbox):** Conciliación automática en tiempo real vía webhook firmado con token de idempotencia.
2. **Depósito / Transferencia Bancaria:** Carga de comprobante digital validado por oficinista en taquilla con fallback de respaldo local.
3. **Emisión de Boleto:** Boleto digital en PDF descargable, formato térmico de 80mm para taquilla y código QR único escaneable en cabina por el chofer.

---

## 🏗️ 4. Arquitectura del Software y Stack Tecnológico
* **Frontend:** React 19 (Vite) modularizado con **Tailwind CSS**, Lucide Icons y Leaflet.
* **Backend:** API RESTful modular sobre **Node.js 22 y Express 5**.
* **Base de Datos:** PostgreSQL en la nube mediante **Supabase Connection Pooler** (Puerto `6543` con SSL).
* **Gestión de Configuración (SCM):** Flujo de Control de Cambios ITIL 4 directo a `main`, Conventional Commits, revisión colegiada obligatoria (2 aprobaciones por PR) y control SemVer.

---

## 📁 5. Estructura del Repositorio
```text
transporte-interprovincial-uta/
├── .github/                     # Gobernanza GitHub (PR Template, Issue Templates)
├── backend/                     # API RESTful en Node.js y Express
│   ├── database/                # Scripts de migración SQL aditivos (01 al 08)
│   ├── src/                     # Código fuente, controladores, middlewares y rutas
│   └── tests/                   # Pruebas automatizadas (unitarias y de integración)
├── frontend/                    # Aplicación cliente en React y Tailwind CSS
│   ├── src/pages/Client/        # Portal público, búsqueda predictiva y checkout
│   ├── src/pages/Office/        # Módulo de taquilla, validación y hojas de ruta
│   ├── src/pages/Driver/        # Cabina del chofer con escáner QR en puerta
│   └── src/pages/Admin/         # Wizard de cooperativas, flota y administración
├── docs/                        # Evidencias, especificaciones y memorias de cada CR (01 al 15)
├── docker-compose.yml           # Orquestación Docker (backend Express + frontend Nginx SPA)
├── CITATION.cff                 # Metadatos para citación formal del repositorio
├── CONTRIBUTING.md               # Guía oficial de contribución y gobernanza ITIL 4
├── CODE_OF_CONDUCT.md            # Código de conducta y ética del equipo
├── SECURITY.md                  # Política de seguridad y versiones soportadas
├── LICENSE                      # Licencia GNU GPL v3.0
└── README.md
```

---

## 🚀 6. Guía de Instalación y Puesta en Marcha
1. **Clonar el proyecto:**
   ```bash
   git clone https://github.com/SnaiderToainga/ProyectoManejo_Transporte.git
   cd ProyectoManejo_Transporte
   ```
2. **Configuración de Variables de Entorno:**
   * Crear `backend/.env` configurando `DATABASE_URL` (Supabase), credenciales de correo y llaves de Stripe Sandbox.
3. **Instalación y Ejecución Local:**
   * **Backend:** `cd backend && npm install && npm start`
   * **Frontend:** `cd frontend && npm install && npm run dev`
4. **Ejecución en Contenedores (Docker Compose — CR-15):**
   * Copiar `backend/.env.example` a `backend/.env`, completar `DATABASE_URL` y secretos HMAC, y ajustar `FRONTEND_URL=http://localhost:8088`.
   * Ejecutar:
     ```bash
     docker compose up --build -d
     ```
   * Portal web disponible en `http://localhost:8088` y API en `http://localhost:3001/api/health`. Los archivos cargados (`/app/uploads`) y plantillas JSON (`/app/data`) persisten en volúmenes Docker sin alterar el despliegue en producción (Vercel + Render).
