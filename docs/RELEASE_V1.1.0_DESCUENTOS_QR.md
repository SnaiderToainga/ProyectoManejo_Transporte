# Documentación de Release v1.1.0: Descuentos de Ley, QR Interactivo y Comprobantes

* **Proyecto:** En ruta - Transporte UTA
* **Materia:** Manejo y Configuración del Software (FISEI - UTA)
* **Versión Oficial:** `v1.1.0`
* **Rama Gitflow:** `release/v1.1.0`
* **Autor / Responsable:** Snaider Toainga (Tech Lead)

---

## 1. Justificación y Objetivos de la Release

Siguiendo las directrices del docente y las reglas del negocio de transporte interprovincial ecuatoriano:
1. **Descuentos Preferenciales en Línea (50% de Ley):** Se implementó la selección de tarifa para Tercera Edad, Niños / Menores de edad y Personas con Discapacidad en el módulo web del cliente, restando el 50% del valor base conforme a la Ley Orgánica de Transporte Terrestre, Tránsito y Seguridad Vial del Ecuador.
2. **QR con Enlace Móvil Nativo:** El código QR del correo electrónico y del PDF ahora codifica una URL oficial (`https://proyecto-web.online/?codigo=RES-XXXXXX#boleto`). Al ser escaneado con la cámara de cualquier teléfono móvil (iOS o Android), el dispositivo reconoce el enlace web oficial en lugar de enviarlo a un motor de búsqueda.
3. **Consulta Automática mediante URL:** La aplicación web ahora detecta automáticamente parámetros `?codigo=...` o `?reserva=...`, navegando directamente a la pantalla de validación y renderizado de boletos.
4. **Visualización Robusta de Comprobantes Bancarios:** En el panel de oficinista/taquilla, los comprobantes de transferencia y depósito cargan su URL absoluta desde el servidor en la nube de Render (`transporte-uta-api.onrender.com`), con enlace directo de respaldo para apertura en pestaña externa.

---

## 2. Archivos Modificados en la Versión

* `frontend/src/pages/Client/Checkout.jsx`: Selector de tipo de pasajero, recálculo dinámico de tarifa con descuento del 50% y resumen desglosado.
* `frontend/src/App.jsx`: Detección en arranque y eventos de cambio de parámetros de consulta para carga inmediata de boletos.
* `frontend/src/pages/Office/ValidacionComprobantes.jsx`: Prefijo de URL de Render y fallback seguro de apertura en nueva pestaña.
* `backend/src/services/emailService.js`: Generación de QR como URL interactiva y botón de acción *"Ver Boleto Digital en Línea"* en la plantilla HTML.
* `backend/src/services/ticketService.js`: Generación de QR en PDF como enlace de validación web.
* `frontend/package.json` y `backend/package.json`: Incremento semántico de versión a `1.1.0`.

---

## 3. Estado de Módulos para la Fase de Control de Cambios (CCB)

Conforme a la metodología pedagógica establecida para el segundo parcial:
* **Módulo del Chofer:** Mantenido sin interfaz gráfica para la primera fase, reservado para el control de cambios.
* **Historial de Compras por Cédula:** Identificado como requerimiento candidato a ser gestionado mediante peticiones de cambio formales (RFC / Issues en Jira Service Management) ante el Comité de Control de Cambios (CCB).
