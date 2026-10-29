# BÜBÜ — Proyecto inicial

BÜBÜ es una plataforma para conectar clientes con proveedores de servicios locales. El piloto inicial está planteado para General Zuazua, Nuevo León, comenzando con lavanderías.

## Estado actual

Este paquete es una **base inicial de desarrollo**, no una aplicación lista para producción ni publicada en App Store/Google Play. Incluye:
- `prototipo_web.html`: prototipo interactivo de interfaz.
- `mobile/`: punto de partida Expo + React Native.
- `backend/`: contrato inicial de API y reglas importantes.
- `database/schema.sql`: esquema inicial de PostgreSQL.
- `docs/PLAN_LANZAMIENTO.md`: pasos para construir y lanzar con seguridad.
- `.env.example`: variables de entorno de ejemplo; no contiene claves reales.

## Requisitos para continuar

- Node.js LTS y npm.
- Expo Go para probar en un teléfono durante el desarrollo.
- Una base PostgreSQL administrada.
- Proveedor de autenticación y pagos que opere en México.
- Dominio y hosting para la API y el panel administrativo.
- Aviso de privacidad, términos, políticas de cancelación y revisión legal de pagos/protección.

## Arranque de la app móvil

Desde la carpeta `mobile`:

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go. Esta base solo muestra una pantalla inicial y todavía no conecta a servicios reales.

## Seguridad

No pongas claves privadas, credenciales de pagos ni secretos en la aplicación móvil. Las operaciones de pagos, permisos de administración y verificación deben validarse en el servidor. No uses datos reales de clientes en esta versión de prueba.
