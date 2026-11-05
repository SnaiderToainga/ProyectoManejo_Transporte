# Documentación Técnica: Hotfix v1.0.4 - Renderizado de Códigos QR en Clientes de Correo (CID)
**Proyecto:** En ruta - Transporte UTA  
**Tipo:** Hotfix de Compatibilidad de Notificaciones  
**Autor:** @SnaiderToainga (Tech Lead)

## 1. Descripción de la Incidencia
En clientes de correo web modernos como Gmail y Outlook Web, las imágenes codificadas directamente como DataURL Base64 (`<img src="data:image/png;base64,...">`) son bloqueadas o eliminadas por políticas de seguridad contra scripts maliciosos, provocando que el pasajero reciba el correo con un recuadro de imagen rota.

## 2. Solución Implementada
Se actualizó `backend/src/services/emailService.js` para adoptar el estándar RFC 2392 (Content-ID / CID):
1. **Conversión a Buffer:** La cadena Base64 generada por la librería `qrcode` se decodifica a un `Buffer` binario en memoria.
2. **Adjunto Embebido:** Se envía en la propiedad `attachments` de Nodemailer con identificador `cid: 'codigo_qr_boleto'`.
3. **Referencia en Plantilla:** El atributo `src` de la etiqueta `<img>` apunta a `cid:codigo_qr_boleto`.
4. **Fallback Local:** El visor HTML local de respaldo mantiene la renderización directa en DataURL para garantizar su visualización en navegadores sin cliente de correo.