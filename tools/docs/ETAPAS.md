# Avance por etapas — BÜBÜ

Leyenda de verificación:
- ✅ **Verificado** — se ejecutó y funcionó en la sesión de desarrollo.
- 🟡 **Escrito, NO probado** — el código existe, pero no se pudo ejecutar (sin npm, sin emulador, sin teléfono).
- ⬜ **Pendiente** — todavía no se ha hecho.

| # | Etapa | Estado |
|---|---|---|
| 1 | Base del proyecto, configuración de Firebase, correcciones | ✅ Probada en iPhone (Expo Go vía Snack, 28-oct-2026) |
| 2 | Cuentas, perfil, modo cliente/proveedor, solicitud de proveedor | ✅ Probada en iPhone: registro, sesión, perfil, admin, catálogo, cambio de modo y solicitud de proveedor. Falta: editar perfil, recuperar contraseña |
| 3 | Reglas de seguridad de Firestore + pruebas automáticas | ✅ Publicadas y funcionando en uso real (crear perfil, leer admin propio, admin escribe catálogo). 🟡 Las 51 pruebas del emulador aún no se ejecutan |
| 4 | Pedidos con ofertas: el cliente publica, los proveedores disponibles ofertan y el cliente elige; reserva directa; "Mis pedidos"; disponibilidad y "te perdiste" | ✅ Flujo principal probado de punta a punta (28-oct-2026). Vencimiento y "te perdiste" ✅. Reserva directa ✅. Falta probar: pruebas de seguridad |
| 5 | Modo Uber (conectarse, radar, tarjeta de pedido entrante, ¡Te eligieron!), calificaciones con estrellas, colonias en lista | 🟡 Escrito y revisado; NO probado en teléfono. Guía: `PRUEBAS_ETAPA5.md`. Pendiente aparte: notificaciones push |
| 6 | Panel administrativo web (usuarios, proveedores, categorías, pedidos, zonas, bitácora) | ✅ Publicado en Cloudflare y funcionando con Firebase real: inicio de sesión de admin y lectura de datos (28-oct-2026). 🟡 Falta probar las acciones que guardan cambios |
| 7 | Publicación: Cloudflare Pages + compilaciones EAS | 🟡 (pasos documentados en `PUBLICAR.md`, nada publicado) |

---

## Qué se pudo verificar en la sesión de desarrollo (v0.2)

✅ Los 32 archivos `.js` no tienen errores de sintaxis (revisados con el analizador de TypeScript).
✅ Todos los `import` entre archivos del proyecto apuntan a archivos y nombres que existen.
✅ Todos los paquetes externos que usa el código están en `mobile/package.json`.
✅ La tabla de transiciones de pedidos de la app es idéntica a la de las reglas (prueba automática).
✅ Las validaciones de correo, contraseña, nombre y teléfono dan los resultados esperados.
✅ Las reglas tienen llaves y paréntesis balanceados, y todas las funciones que se usan están definidas.

**No se pudo verificar** (requiere instalar paquetes o un dispositivo):
- 🟡 Que la app compile y abra en Expo Go (iPhone/Android) y en web.
- ✅ Las reglas compilaron y se publicaron en la consola de Firebase (27-oct-2026).
- 🟡 Que las 51 pruebas del emulador pasen (comportamiento de cada permiso).
- 🟡 El registro, el inicio de sesión y las lecturas/escrituras reales en Firestore.

---

## Prueba real en iPhone — 28 de octubre de 2026

Se ejecutó en el iPhone de José con **Expo Go (SDK 54)** cargando el código desde **Expo Snack** (sin Node.js), conectado al Firebase real `bubi-246b8`.

✅ La app abre y muestra el diseño de BÜBÜ.
✅ Lectura pública del catálogo (antes vacío: aviso correcto; después, 6 categorías).
✅ **Registro** con correo: creó `users/{uid}` con todos los campos y las reglas lo aceptaron.
✅ **Sesión iniciada** ("Hola, Jose.") y pantalla de perfil con datos reales.
✅ **Administrador**: el documento `admins/{uid}` creado en consola es reconocido (insignia "Administrador").
✅ **Cargar catálogo inicial** como admin: Lavandería activa + 5 categorías "Próximamente" + zona General Zuazua.

✅ **Cambio a modo proveedor** y **solicitud de proveedor** ("Lavandería México", estado *En revisión*), aceptada por las reglas.

Pendiente de probar en el teléfono: edición de perfil, recuperar contraseña.

