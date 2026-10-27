# Plan para llevar BÜBÜ a un lanzamiento real

## Fase 1 — Validar el servicio local
- Entrevistar lavanderías y personas que lavan desde casa en General Zuazua.
- Confirmar precios, tiempos, horarios, zonas, entrega y recolección.
- Definir quién responde si una prenda se pierde o se daña.
- Conseguir proveedores reales y consentimiento para publicar sus perfiles.

## Fase 2 — Construir el MVP conectado
- Backend con autenticación, base de datos y permisos.
- Perfil cliente y perfil proveedor en una sola cuenta.
- Solicitudes, reservas, estados de pedido y notificaciones.
- Panel administrativo protegido con roles y bitácora.
- Cobertura geográfica validada en el servidor.

## Fase 3 — Pagos y operación
- Elegir un procesador disponible en México y confirmar sus reglas para marketplace, comisiones y pagos a terceros.
- No cobrar ni anunciar compensaciones hasta que los flujos estén probados y las condiciones estén redactadas.
- Pruebas de cancelaciones, reembolsos, contracargos y conciliación.

## Fase 4 — Piloto cerrado
- Probar con un grupo pequeño de proveedores y clientes que acepten participar.
- Usar datos de prueba antes de manejar información real.
- Medir tiempos de respuesta, pedidos completados, quejas y costos.

## Fase 5 — Publicación
- Crear cuentas de desarrollador de Apple y Google.
- Preparar iconos, capturas, ficha de tienda, política de privacidad y formularios de revisión.
- Completar pruebas de seguridad, accesibilidad y funcionamiento.
- Publicar gradualmente y atender soporte.

## Antes de aceptar clientes reales
Este repositorio no implementa todavía autenticación real, servidor, mapas, pagos, notificaciones, almacenamiento privado ni políticas de protección. No se debe presentar como listo para producción. También se necesita revisar obligaciones legales, fiscales, privacidad y consumo aplicables en México.

---

## Nota de estado (v0.2, octubre 2026)

La Fase 2 empezó con Firebase (Authentication + Cloud Firestore, proyecto `bubi-246b8`) en lugar del servidor PostgreSQL propio. Avance, pruebas pendientes y archivos en `docs/ETAPAS.md`. Lo que dice la sección "Antes de aceptar clientes reales" sigue vigente: todavía no hay pagos, mapas, notificaciones, almacenamiento privado ni políticas legales.
