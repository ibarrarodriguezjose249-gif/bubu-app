# Guía de pruebas — Etapa 5 (modo Uber + calificaciones + colonias)

Marca ✅ o ❌ y manda captura de cualquier ❌.

## Preparación
1. Firebase → Firestore → **Reglas**: pega `firebase/firestore.rules` completo (agrega la colección `reviews`) → **Publicar**.
2. Snack **nuevo** (una sola pestaña): Import files con todos los `.js` de `snack/` **excepto** `App.js` → pega `App.js` y `package.json` (ahora incluye `expo-keep-awake`) → **Save**.
3. Panel admin: Cloudflare → tu proyecto → **Nuevo despliegue** → sube `bubu_admin_panel.zip`.
4. Panel admin → **Zonas y colonias** → captura 3 o 4 colonias reales (ej. Real de Palmas).

## Modo Uber (proveedor en iPhone, cliente en la web de Snack)
| # | Quién | Qué hacer | Resultado esperado |
|---|---|---|---|
| U1 | Proveedor | Modo proveedor → Inicio | Botón redondo **Conectarme** + pedidos en curso, entregados hoy y calificación |
| U2 | Proveedor | Toca **Conectarme** | Pantalla azul oscuro con **radar**, "Buscando pedidos…", tiempo conectado. La pantalla no se apaga |
| U3 | Cliente | Publica un pedido (prueba la lista de colonias) | Radar "Buscando lavanderías cerca de ti…" y "🟢 1 conectada ahora en tu zona" |
| U4 | Proveedor | (sin tocar nada) | **Vibra** y sube la tarjeta **🔔 NUEVO PEDIDO** con Acepto / Proponer precio / Ahora no |
| U5 | Proveedor | **👍 Acepto** | "✅ Oferta enviada · el cliente está eligiendo…" |
| U6 | Cliente | Mira el pedido | Llega la oferta, con "✨ Nuevo" (aún sin reseñas) |
| U7 | Cliente | Elige la oferta y confirma | — |
| U8 | Proveedor | (sin tocar nada) | Vibra y aparece **🎉 ¡Te eligieron!** → Ver pedido |
| U9 | Proveedor | Publica el cliente otro pedido y el proveedor toca **Ahora no** | La tarjeta se va; el pedido queda en "Pedidos abiertos cerca" |
| U10 | Proveedor | **Desconectarme** | Vuelve el botón Conectarme |

## Calificaciones
| # | Quién | Qué hacer | Resultado esperado |
|---|---|---|---|
| C1 | Proveedor | Avanza el pedido de U7 hasta **Entregado** | — |
| C2 | Cliente | Abre el pedido entregado | Tarjeta **"¿Cómo te fue con …?"** con 5 estrellas |
| C3 | Cliente | 5 estrellas + comentario → Enviar | "Tu calificación" con las estrellas; ya no se puede volver a calificar |
| C4 | Cliente | Lista de lavanderías / nueva oferta | La lavandería muestra **★ 5.0 (1)** y el comentario |
| C5 | Proveedor | Inicio (desconectado) y el pedido | Calificación ★ 5.0 y "Lo que dicen tus clientes" |
| C6 | Admin | Panel → **Reseñas** → Ocultar (con motivo) | Sale de la app y del promedio; queda en la Bitácora |

## Seguridad (deben FALLAR) — Zona de pruebas de reglas
| # | Prueba | Esperado |
|---|---|---|
| R1 | create `reviews/<id de un pedido NO entregado>` como el cliente | Denegado |
| R2 | create `reviews/<id de pedido entregado>` autenticado como el **proveedor** | Denegado |
| R3 | update de una reseña existente cambiando `stars`, como el cliente | Denegado |

## Limitaciones (honestas)
- Los avisos y la vibración funcionan **solo con la app abierta**. Con la app cerrada o el teléfono bloqueado no llega nada (eso son las notificaciones push, otra etapa).
- La web de Snack no vibra; el iPhone sí.