Observado en Snack: dos veces un archivo quedó con su contenido duplicado ("has already been declared"), probablemente por tener el Snack abierto en varias pestañas. Se corrige pegando el archivo limpio de `snack/`.

### Diferencias de la versión de Snack (`snack/`)
Snack no puede empaquetar el paquete `firebase` completo (ni 13, ni 12, ni 10) ni acepta carpetas. Por eso `snack/` tiene:
- Los mismos archivos de `mobile/src`, **sin carpetas** (imports reescritos).
- Firebase importado por piezas: `@firebase/app`, `@firebase/auth`, `@firebase/firestore`.
- En Snack la sesión puede no guardarse al cerrar Expo Go (hay que volver a entrar).
La app "oficial" sigue siendo `mobile/` (Expo SDK 54 + `firebase` ^12). Cualquier cambio se hace en `mobile/` y se regenera `snack/`.

## Etapa 4 — Pedidos con ofertas (28-oct-2026) — 🟡 escrita, NO probada en teléfono

Decisiones de José: **ofertas + elegir** (con reserva directa como respaldo), **"pedidos que te perdiste" para proveedores**, **30 minutos** para recibir ofertas.

**Cliente**
- Inicio: contador real de lavanderías **"conectadas ahora"** y total en su zona; botón **Publicar pedido**; sus pedidos recibiendo ofertas.
- **Publicar pedido**: servicios (lavar, secar, doblar, planchar, edredones), cantidad, para cuándo, modalidad, colonia, detalles. **No se publica nombre, teléfono ni dirección.**
- **Detalle del pedido**: cuenta regresiva de 30 min, ofertas en vivo con etiquetas "💰 Mejor precio" y "⚡ Respondió primero", botón **Elegir**. Al elegir se piden dirección (si pasan por la ropa) y teléfono, que solo ve la lavandería elegida.
- Si vence sin ofertas: **Publicar de nuevo** o **reservar directo**.
- **Proveedores por categoría** (conectados primero) y **reserva directa** (el proveedor acepta o rechaza).
- **Mis pedidos**: publicados, en curso e historial; **detalle** con línea de avance, contacto y cancelar.

**Proveedor (aprobado)**
- Interruptor **"Estoy disponible"**. Mientras la app está abierta manda una señal cada 4 min; "conectado ahora" = disponible y con señal en los últimos 15 min.
- **Pedidos cerca de ti**: abiertos de su categoría y zona, con cuenta regresiva → **Mandar oferta** (precio estimado, cuándo recoge, cuándo queda lista, mensaje, teléfono).
- **¡Te eligieron!** → abre el pedido con dirección y teléfono del cliente.
- **Te perdiste esta semana**: cuántos tomó otra lavandería y cuántos vencieron sin respuesta (solo colonia, servicio y hora; nunca datos del cliente).
- **Pedidos recibidos**: aceptar/rechazar reservas directas y avanzar: recibí la ropa → listo → entregado.

**Reglas nuevas** (`firebase/firestore.rules`, deben **volver a publicarse**):
- Pedido publicado: vence a los ~30 min (20–40 min por diferencia de reloj); sin datos personales obligatorios.
- Ofertas: solo proveedores aprobados de esa categoría y zona, y solo antes de que venza.
- Elegir oferta: solo el dueño del pedido y solo una oferta que exista; el pedido nace "aceptado".
- Proveedores aprobados ven pedidos pasados de su zona (para "te perdiste").
- Disponibilidad: el proveedor solo cambia la suya.
- 9 pruebas nuevas en `firebase/tests/rules.test.js` (60 en total), **no ejecutadas**.

**Límites conocidos (honestos)**
- **Sin notificaciones push**: el proveedor solo ve pedidos nuevos con la app abierta. Las push requieren compilar con Node.js/EAS.
- El vencimiento se calcula en el teléfono; un pedido vencido sigue "open" en la base, pero la app y las reglas ya no aceptan ofertas.
- Sin calificaciones todavía, así que la etiqueta "⭐ Mejor calificado" no aparece. No se inventan datos.
- Las listas se filtran en el teléfono; si un día hay cientos de pedidos por semana, convendrá agregar índices.

Verificado en la sesión: sintaxis (42 archivos), imports, sin variables indefinidas, versión Snack generada con `tools/generar_snack.py` (26 archivos idénticos a los que ya funcionaron).

