# BÜBÜ: PIN de entrega, fotos de la bolsa y código de bolsa

## Qué hace

| Momento | Qué pasa |
|---|---|
| Se crea el pedido | El servidor genera un **PIN de 4 números**. Solo lo ve el **cliente**, en su pedido. El socio no lo puede leer. |
| El socio recibe y pesa la ropa | Anota el total y **debe tomar la foto de la bolsa en la báscula**. La foto de la bolsa al recolectar es opcional. |
| El socio entrega | Escribe el **PIN que le dice el cliente**. El servidor lo revisa: si es correcto, el pedido queda **"Entregado con PIN"**. |
| PIN equivocado | Le quedan intentos (máximo **5**). Después de 5, solo puede entregar con foto. |
| El cliente no tiene su PIN (o el pedido es anterior y no tiene PIN) | El socio entrega **con foto de la bolsa entregada**. El pedido queda **"Entregado con foto (en revisión)"** y aparece en las alertas de tu panel. |
| Tu panel | Ves las fotos (báscula, recolección, entrega), si fue con PIN o con foto, y el botón **"Marcar entrega como revisada"**. |

- **Código de bolsa:** `BÜ-` más los 4 primeros caracteres del número del pedido (por ejemplo `BÜ-K7Q2`). Se ve en el pedido (app, portal y panel) para escribirlo en la bolsa. Los códigos QR quedan para después.
- Las fotos son de la **bolsa cerrada**, no de la ropa.
- Las fotos se **borran solas a los 90 días** (regla del bucket, ver abajo).
- El cliente sigue pudiendo cerrar con **"Ya recibí mi ropa"**.

## Piezas

- `firebase/functions/entrega.js`: la lógica del PIN (generar, comparar y decidir la entrega). Tiene pruebas.
- `firebase/functions/index.js`:
  - `crearPinEntrega`: se ejecuta al crearse un pedido y escribe `deliveryPins/{pedido}`.
  - `entregarConPin`: el socio manda el PIN; el servidor lo revisa dentro de una transacción y marca el pedido como entregado.
- `mobile/src/services/evidence.js`: tomar la foto (cámara; si no hay permiso, galería), subirla, leer el PIN (cliente) y entregar con PIN o con foto.
- `mobile/app.json`: el plugin `expo-image-picker` ahora **pide permiso de cámara**. Va en el APK nuevo 0.4.0, que ya se iba a instalar por las notificaciones.
- `socios-web/app.js`: los mismos pasos en el portal. En el celular, el campo de foto abre la cámara.
- `socios-web/_headers`: se permite llamar a Cloud Functions (`*.cloudfunctions.net`).
- `admin/app.js`: fotos, bolsa, alertas de entregas con foto y el botón "Marcar entrega como revisada" (queda en la bitácora).

## Cambios en las reglas (qué permite y qué no)

**Firestore** (`firebase/firestore.rules`):
1. **`deliveryPins/{pedido}`** (nueva):
   - Solo la lee el **cliente** de ese pedido (y el admin, uno por uno).
   - Nadie la lista.
   - **Nadie la escribe desde la app.** Solo el servidor.
2. **Socio, al anotar el total** (al pasar a "En proceso" o al corregirlo): ahora **exige** `weightPhotoPath` con una ruta de **ese mismo pedido** (`evidence/{pedido}/weight-…`). La foto de recolección (`pickupPhotoPath`) es opcional, también de ese pedido. Las fotos solo se anotan en ese paso.
3. **Socio, al entregar directo**: ahora **exige** `deliveryVerified: 'photo'` y `deliveryPhotoPath` de ese pedido. El socio **no puede** poner `'pin'`: eso solo lo hace el servidor cuando el PIN es correcto.
4. **Admin**: puede marcar `deliveryReviewed` (sí/no) en un pedido.

- **No cambió nada más.** El cliente cierra igual con "Ya recibí mi ropa". Los totales, comisiones, pagos y chat siguen igual.
- Los pedidos que ya están "En proceso" sin foto se pueden terminar. Si el socio corrige el total, la app le pide la foto de la báscula en ese momento.

