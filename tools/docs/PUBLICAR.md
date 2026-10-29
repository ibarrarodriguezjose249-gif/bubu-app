# Publicar BÜBÜ

> Nada de esto se ha ejecutado todavía. Son los pasos preparados para cuando la app esté probada.
> No publiques para clientes reales hasta completar el piloto (ver `PLAN_LANZAMIENTO.md`).

Hay tres cosas que publicar:

| Qué | Dónde | Costo | Estado |
|---|---|---|---|
| App web de clientes y proveedores (la misma app Expo, versión web) | Cloudflare Pages | Gratis, con dirección `*.pages.dev` | Preparada (sin probar) |
| Panel administrativo web (`admin/`) | Cloudflare Pages (otro proyecto, subir ZIP) | Gratis | Listo para subir — pasos en `admin/LEEME.md` |
| App Android | Expo EAS → APK de prueba / Google Play | APK de prueba gratis; Play Store: pago único de USD 25 | Preparada (sin probar) |
| App iPhone | Expo EAS → TestFlight / App Store | Apple Developer: USD 99 al año | Preparada (sin probar) |

---

## A. Web en Cloudflare Pages (sin dominio propio)

Cloudflare da gratis una dirección tipo `https://bubu-app.pages.dev`. El dominio propio se puede conectar después.

### Opción 1 — Subir la carpeta a mano (lo más simple)

En tu computadora:
```bash
cd mobile
npx expo export --platform web
```
Esto crea la carpeta `mobile/dist`, con los valores de `mobile/.env` ya incluidos.

En Cloudflare:
1. Panel de Cloudflare → **Workers y Pages** → **Crear** → pestaña **Pages** → **Subir recursos (Upload assets)**.
   (Cloudflare cambia los nombres del menú de vez en cuando; busca "Pages" y "Upload".)
2. Nombre del proyecto: `bubu-app` → arrastra **el contenido** de la carpeta `dist` → **Implementar**.
3. Anota la dirección que te da (`https://bubu-app.pages.dev`).

O con la terminal: `npx wrangler pages deploy dist --project-name bubu-app`. La primera vez te pedirá iniciar sesión en Cloudflare.

### Opción 2 — Conectado a GitHub (se actualiza solo con cada cambio)

Requiere subir el proyecto a un repositorio de GitHub (sin el archivo `.env`; el `.gitignore` ya lo excluye).
1. **Workers y Pages → Crear → Pages → Conectar a Git** → elige el repositorio.
2. Configuración de compilación:
   - Directorio raíz: `mobile`
   - Comando de compilación: `npx expo export --platform web`
   - Directorio de salida: `dist`
3. **Variables de entorno** (Configuración → Variables): agrega las 6 `EXPO_PUBLIC_FIREBASE_*` con los mismos valores de tu `.env`.
4. Variable `NODE_VERSION` = `20` (o la LTS actual).

### Después de publicar la web

- Firebase → **Authentication → Configuración → Dominios autorizados** → **Agregar dominio** → `bubu-app.pages.dev`.
- Abre la dirección y prueba: crear cuenta, iniciar sesión, cambiar de modo.

---

## B. Android e iPhone con Expo EAS

### Para probar durante el desarrollo (gratis)

- **iPhone y Android:** con la app **Expo Go** y `npx expo start`. No hace falta compilar nada.

### Compilar una app instalable

1. Crea una cuenta gratis en https://expo.dev
2. En tu computadora:
   ```bash
   npm install -g eas-cli
   cd mobile
   eas login
   eas init            # vincula el proyecto a tu cuenta (agrega "extra.eas.projectId" a app.json)
   ```
3. **Variables de Firebase en EAS.** El `.env` no se sube a los servidores de Expo, así que hay que darlas de alta allí (una por una, para los entornos `preview` y `production`):
   ```bash
   eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIza..." --visibility plaintext
   # …repite para AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID
   ```
   (Son públicas, por eso `plaintext`. Aun así, no pongas secretos en variables `EXPO_PUBLIC_`.)

**Android — APK de prueba (gratis):**
```bash
eas build --platform android --profile preview
```
Al terminar te da un enlace para descargar el `.apk` e instalarlo en cualquier Android.

**iPhone — requiere Apple Developer (USD 99/año):**
```bash
eas build --platform ios --profile production
eas submit --platform ios     # lo sube a App Store Connect / TestFlight
```
Sin esa membresía no es posible instalar una compilación propia en un iPhone físico. Mientras tanto, usa Expo Go.

**Google Play:** `eas build --platform android --profile production` (genera `.aab`) y `eas submit --platform android`. Requiere la cuenta de Google Play Console.

### Decisiones que debes confirmar antes de la primera compilación de tienda

- **Identificador de la app:** en `app.json` puse `mx.bubu.app` (iOS `bundleIdentifier` y Android `package`). **No se puede cambiar después de publicar.** Si prefieres otro (por ejemplo `com.tuempresa.bubu`), cámbialo antes.
- **Icono y pantalla de inicio:** faltan las imágenes (`icon.png` 1024×1024, `adaptive-icon.png`, `splash`). Hoy Expo usa unas genéricas.
- **Aviso de privacidad y términos:** las tiendas los exigen (enlace público).
