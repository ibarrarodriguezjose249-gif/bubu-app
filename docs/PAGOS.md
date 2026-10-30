# BÜBÜ — Cobros, comisión y corte semanal (v0.4.0)

## Modo piloto (así arranca)

**BÜBÜ no recibe el dinero de los clientes.** El cliente le paga **directo al socio**, de una de estas dos formas:
- **en efectivo**, al entregar;
- **por transferencia** a la cuenta del socio (CLABE, tarjeta o Mercado Pago). El socio la registra en "Cuenta para transferencias" (app) o en "Mi negocio" (web).

El socio confirma "Recibí la transferencia" cuando le llega. La **comisión + IVA y la cuota de servicio** se suman a lo que el socio le debe a BÜBÜ. Si su adeudo pasa del límite, se **pausa** solo hasta que pague. El socio le paga a BÜBÜ por transferencia, y el admin lo registra en "Pagos a socios → Registrar pago del socio".

- Así BÜBÜ no cobra por cuenta de terceros, y por lo tanto no tiene que retener ISR ni IVA a los socios en esta etapa. **Confírmalo con tu contador.**
- Lo que BÜBÜ sí recibe (comisiones y cuotas) **es ingreso suyo**: cuando te des de alta en el SAT, eso es lo que facturas.
- El **pago con tarjeta (Stripe) está programado pero apagado.** Se enciende en el panel, en Pagos a socios → Configurar → "Mostrar Pagar con tarjeta". Hazlo solo cuando tengas Stripe configurado, tu alta en el SAT y el visto bueno de tu contador. Desde ese momento sí aplican las retenciones.

> **Estado de Stripe: MODO DE PRUEBA.** Aunque lo enciendas, con la llave de prueba (`sk_test_…`) solo se usan tarjetas de prueba. El servidor **se niega a cobrar** con una llave real (`sk_live_…`) a menos que actives los pagos reales a propósito (ver al final).

## Protecciones para que nadie "se haga el vivo"

| Riesgo | Protección |
|---|---|
| El socio anota menos de lo que cobró | El total que anota al pesar la ropa (el que ve y paga el cliente) es el que cuenta. **No se puede bajar al entregar**: solo se corrige antes de que el cliente pague, y el cliente ve el cambio. |
| El socio nunca marca "Entregado" | El **cliente** puede cerrar el pedido con **"Ya recibí mi ropa"**. El panel muestra **pedidos sin cerrar** con más de 3 días. |
| "Ya te transferí" contra "No me llegó" | El cliente toca **"Ya transferí"** con la **clave de rastreo** y la **foto del comprobante**. El socio recibe un aviso. El socio y el admin ven la foto y la clave, y la verifican en **banxico.org.mx/cep** (gratis y oficial). Si el socio no confirma en 24 h, aparece una alerta en el panel. |
| El socio no confirma el pago para no pagar comisión | No le sirve: la comisión cuenta **al entregar**, no al confirmar el pago. |

Las fotos de comprobantes se guardan en **Firebase Storage** (`receipts/{pedido}/…`, imagen de 5 MB como máximo). Solo las ven el cliente, el socio de ese pedido y el admin. No se pueden borrar ni cambiar desde la app. Las reglas están en `firebase/storage.rules`.

## Modelo de cobro (estilo DiDi / Uber)

| Concepto | Quién lo paga | Para quién | Por omisión |
|---|---|---|---|
| Servicio | Cliente | Socio | Lo anota el socio al pesar la ropa |
| **Cuota de servicio** | Cliente (**todos**, con tarjeta o en efectivo) | BÜBÜ | $10 por pedido |
| **Comisión + IVA** | Se le descuenta al socio | BÜBÜ | 30 % del servicio + 16 % de IVA sobre esa comisión |

Ejemplo de un servicio de $100:
- El cliente paga **$110**.
- Comisión: 30 % = $30, más IVA $4.80, da **$34.80**.
- El socio recibe **$65.20**.
- BÜBÜ se queda con $34.80 + $10 = **$44.80**. De ahí sale lo que cobra Stripe (~3.6 % + $3 por pago con tarjeta).

Con **tarjeta**, BÜBÜ cobra todo por Stripe y le deposita al socio su parte en el corte.
En **efectivo o por transferencia al socio**, el socio cobra todo ($110), y la comisión con IVA y la cuota ($44.80) se suman a lo que le debe a BÜBÜ.

> Sugerencia para el piloto: bajar la comisión a 10–15 % desde el panel, y subirla cuando haya volumen.

Todo se ajusta en el **panel admin → Pagos a socios → Configurar**: % de comisión, IVA, cuota de servicio y límite de adeudo. Los pedidos ya entregados conservan lo que tenían.

## Corte semanal

- **Semana de corte:** de sábado 00:00 a **viernes 23:59**.
- **Depósito:** el **martes** siguiente. Stripe tarda unos 3 días hábiles en pasarte el dinero, así que lo cobrado hasta el jueves ya está en tu cuenta para el martes.
- **Saldo del socio:**
  - Pedidos con tarjeta: servicio − comisión.
  - Pedidos en efectivo: se restan la comisión y la cuota.
  - Se restan los depósitos que ya le hiciste y se suman los pagos que él te hizo.
