# Guía Oficial de Contribución y Gobernanza Gitflow

Este documento define las políticas operativas y estándares de ingeniería de software obligatorios para todos los desarrolladores del proyecto. El incumplimiento de estas pautas invalida los Pull Requests durante las auditorías de configuración.

---

## 1. Estrategia de Ramificación (Gitflow Estricto)

El repositorio opera bajo una implementación estricta del flujo **Gitflow**:

* **`main` (Producción):** 
  * Contiene exclusivamente código desplegable y estable.
  * Todo commit en esta rama proviene de un merge formal de `release/` o `hotfix/`.
  * Toda versión en `main` debe etiquetarse con un tag semántico SemVer (`v1.0.0`, `v1.0.1`).
* **`develop` (Integración Continua):**
  * Es la rama de integración principal del día a día.
  * Toda rama de funcionalidad nace de `develop` y se reintegra a `develop`.
* **`feature/<nombre-descriptivo>`:**
  * Ramas de desarrollo funcional (ej. `feature/models-buses-frecuencias`).
  * Solo pueden fusionarse hacia `develop`.
* **`release/<version>`:**
  * Ramas de preparación de entrega formal (ej. `release/v1.0.0`).
  * Nacen de `develop`, estabilizan la versión y se fusionan simultáneamente a `main` y a `develop`.
* **`hotfix/<version-parche>`:**
  * Ramas de resolución de incidentes críticos en producción.
  * Nacen directamente de `main` y se fusionan de regreso a `main` (con nuevo tag) y a `develop`.

> ⚠️ **REGLA DE AUDITORÍA CRÍTICA:** Está estrictamente prohibido marcar la opción de eliminación automática de ramas (*delete head branch*) al completar un merge. Todas las ramas deben conservarse como evidencia histórica de colaboración.

---

## 2. Política de Pull Requests y Revisiones de Código (Code Review)

1. **Plantilla Obligatoria:** Todo PR debe ser creado respetando cada sección de `.github/PULL_REQUEST_TEMPLATE.md`.
2. **Revisión por Pares (Peer Review):** Todo PR exige la aprobación técnica de **al menos 2 integrantes designados** en la matriz de responsabilidades antes de habilitarse el botón de fusión.
3. **Evidencias Obligatorias:** Cada PR debe adjuntar capturas de pantalla, respuestas de endpoints o logs de prueba que demuestren que el código compila y satisface el requerimiento.
4. **Estrategia de Fusión:** Se utilizará siempre **"Create a merge commit"** para mantener intacto el grafo histórico de Git (no utilizar Squash ni Rebase para preservar los commits de los autores individuales).

---

## 3. Estándar de Mensajes de Commit (Conventional Commits)

Todos los mensajes deben redactarse en **español**, en tiempo presente, imperativo y en minúsculas:

```text
<tipo>(<alcance>): <descripción concisa del cambio>

### Tipos Permitidos
* `feat`: Nuevas características, maquetación de secciones HTML o componentes interactivos.
* `style`: Declaración de reglas CSS, diseño responsivo, tipografías y adaptación móvil.
* `fix`: Corrección de errores en código, validaciones o resolución de conflictos de integración.
* `docs`: Inclusión o modificación de documentación técnica (`README.md`, `CONTRIBUTING.md`).
* `chore`: Mantenimiento de configuración general, estructura de carpetas o vinculación de dependencias.

### Normas de Estilo en Commits
1. Redactar el verbo principal en modo imperativo y minúsculas (ejemplo: `feat: agregar...`, no `feat: agregando...`).
2. Longitud máxima recomendada de 50 caracteres para la primera línea.
3. No colocar punto final al cierre de la línea de descripción.

---
## Criterios de Aceptación para Revisores
Los revisores deben auditar la pestaña **Files changed** y verificar:
* QMínimo 2 aprobaciones: Ningún PR puede integrarse a develop o main sin la aprobación explícita de al menos 2 integrantes del equipo.
*Plantilla obligatoria: Todo PR debe completar la información solicitada en .github/PULL_REQUEST_TEMPLATE.md.
*Cero credenciales: Prohibido commitear archivos .env o credenciales de conexión reales.