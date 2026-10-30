# BÜBÜ v0.3 — Actualización de diseño y experiencia de usuario (28-oct-2026)

## Qué cambió
- **Paleta nueva**: azul eléctrico #0066FF, turquesa #00D1C1, blanco #FFFFFF (fondo), azul oscuro #0B2E5B (textos), gris claro #E5E7EB (bordes). Todo sale de `src/constants/brand.js`.
- **Tipografía Montserrat** (`@expo-google-fonts/montserrat`) en toda la app. Cada grosor es una familia (`fonts.bold`, `fonts.extra`…), así se ve igual en Android, iPhone y web.
- **Íconos de línea uniformes** (`@expo/vector-icons`, incluido con Expo) en lugar de emojis: pestañas, categorías, ubicación, horarios, estados de pedido, perfil. Componente `src/components/Icon.js`.
- **Ícono de la app**: solo "BÜBÜ" en blanco sobre azul eléctrico (`mobile/assets/icon.png`, `adaptive-icon.png` para Android, `splash-icon.png`, `favicon.png`). Generados con Poppins Bold (Montserrat no estaba disponible en el equipo de desarrollo; son muy parecidas).
- **Bienvenida** nueva: logo, "Tu comunidad, tus servicios", Iniciar sesión, Registrarse y ¿Olvidaste tu contraseña?
- **Inicio de sesión / registro / recuperar contraseña** con encabezado azul curvo, campos con íconos y botón para ver la contraseña.
- **Inicio del cliente** como la referencia: encabezado azul con BÜBÜ, ubicación y modo; buscador; tarjeta "Tu ropa limpia, sin complicaciones"; actividad real (conectadas ahora); categorías en cuadrícula.
- **Pedidos**: estados con color e ícono; línea de avance con íconos en el detalle.
- **Perfil**: avatar con iniciales y menú (Editar datos, Cambiar de modo, **Ayuda: ver tutorial**, Administrador).
- **Tutorial** (`src/screens/common/TutorialScreen.js`): la primera vez en cada modo pregunta "¿Cómo quieres comenzar?" (Enseñarme / Omitir). Cliente: 6 pasos. Proveedor: 6 pasos si está aprobado; si no, solo registro + espera de aprobación (no muestra funciones que no tiene). Paso X de 6, Anterior, Siguiente, Omitir. Se guarda en el teléfono (AsyncStorage, `src/lib/tutorial.js`). Se vuelve a ver desde Perfil.
- **Flujo de acceso como Uber**: sin sesión → Bienvenida; con sesión guardada → directo a la app (Firebase Authentication ya guardaba la sesión; no se cambió).

## Lo que NO se agregó (a propósito)
- "Continuar con Google" y la pestaña "Notificaciones" de la imagen de referencia: no existen todavía y no se muestran funciones falsas.
- No se cambiaron reglas de Firestore, servicios, datos ni el identificador `com.joseibarra.bubu`.

## Cambios mínimos de configuración (y por qué)
- `app.json`: `version` 0.3.0 y `versionCode` 2 (para instalar encima y separar las actualizaciones automáticas de esta versión), `icon`, `splash`, `android.adaptiveIcon`, `web.favicon`.
- `package.json`: `@expo-google-fonts/montserrat` (tipografía pedida), `expo-font` y `@expo/vector-icons` (ya vienen con Expo; se declaran explícitamente).
- Textos "Estoy disponible" → "Conectarme" (el botón se llama así desde la Etapa 5).

## Verificación
- ✅ Sintaxis, importaciones y nombres de las 51 piezas de la app y del Snack (analizador de TypeScript).
- ⬜ No probado en teléfono: hay que construir el APK y probar.

## Dos apps: BÜBÜ y BÜBÜ Socios (mismo código)
- `mobile/app.config.js` + variable `APP_VARIANT`: `clientes` → BÜBÜ (`com.joseibarra.bubu`, canal `preview`); `socios` → BÜBÜ Socios (`com.joseibarra.bubu.socios`, canal `socios`, ícono con franja SOCIOS); sin variable → versión completa con ambos modos (Snack).
- `src/constants/variant.js` decide el modo: en BÜBÜ solo cliente, en Socios solo proveedor; el botón "Cambiar de modo" explica qué app usar.
- Misma cuenta y misma base de datos en las dos. Sin cambios en reglas de Firestore.
- GitHub Actions: "APK de Android" pregunta la variante; "Publicar actualización" publica para las dos apps.
- Google Play pide la prueba cerrada (12 personas, 14 días) por cada app.
