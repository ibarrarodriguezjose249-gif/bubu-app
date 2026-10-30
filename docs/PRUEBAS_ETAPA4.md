# Guía de pruebas — Etapa 4 (pedidos con ofertas)

Solo con **Claude Pro, Firebase y Expo Snack**. Marca ✅ o ❌ y manda captura de cualquier ❌.

## Preparación (una vez)
1. Firebase → Firestore → **Reglas**: pega `firebase/firestore.rules` completo → **Publicar**.
2. Firebase → Firestore → `providers/{tu UID}` → `status` = `approved`.
3. Snack **nuevo** (una sola pestaña), con sesión iniciada → Import files con todos los `.js` de `snack/` **excepto** `App.js` → pega `App.js` y `package.json` → **Save**.
4. Necesitas **dos cuentas**:
   - **Proveedor** = tu cuenta, en el **iPhone** (Expo Go).
   - **Cliente** = un segundo correo, en la vista **Web** de Snack, en la computadora.

## Pruebas del flujo
| # | Quién | Qué hacer | Resultado esperado |
|---|---|---|---|
| 1 | Proveedor | Modo proveedor → activa **Estoy disponible** | Tarjeta verde "🟢 Estoy disponible"; en Firebase, `isAvailable: true` |
| 2 | Cliente | Inicio | "1 conectadas ahora" (no se cuenta a sí mismo) |
| 3 | Cliente | **Publicar pedido**: Lavar + Doblar, 2–3 bolsas, día **Mañana**, horario **Tarde**, "Pasan por ella", colonia | Pantalla con contador de 30:00 y "Esperando ofertas…"; en Firebase, `requests` con `whenText` "Mañana · Tarde (12–6)" y **sin** nombre ni teléfono |
| 4 | Proveedor | Inicio → aparece el pedido → **👍 Acepto · Mañana · Tarde** | "✓ Aceptaste — el cliente decide" |
| 5 | Cliente | Mira la pantalla del pedido (sin recargar) | Aparece la oferta con "👍 Acepta tu horario" y la etiqueta 🏠/🏪 |
| 6 | Cliente | **Elegir esta oferta** → dirección y teléfono → Confirmar | Abre el pedido "Aceptado"; en Firebase, `orders` nuevo y la solicitud con `status: assigned` y `orderId` |
| 7 | Proveedor | Inicio | "🎉 ¡Te eligieron!" → ver pedido con dirección y teléfono del cliente |
| 8 | Proveedor | Recibí la ropa → Marcar listo → Marcar entregado | El estado avanza y el cliente lo ve cambiar |
| 9 | Cliente | Publica otro pedido y **no** hace nada por 30 min | "Sin elegir — venció"; botones Publicar de nuevo / Reservar directo |
| 10 | Proveedor | Inicio después de la prueba 9 | "📉 Te perdiste esta semana: 1 venció sin respuesta" (si no ofertaste) |
| 11 | Cliente | Lista de lavanderías → **Reservar directo** | Pedido "Solicitado"; el proveedor puede Aceptar o Rechazar |

## Pruebas de seguridad (deben FALLAR)
| # | Qué intentar | Resultado esperado |
|---|---|---|
| S1 | Proveedor **apaga** Estoy disponible y abre "Proponer precio" en un pedido | Botón deshabilitado y aviso. Si se forzara, Firebase responde "No tienes permiso" |
| S2 | Cliente elige una oferta y luego intenta elegir **otra** del mismo pedido | Ya no aparece "Elegir". Las reglas impiden una segunda asignación |
| S3 | Proveedor que solo "Recibe en su local" ve un pedido de "Pasan por ella" | "No ofreces esta modalidad"; las reglas también lo bloquean |

### Zona de pruebas de reglas (Firebase → Firestore → Reglas → Zona de pruebas)
Sirve para confirmar S1 sin la app:
1. Tipo: **create**. Ubicación: `requests/<ID de un pedido abierto>/offers/<tu UID>`.
2. **Autenticado**: sí, con proveedor = **tu UID**.
3. Documento: `providerId` = tu UID, `providerName` = "Prueba", `createdAt` = marca de tiempo del servidor.
4. Con `isAvailable: false` en tu proveedor → **Ejecutar** → debe salir **Denegado**. Con `true` → **Permitido**.
