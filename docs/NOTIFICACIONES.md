# BÜBÜ Socios — Notificaciones con sonido (v0.4.0)

## Qué hace

| Situación | Cómo avisa |
|---|---|
| App de Socios **abierta** y Conectado | Suena + vibra + aparece la tarjeta del pedido (no necesita servidor) |
| App **cerrada o en segundo plano** y Conectado | Notificación push con sonido (la manda el servidor, Cloud Functions) |
| Desconectado | No le llegan pedidos abiertos (igual que Uber) |

Avisos que se mandan al socio:
- **Nuevo pedido en tu zona**: solicitud abierta de su categoría, zona y modalidad, **solo si está Conectado**.
- **Nueva reserva**: un cliente lo reservó directamente (le llega aunque esté desconectado).
- **¡Te eligieron!**: el cliente eligió su oferta.

Los textos no llevan nombre, teléfono ni dirección del cliente, porque se ven en la pantalla bloqueada.

## Piezas

- `mobile/src/lib/notifications.js`: permiso, canal de Android "Pedidos nuevos" (importancia máxima), token del teléfono y sonido local.
- `ProviderHomeScreen.js`: registra el token al entrar como socio aprobado y suena al llegar pedidos, reservas o "Te eligieron". Si el socio negó el permiso, muestra un aviso para activarlo.
- `services/users.js`: al **cerrar sesión** se borra el token de ese teléfono.
- `firebase/firestore.rules`: nueva colección `pushTokens/{uid}`.
- `firebase/functions/`: `avisarSolicitudNueva` y `avisarPedidoNuevo`.
- `app.json`: versión **0.4.0** (versionCode 3) y plugin `expo-notifications`. Lleva un módulo nativo nuevo, así que **hay que instalar un APK nuevo**. Las apps 0.3.0 ya no reciben actualizaciones nuevas.

## Cambio en las reglas (qué permite y qué no)

```
match /pushTokens/{userId}
```
- Cada usuario **solo puede escribir o borrar su propio** documento (id = su UID).
- Solo se permiten los campos `token`, `platform` (android/ios), `app` y `updatedAt`. El token debe tener formato de Expo.
- **Nadie lo puede leer o listar**, ni otro usuario ni el admin desde la app. Solo el dueño puede leer el suyo.
- El servidor (Cloud Functions) lo lee con permisos de servidor, que no pasan por las reglas.
- **No se modificó ninguna regla existente.** Solo se agregó este bloque.

## Seguridad de las llaves

- `google-services.json` (de Firebase, para Android) **sí va** en `mobile/`. Tiene los mismos identificadores públicos que ya usa la app.
- La **llave privada de la cuenta de servicio** (JSON de "Generar nueva clave privada") **nunca va en GitHub ni en el código**. Solo se sube a expo.dev (credenciales FCM) y después se borra de la computadora.

## Pruebas

- Lógica del servidor: `cd firebase/functions && npm test`. Son 6 pruebas y pasaron en la sesión de desarrollo, con datos simulados y sin internet.
- Reglas: 3 pruebas nuevas en `firebase/tests/rules.test.js` (las reglas tienen 90 pruebas en total, contando pagos y comisiones). **No se ejecutaron**: requieren el emulador, que no corre en la sesión de desarrollo.
- En teléfono real: **no probado todavía**. Ver la lista de comprobación abajo.

## Lista de comprobación en el teléfono

1. N1: abrir BÜBÜ Socios → pide permiso de notificaciones → Permitir.
2. N2: Conectado y con la app abierta → desde otra cuenta (cliente) publicar un pedido → suena y aparece la tarjeta.
3. N3: Conectado, **cerrar la app** y bloquear el teléfono → publicar otro pedido → llega la notificación con sonido.
4. N4: Desconectado → publicar un pedido → **no** llega aviso.
5. N5: reserva directa (aunque esté desconectado) → llega "Nueva reserva".
6. N6: el cliente elige la oferta → llega "¡Te eligieron!".
7. N7: cerrar sesión → publicar un pedido → ese teléfono ya **no** recibe avisos.