- Haces la transferencia desde tu banco y la registras con **Registrar depósito**. Si el socio te paga a ti, usa **Registrar pago del socio**.

## Límite de adeudo (estilo Uber)

- **Cuándo se pausa:** si un socio te debe **más** del límite (por omisión $300), el servidor lo **pausa**. No ve ni recibe pedidos nuevos, ni de solicitudes ni de reservas directas. Los pedidos que ya tiene sí los puede terminar.
- **Cuándo se despausa:** cuando registras su pago y el adeudo baja del límite, se despausa solo.
- **Avisos:** le llega una notificación en los dos casos.
- **Límite en 0:** no se pausa a nadie.

## Flujo del pago

1. El socio recibe y pesa la ropa y anota el **total del servicio**.
2. El cliente ve: servicio + cuota = total. Elige **Pagar con tarjeta** (abre Stripe) o **Pagaré en efectivo**.
3. Stripe avisa al servidor con un **aviso firmado**. El servidor revisa la firma, el pedido, la moneda (MXN) y el monto exacto (servicio + cuota). Solo entonces marca el pedido **pagado** y le avisa al socio.
4. Si algo no cuadra (otro monto, o un pago doble), el pedido queda **"En revisión"** en el panel, para que reembolses desde Stripe.

## Seguridad

- **La app nunca marca "pagado".** Solo el servidor lo hace.
- **Las dos llaves de Stripe** (`STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`) se guardan como **secretos del servidor**. Nunca van en la app, ni en GitHub, ni en el chat.
- **Saldos y pausas:** solo el servidor los escribe (`providerBalances`, `debtBlocks`). Ni el socio ni el admin pueden cambiarlos desde la app.
- **Reglas al entregar:** el % de comisión, el IVA y la cuota los pone el sistema; el socio no los puede cambiar.

## Configurar Stripe en modo de prueba (una vez)

1. Crea tu cuenta gratis en **stripe.com** y deja el **modo de prueba** activado (el interruptor "Test mode").
2. En **Developers → API keys**, copia la **Secret key** de prueba (`sk_test_…`). No la compartas.
3. En **Cloud Shell**, dentro de la carpeta `bubu`, guárdala. El comando te la pide; pégala ahí:
   ```
   npx firebase-tools@latest functions:secrets:set STRIPE_SECRET_KEY --project bubi-246b8
   ```
4. Publica las funciones una primera vez. Te va a pedir el segundo secreto; pon cualquier texto, por ejemplo `pendiente`:
   ```
   npx firebase-tools@latest deploy --only functions --project bubi-246b8
   ```
5. En Stripe, ve a **Developers → Webhooks → Add endpoint**.
   - URL: `https://us-central1-bubi-246b8.cloudfunctions.net/webhookStripe`
   - Eventos: `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
   - Al crearlo, copia el **Signing secret** (`whsec_…`).
6. Guarda ese secreto y vuelve a publicar:
   ```
   npx firebase-tools@latest functions:secrets:set STRIPE_WEBHOOK_SECRET --project bubi-246b8
   npx firebase-tools@latest deploy --only functions --project bubi-246b8
   ```
7. Para probar, usa la tarjeta **4242 4242 4242 4242**, con cualquier fecha futura y cualquier CVC.

## Activar pagos reales (más adelante, NO todavía)

Solo cuando tengas tu alta en el SAT, tu cuenta de Stripe verificada y el visto bueno de tu contador (IVA de tus comisiones, y retenciones de ISR e IVA a socios con su CFDI, como hace DiDi):

1. Pon la llave **live** (`sk_live_…`) en `STRIPE_SECRET_KEY`, y crea el webhook también en modo live.
2. Crea el archivo `firebase/functions/.env` con la línea `PAGOS_REALES=si`.
3. Vuelve a publicar las funciones.

## Pruebas

- **Servidor:** 20 pruebas que pasaron con datos simulados y sin internet. Incluyen:
  - la firma del aviso de Stripe (válida, alterada, vieja o ausente);
  - el monto exacto con la cuota, pagos dobles y avisos repetidos;
  - comisión 30 % + IVA, saldos con efectivo y tarjeta, bloqueo por adeudo y la semana sábado–viernes.
- **Web de socios:** 58/58 en navegador con datos simulados. Incluye la cuenta para transferencias, el comprobante con clave y foto, confirmar una transferencia, el total bloqueado al entregar y la pausa por adeudo.
- **Panel admin:** 74/74 en navegador con datos simulados. Incluye la configuración, el interruptor de tarjeta, las alertas, el comprobante y la pausa por adeudo.
- **Reglas de Firestore:** 99 pruebas escritas, **no ejecutadas** (el emulador no corre en la sesión de desarrollo).
- **Reglas de Storage:** sin pruebas automáticas.
- **Subir la foto desde la app:** no probado (requiere teléfono).
- **Sin probar:**
  - El pago en el modo de prueba real de Stripe (la sesión de desarrollo no puede conectarse con Stripe).
  - El webhook ya publicado.
  - La app en el teléfono.