## Etapa 5 — Modo Uber, calificaciones y colonias (28-oct-2026) — 🟡 escrito, NO probado en teléfono

**Modo Uber (proveedor).** Desconectado: botón grande "Conectarme" y sus números reales (pedidos en curso, entregados hoy, calificación). Conectado: pantalla con radar animado, tiempo conectado y pedidos abiertos; al llegar un pedido sube una tarjeta "🔔 NUEVO PEDIDO" (Acepto / Proponer precio / Ahora no) y el teléfono vibra; cuando el cliente lo elige aparece "🎉 ¡Te eligieron!" (se recuerda en el teléfono para no repetirlo). La pantalla se mantiene encendida mientras está conectado (`expo-keep-awake`, módulo oficial de Expo — **dependencia nueva**). Solo funciona con la app abierta.
**Cliente:** radar "Buscando lavanderías cerca de ti…" con el número real de conectadas; vibración corta al llegar una oferta.
**Calificaciones:** colección `reviews/{orderId}`; el cliente califica 1–5 estrellas + comentario cuando el pedido está Entregado; promedio y comentarios en ofertas y lista de lavanderías ("✨ Nuevo" si no tiene); el proveedor ve las suyas; el admin las oculta desde el panel (sección Reseñas) con bitácora.
**Colonias:** al publicar o reservar, sugerencias de las colonias capturadas en el panel; se puede escribir otra.
**Reglas:** solo se AGREGÓ el bloque `reviews` (nada existente cambió). 6 pruebas nuevas de reglas (75 en total, no ejecutadas).
**Verificado:** sintaxis e imports de los 46 archivos de la app y del Snack; panel admin 50/50 con Firebase simulado. **No verificado:** nada de la app en teléfono todavía.

## Etapa 6 — Panel administrativo web (28-oct-2026) — 🟡 probado solo con Firebase simulado

Carpeta `admin/` (HTML + JS, Firebase 13.1.0 por CDN, sin compilar). Instrucciones en `admin/LEEME.md`.
- Secciones: Resumen, Proveedores (aprobar / rechazar con motivo / suspender), Pedidos (corregir estado con nota), Solicitudes (ver ofertas, cancelar), Usuarios (suspender/reactivar), Categorías (crear, activar, opciones de servicio), Zonas y colonias, Bitácora.
- Cada acción escribe el cambio y su registro en `auditLog` en un solo paso (writeBatch).
- **No se cambiaron las reglas de Firestore**: el panel solo usa los campos que las reglas ya permiten al admin.
- Verificado en el navegador de desarrollo con un Firebase **simulado** (Playwright): 46 de 46 comprobaciones, incluidas acceso denegado a no-admins, nombres con HTML escapados, error de permisos, campos permitidos por reglas y vista de celular.
- ✅ 28-oct-2026, 19:28: publicado en Cloudflare (`bubu-adminpagesdevhidden-tooth-7732.planta-inv.workers.dev`), dominio autorizado en Firebase; el admin inició sesión y el Resumen mostró los datos reales (2 usuarios, 1 proveedor aprobado, 2 pedidos). Pendiente: probar aprobar/rechazar, editar categorías/colonias y la bitácora con datos reales.
- Nota: si el navegador traduce la consola de Firebase, "planta" se ve como "plant"; el valor guardado es correcto.
- Limitación honesta: las colonias capturadas se guardan, pero la app todavía pide escribir la colonia a mano (usarlas como lista en la app es un cambio pendiente).

## Etapa 4.1 — Ajustes del modelo híbrido (28-oct-2026) — ✅ flujo principal probado

**Prueba real (28-oct-2026, 18:57):** cliente en la vista Web de Snack (cuenta `+cliente`) y proveedor "Lavandería México" en el iPhone (Expo Go), con Firebase real y las reglas 4.1 publicadas.
- ✅ Publicar pedido, recibir la oferta, elegirla y crear el pedido "Aceptado".
- ✅ El proveedor avanzó un pedido hasta **"Entregado"** ("Lavar, Secar · 2–3 bolsas", Real de Palmas); el cliente lo ve en **Historial**.
- ✅ Un segundo pedido ("Lavar · 1 bolsa o carga") quedó **"Aceptado"** en curso.
- ✅ 19:30: un pedido sin ofertas venció a los 30 min, desapareció de "Pedidos cerca de ti" y el proveedor vio "📉 Te perdiste esta semana: 1 venció sin respuesta" (Lavar en real de palmas).
- ✅ 19:33: reserva directa — el pedido llegó al proveedor como "Solicitado" con Aceptar / Rechazar, sin teléfono del cliente porque no lo compartió.
- Pendiente de probar: las pruebas de seguridad S1–S3 de `PRUEBAS_ETAPA4.md`.


