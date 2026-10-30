# BÜBÜ Socios — portal web para proveedores

Página web (HTML + JS, sin compilar) para que lavanderías y negocios atiendan BÜBÜ desde su **laptop**.
Usa la **misma cuenta, los mismos datos y las mismas reglas de Firestore** que la app BÜBÜ Socios.

## Qué hace
- Iniciar sesión, registrarse y recuperar contraseña (Firebase Authentication).
- **Mi negocio**: enviar o editar la solicitud de proveedor (queda "En revisión" hasta que el admin la apruebe).
- **Conectarme / Desconectarme** (mismo `isAvailable` que la app), con latido cada 4 min y pantalla encendida (Wake Lock) mientras la pestaña esté abierta.
- **Pedidos en vivo**: tarjeta "NUEVO PEDIDO" con **sonido**, título de la pestaña parpadeando y notificación del navegador (si se permite). Acepto / Proponer precio / Ahora no.
- **Mis pedidos**: En curso / Por aceptar / Historial; detalle con dirección y teléfono del cliente; avanzar estado (mismas transiciones que la app).
- **Calificaciones**: promedio, distribución y comentarios.
- **¡Te eligieron!**: ventana con sonido cuando un cliente elige tu oferta.

## Límites honestos
- Los avisos funcionan **con la página abierta** (puede estar en otra pestaña). Si se cierra, deja de recibir pedidos y a los ~15 min aparece como no conectado.
- La primera vez, el navegador puede pedir permiso para notificaciones; el sonido se activa al presionar "Conectarme".

## Publicar en Cloudflare (igual que el panel)
1. Cloudflare → Workers & Pages → **Upload your static files** → nombre `bubu-socios` → arrastra `bubu_socios_web.zip` → Deploy.
2. Firebase → Authentication → Settings → **Authorized domains** → agrega la dirección que te dé Cloudflare (sin https://).
3. Para actualizar: el mismo proyecto → nuevo despliegue con el ZIP nuevo.