**Storage** (`firebase/storage.rules`): carpeta nueva `evidence/{pedido}/`.
- Solo sube fotos el **socio de ese pedido**, mientras esté aceptado, en proceso o listo.
- Solo se aceptan imágenes de menos de 5 MB, con nombre `weight-`, `pickup-` o `delivery-` + número.
- Las ven el cliente, el socio de ese pedido y los admins.
- Nadie las edita ni las borra desde la app.

## Borrado automático a los 90 días (una sola vez, en Cloud Shell)

El archivo `firebase/storage-lifecycle.json` borra todo lo que esté en `evidence/` cuando cumple 90 días. Los comprobantes (`receipts/`) no se tocan.

```
gcloud storage buckets update gs://TU-BUCKET --lifecycle-file=storage-lifecycle.json
```

`TU-BUCKET` es el nombre que sale en Firebase → Storage (algo como `bubi-246b8.firebasestorage.app`). Para comprobarlo:

```
gcloud storage buckets describe gs://TU-BUCKET --format="default(lifecycle_config)"
```

## Pruebas

| Qué | Resultado |
|---|---|
| Servidor (`cd firebase/functions && npm test`) | 26 de 26 pasaron. Incluye 5 del PIN: correcto, incorrecto, 5 intentos, solo el socio del pedido, pedido viejo sin total. Datos simulados. |
| Portal de socios (navegador, Firebase simulado) | 72 de 72 pasaron. Incluye foto de báscula obligatoria, PIN incorrecto y correcto, entregar con foto, y pedido pagado con tarjeta. |
| Panel admin (navegador, Firebase simulado) | 91 de 91 pasaron. Incluye fotos, alerta y "marcar revisada". |
| Reglas (110 pruebas, 4 nuevas de PIN y fotos) | **No se ejecutaron**: requieren el emulador. |
| App en teléfono (cámara, subir foto, PIN) | **No probado todavía.** |

## Lista de comprobación en el teléfono

1. E1: el cliente abre su pedido aceptado → ve **"Tu PIN de entrega"** y la bolsa `BÜ-…`.
2. E2: el socio toca "Recibí la ropa" **sin foto** → no lo deja. Con la foto de la báscula → pasa a "En proceso" y la foto se ve en el pedido.
3. E3: el socio marca "Listo" y escribe un **PIN equivocado** → "Te quedan 4 intentos".
4. E4: escribe el **PIN correcto** → queda "Entregado con PIN".
5. E5: otro pedido: "El cliente no tiene su PIN → entregar con foto" → toma la foto → queda "Entregado con foto (en revisión)" y aparece en las alertas del panel.
6. E6: en el panel, abrir ese pedido → se ven las fotos → "Marcar entrega como revisada" → desaparece de las alertas.

## Interruptor "Servidor activo" (modo puente sin plan Blaze)

Sin el plan Blaze no hay Storage (fotos) ni Cloud Functions (PIN y avisos con la app cerrada). Por eso todo esto depende de un interruptor en tu panel: **Pagos a socios → Comisión, cuota y límite → "Servidor activo"**. Solo el superadmin lo cambia.

| | Apagado (por omisión) | Encendido |
|---|---|---|
| Anotar el total | Sin foto | Foto de báscula obligatoria |
| Entregar | Como antes: "Marcar como entregado" | Con PIN del cliente, o con foto (queda para revisión) |
| PIN del cliente | No se muestra | Se muestra |
| Foto del comprobante de transferencia | Oculta (solo clave de rastreo) | Disponible |
| Pausa automática por adeudo | No hay: ponlo en revisión a mano | Automática |

Las reglas de Firestore leen el mismo interruptor: con el servidor apagado no exigen fotos ni PIN, y con él encendido sí.

**Enciéndelo solo cuando** el plan Blaze esté activo, Storage creado, las reglas de Storage subidas y las funciones del servidor desplegadas.

Pruebas del modo puente:
- Reglas: 3 pruebas nuevas, **no ejecutadas** (requieren el emulador).
- Portal de socios: con el servidor apagado se entrega como antes. Pasó (73 de 73).
- Panel: el interruptor se guarda. Pasó (91 de 91).
