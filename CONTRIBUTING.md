# Guía Oficial de Contribución y Gobernanza ITIL 4 / SCM

Este documento establece las políticas de ingeniería de software, flujo de control de cambios y estándares de revisión obligatorios para el proyecto **"En Ruta — Transporte Interprovincial UTA"** (Grupo G03).

---

## 1. Estrategia de Ramificación y Control de Cambios en Producción

El proyecto transitó de un modelo GitFlow inicial hacia una estrategia de **Control de Cambios y Releases Estricto sobre `main` (ITIL 4 Change Enablement)**:

* **`main` (Línea Base Oficial de Producción):**
  * Contiene exclusivamente versiones auditadas y operativas desplegadas en producción.
  * **Todo cambio nace directamente desde `main` y se fusiona mediante Pull Request directo a `main`** tras cumplir las 6 fases de ITIL 4.
  * Cada cierre en `main` debe etiquetarse con su correspondiente **Tag SemVer Anotado** (`v1.X.Y`).
* **`develop` (Rama de Respaldo Histórico):**
  * Se mantiene congelada durante la ejecución de los cambios.
  * Únicamente el Líder SCM (`@SnaiderToainga`) ejecuta una sincronización final (`git merge main`) al concluir el ciclo de cambios.

### Convención Estricta de Ramas por Ticket
* **Cambios Normales (`feat`):** Nombres con prefijo `feature/cr-XX-<descripcion>` (incremento MINOR: `v1.X.0`).
* **Cambios de Emergencia / Estándar (`fix`):** Nombres con prefijo `hotfix/cr-XX-<descripcion>` (incremento PATCH: `v1.X.Y`).

> ⚠️ **REGLA SCM CRÍTICA:** Queda prohibido eliminar ramas fusionadas (*never delete head branch*). Todas deben conservarse en el repositorio remoto como evidencia para auditoría.

---

## 2. Gobernanza CAB y Política de Revisión Colegiada (Peer Review)

1. **Comité de Control de Cambios (CAB):**
   * **Presidente CAB / QA Lead:** Ing. Joel (`@joel427`)
   * **Líder SCM / Aprobador `main`:** Ing. Snaider Toainga (`@SnaiderToainga`)
2. **Regla de 2 Revisores Obligatorios:**
   * Ningún Pull Request puede fusionarse a `main` sin la aprobación formal de al menos **dos (2) revisores designados**.
3. **Segregación de Funciones:**
   * Ningún desarrollador puede aprobar su propio código.
   * Si Joel o Snaider son autores del cambio, la segunda aprobación técnica es asumida por un Desarrollador Senior Suplente (`@Cristian-1402` o `@Steven9tp`).
4. **Estrategia de Fusión:**
   * Siempre se utiliza **"Create a merge commit"** para preservar la autoría y trazabilidad histórica.

---

## 3. Estándar de Mensajes de Commit (Conventional Commits)

Formato obligatorio:
`<tipo>(<alcance>): [<TICKET>] <descripción concisa en minúsculas>`

* `feat`: Nueva funcionalidad o módulo del sistema.
* `fix`: Corrección de errores, parches y hotfixes.
* `docs`: Modificación o creación de documentación técnica.
* `test`: Adición o refactorización de pruebas unitarias/integración.
* `chore`: Ajustes de configuración, dependencias o tooling.
