# 🚌 Plataforma Web para la Gestión y Venta de Pasajes Interprovinciales
[![Licencia: GPL v3](https://img.shields.io/badge/Licencia-GPLv3-blue.svg)](LICENSE)
[![Flujo: Gitflow](https://img.shields.io/badge/Workflow-Gitflow-orange.svg)](CONTRIBUTING.md)
[![Institución: UTA FISEI](https://img.shields.io/badge/UTA-FISEI-red.svg)](https://fisei.uta.edu.ec)
[![Version: 1.0.0](https://img.shields.io/badge/Versi%C3%B3n-1.0.0-green.svg)](#)
Proyecto de desarrollo colaborativo de software correspondiente a la cátedra de **Manejo y Configuración de Software**, Carrera de Software, Facultad de Ingeniería en Sistemas, Electrónica e Industrial (**FISEI**), **Universidad Técnica de Ambato**.
---
## 📋 1. Información General y Alcance del Sistema
Solución web integral para digitalizar la operativa entre cooperativas de transporte interprovincial y usuarios finales en Ecuador, administrando frecuencias validadas por la Agencia Nacional de Tránsito (ANT), compra de boletos en línea y emisión de pasajes digitales mediante códigos QR verificables.
### 🏛️ Cumplimiento Normativo (Regulaciones ANT)
* **Frecuencias Autorizadas:** Cada frecuencia (origen, destino y hora de salida) cuenta con respaldo de resolución emitida por la **ANT**.
* **Hojas de Ruta Diarias:** Asignación de unidades disponibles a frecuencias activas, respetando días reglamentarios de parada y mantenimiento de los buses.
* **Descuentos de Ley:** Aplicación de tarifas preferenciales (50% de descuento) para adultos mayores, menores de edad y personas con discapacidad validadas contra cédula.
---
## 👥 2. Matriz de Responsabilidades y Equipo (SCM)
| Integrante | Rol en el Proyecto | Responsabilidad Técnica Principal | Rama Base |
| :--- | :--- | :--- | :--- |
| **Snaider** | **Líder de Proyecto / SCM** | Gobernanza Gitflow, infraestructura de BD en Supabase y servicios transversales | `feature/notificaciones-core` |
| **Cristian** | **Backend Core** | Modelado de datos relacionales, CRUD de cooperativas, buses (40/41) y frecuencias | `feature/models-buses-frecuencias` |
| **Cesar** | **Backend Transaccional** | Motor de reservas temporales (5 min), pasarela de comprobantes y generación de QR/PDF | `feature/reserva-pagos-service` |
| **Sonia** | **Frontend Cliente** | Portal web público, componente interactivo de asientos adaptativo y checkout | `feature/portal-cliente-asientos` |
| **Daky** | **Frontend Operativo** | Panel de oficinista para validación de comprobantes bancarios y venta en taquilla | `feature/panel-oficinista-ventas` |
| **Joel** | **QA, SuperAdmin & SCM** | Administración global de cooperativas, auditoría de configuración y control de calidad | `feature/superadmin-cooperativas` |
---
## 🚌 3. Reglas del Negocio y Lógica de Flotas
### A. Tipología y Configuración de Asientos del Bus
* **Unidades de 40 Asientos:** Distribución 2x2 con servicio higiénico (baño) en el extremo posterior derecho, suprimiendo la última plaza.
* **Unidades de 41 Asientos:** Distribución 2x2 continua sin interrupción, contando con una fila posterior de 5 asientos continuos.
* **Segmentación de Servicios:** Clasificación entre asientos **VIP** (primeras filas con mayor reclinación y tarifa diferencial) y asientos **Normales**.
### B. Ciclo de Venta y Bloqueo Temporal
1. **Selección y Reserva:** Al seleccionar asientos, el sistema establece un bloqueo temporal por **5 minutos**.
2. **Método de Pago:** Pago por transferencia o depósito bancario con carga obligatoria del comprobante digital.
3. **Validación en Taquilla:** El estado permanece en `PENDIENTE_VALIDACION` hasta que el oficinista verifica los fondos y aprueba la transacción.
4. **Emisión de Boleto:** Al ser aprobado, se emite el boleto digital en formato PDF descargable y se genera el código QR único para el abordaje.
---
## 🏗️ 4. Arquitectura del Software y Stack Tecnológico
* **Frontend:** React (Vite) modularizado con **Tailwind CSS**.
* **Backend:** API RESTful construida sobre **Node.js y Express** (Rutas, Controladores y Servicios).
* **Base de Datos:** PostgreSQL en la nube mediante **Supabase Connection Pooler** (Puerto `6543` con SSL).
* **Gestión de Configuración (SCM):** Git y GitHub aplicando el flujo **Gitflow**, Conventional Commits y revisión por pares mandatoria (2 aprobaciones por PR).
---
## 📁 5. Estructura del Repositorio
```text
transporte-interprovincial-uta/
├── .github/                     # Gobernanza GitHub (PR Template, Issue Templates)
├── backend/                     # API RESTful en Node.js y Express
│   ├── database/                # Elementos de Configuración: scripts SQL (01_schema.sql, 02_seeds.sql)
│   ├── src/                     # Código fuente del servidor
│   └── uploads/                 # Almacenamiento local temporal de comprobantes
├── frontend/                    # Aplicación cliente en React y Tailwind CSS
│   ├── src/pages/Client/        # Módulo de usuarios y pasajeros
│   ├── src/pages/Office/        # Módulo de personal de taquilla y oficinistas
│   └── src/pages/Admin/         # Módulo de administración general
├── docs/                        # Evidencias, diagramas y documentación técnica
├── CITATION.cff                 # Metadatos para citación formal del repositorio
├── CONTRIBUTING.md               # Políticas de contribución y directrices de Gitflow
├── CODE_OF_CONDUCT.md            # Código de conducta para trabajo colaborativo
├── LICENSE                      # Licencia GNU GPL v3.0
└── README.md
---
##🚀 6. Guía de Instalación y Puesta en Marcha
* Clonar el proyecto: git clone https://github.com/SnaiderToainga/G03_ProyectoTransporte.git
* Configuración de Variables: Duplicar backend/.env.example como backend/.env y asignar la cadena de conexión de Supabase en DATABASE_URL.
* Ejecutar Backend: cd backend && npm install && npm run dev
* Ejecutar Frontend: cd frontend && npm install && npm run dev
