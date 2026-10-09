# Política de Seguridad

La integridad, confidencialidad y control de la información son prioridades en el ciclo de vida de este proyecto académico.

## Versiones Soportadas

| Versión | Soportada |
| :--- | :--- |
| `1.0.x` | :white_check_mark: |
| `< 1.0.0` | :x: |

## Buenas Prácticas de Desarrollo y Manejo de Secretos

1. **Gestión de Variables de Entorno:**
   * Las cadenas de conexión a base de datos, contraseñas y claves de API jamás deben commitearse en Git.
   * Cualquier credencial debe permanecer exclusivamente en el archivo `.env` local, el cual está restringido mediante `.gitignore`.
2. **Validación de Archivos Adjuntos:**
   * La recepción de comprobantes de pago bancarios debe restringirse a tipos MIME legítimos (imágenes PNG, JPG y documentos PDF) con límites de tamaño por archivo.

## Reporte de Vulnerabilidades

Si detectas un fallo de seguridad, fuga de credenciales o vulnerabilidad en el repositorio:
1. Notifícalo de inmediato al líder de proyecto vía correo electrónico o mensaje directo en el equipo de desarrollo.
2. No crees un Issue público sobre vulnerabilidades de seguridad antes de que hayan sido corregidas mediante una rama `hotfix/*`.