Revisión contra los 10 puntos del modelo híbrido tipo Uber/DiDi (ver conversación). Cambios:
1. **Fecha y horario**: "Lo antes posible" o uno de los próximos 7 días + franja (Temprano 8–12, Tarde 12–6, Noche 6–9). Se guarda `whenText` y `preferredDate`.
2. **Botón "👍 Acepto"** para el proveedor (oferta `kind: 'accept'` en el horario del cliente, sin precio), además de "Proponer precio u horario".
3. **Opciones de servicio desde la categoría** (`categories/{id}.serviceOptions`); si no existe, se usan las del código.
4. "Conectadas ahora" ya **no te cuenta a ti mismo**.
5. Reglas: **solo ofertan proveedores con "Estoy disponible"**.
6. Reglas: la oferta exige **misma categoría, misma zona y modalidad compatible**.
7. Reglas: **imposible asignar dos veces** la misma solicitud. El pedido y la solicitud "assigned" deben escribirse en el mismo paso y apuntarse uno al otro (`getAfter`/`existsAfter`).
8. **Tipo de proveedor**: 🏪 Negocio / 🏠 Desde casa (`providerType`), visible en la lista y en las ofertas.

Pruebas de reglas: 69 (9 nuevas), **no ejecutadas**. Guía manual: `docs/PRUEBAS_ETAPA4.md`.

---

## Etapa 1 — Base del proyecto

**Cambios y por qué**

| Archivo | Cambio | Motivo |
|---|---|---|
| `database/schema.sql` → `docs/referencia/schema_postgresql.sql` | Movido, sin borrar | Se usa Firestore en lugar de PostgreSQL. El modelo se tradujo en `MODELO_FIRESTORE.md` |
| `backend/API_INICIAL.md` → `docs/referencia/API_REST_INICIAL.md` | Movido | No habrá servidor propio por ahora. Las "reglas críticas" de ese archivo se implementaron en `firestore.rules` |
| `.env.example` (raíz) → `docs/referencia/env_servidor.example` | Movido | Eran variables de un servidor que no existe. Las de Firebase están en `mobile/.env.example` |
| `README.md` → `docs/referencia/README_v0.md` | Conservado. Nuevo `README.md` | Describe la estructura nueva |
| `mobile/App.js` | Reemplazado. Original en `docs/referencia/App_v0_pantalla_unica.js` | Ahora es el punto de entrada con sesión y navegación. El diseño (cabecera azul, tarjetas, botones) se conservó en `src/components/Hero.js`, `CategoryList.js` y `ui.js` |
| `mobile/package.json` | Agregadas dependencias (lista abajo) | Firebase, navegación, sesión persistente y versión web |
| `mobile/app.json` | `bundleIdentifier`/`package` = `mx.bubu.app`, `scheme`, `web`, slug `bubu-servicios` | Obligatorios para compilar con EAS. **Confirma el identificador** antes de publicar |
| `prototipo_web.html` | Sin cambios | Referencia visual |
| `docs/PLAN_LANZAMIENTO.md` | Sin cambios al texto original. Nota de estado al final | — |

**Errores corregidos del código original**
- `fontWeight: '850'` (no válido en React Native) → `'800'`.
- `SafeAreaView` de `react-native` (obsoleto en SDK 54) → `react-native-safe-area-context`.
- Se usaba `alert()` en el prototipo. La app nueva no usa `Alert`, porque no funciona en la versión web: usa avisos en pantalla y ventanas propias.

**Decisión: se mantiene Expo SDK 54.** Es la versión que abre Expo Go de la App Store. SDK 55–57 aún no están aprobados ahí, y en iPhone requieren la cuenta de desarrollador de pago.

**Archivos nuevos:** `mobile/src/lib/firebase.js`, `firebaseConfig.js`, `authInit.native.js`, `authInit.web.js`, `errors.js`, `validation.js`, `mobile/src/constants/*`, `mobile/.env.example`, `mobile/eas.json`, `.gitignore`.

## Etapa 2 — Cuentas y perfiles

**Qué hace (cuando se pruebe):**
- Pantalla pública con las categorías reales de Firestore y buscador.
- Crear cuenta (nombre, correo, contraseña, teléfono y colonia opcionales), iniciar sesión, recuperar contraseña y enviar correo de verificación.
- La sesión se mantiene al cerrar la app (AsyncStorage en el teléfono, almacenamiento local en web).
- Perfil `users/{uid}`: ver, editar y cerrar sesión.
- **Cambio de modo cliente/proveedor** con la misma cuenta (botón en la cabecera o en Perfil). Se guarda en `activeMode`.
- Modo proveedor: solicitud (`providers/{uid}`) con nombre del negocio, descripción, categorías activas, zonas y modalidad. Queda **pendiente** hasta que un admin la aprueba. Si la rechazan, se corrige y se reenvía.
- Admin (solo si existe `admins/{tuUID}`): **Cargar catálogo inicial**.
- Cuenta suspendida: pantalla de bloqueo.

**Archivos:** `src/context/AuthContext.js`, `CatalogContext.js`, `src/services/users.js`, `providers.js`, `catalog.js`, `src/components/*`, `src/navigation/RootNavigator.js`, `src/screens/**`.

**Qué aún NO hace (y la app lo dice en pantalla):** lista de proveedores, solicitudes, reservas, pedidos y pagos.

**Cómo probar:** sigue `CONFIGURAR_FIREBASE.md` (pasos 1 a 5) y luego:
1. `cd mobile && npm install && npx expo install --fix && npx expo start`.
2. Crea una cuenta y revisa en la consola que aparezca `users/{tuUID}`.
3. Cierra la app y vuelve a abrirla: debes seguir con la sesión iniciada.
4. Cambia a modo proveedor → envía la solicitud → en la consola aparece `providers/{tuUID}` con `status: pending`.
5. Hazte admin (paso 4) → Perfil → Herramientas → Cargar catálogo.
6. Web: `npx expo start --web`.

## Etapa 3 — Reglas de seguridad

**Archivos:** `firebase/firestore.rules`, `firebase/tests/rules.test.js`, `firebase/firebase.json`, `.firebaserc`, `firestore.indexes.json`, `package.json`.

Resumen de lo que protegen (detalle en `MODELO_FIRESTORE.md`):
- Sin sesión: solo se lee el catálogo.
- Nadie se da permisos de admin. Nadie se auto-aprueba como proveedor.
- Cada usuario ve y edita solo su perfil, y no puede cambiar su estado ni su correo.
- Solo proveedores aprobados publican servicios, ven solicitudes de su zona y categoría, y reciben pedidos.
- Pedidos visibles solo para cliente, proveedor y admin. Estados con transiciones fijas. Precios y datos inmutables tras crear. No se borran.
- Bitácora de admin: solo se agrega, no se edita.

**Cómo probar:** `CONFIGURAR_FIREBASE.md`, sección 6.

**Limitaciones conocidas:** las reglas no limitan la cantidad de pedidos o solicitudes que crea un usuario (anti-spam): eso requiere Cloud Functions (plan Blaze) o App Check. Lo revisamos antes del piloto.

---

## Dependencias que hay que instalar (y por qué)

No se pudieron instalar en la sesión de desarrollo. Al correr `npm install` en tu computadora se instalan solas.

**`mobile/`**
| Paquete | Para qué |
|---|---|
| `firebase` (^12) | Authentication y Firestore. Expo exige la versión 12 o superior |
| `@react-native-async-storage/async-storage` | Guardar la sesión en el teléfono |
| `@react-navigation/native`, `native-stack`, `bottom-tabs` | Navegación entre pantallas y pestañas |
| `react-native-screens`, `react-native-safe-area-context` | Requeridos por la navegación; respetar el notch y la barra del iPhone |
| `react-dom`, `react-native-web`, `@expo/metro-runtime` | Versión web (para Cloudflare Pages) |

Después de `npm install`, corre `npx expo install --fix`: corrige cualquier versión que no coincida exactamente con SDK 54.

**`firebase/`** (solo para pruebas y publicar reglas, no va dentro de la app)
| Paquete | Para qué |
|---|---|
| `firebase-tools` | Emulador local y publicar reglas |
| `@firebase/rules-unit-testing`, `firebase` | Ejecutar las pruebas de reglas |
| Java 21+ (no es de npm) | Lo necesita el emulador de Firestore |

Si quieres que yo mismo ejecute las pruebas en una sesión futura, haría falta permitir el acceso a `registry.npmjs.org` y a los servidores de descarga de Firebase (para el emulador).
