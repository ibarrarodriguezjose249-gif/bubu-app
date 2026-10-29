# Conectar BÜBÜ con Firebase (proyecto `bubi-246b8`)

Estos pasos los haces tú en la consola: https://console.firebase.google.com/project/bubi-246b8
Ninguno requiere tarjeta ni el plan Blaze: todo funciona en el plan gratuito (Spark).

---

## 1. Activar el inicio de sesión con correo

1. Menú izquierdo → **Compilación (Build) → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso (Sign-in method)** → **Correo electrónico/contraseña** → **Habilitar** → Guardar.
   (Deja *desactivado* "Vínculo de correo electrónico (acceso sin contraseña)").
3. Opcional, recomendado: **Configuración → Política de contraseñas**: mínimo 8 caracteres.
4. Opcional: en **Plantillas** cambia el idioma de los correos a Español.

## 2. Copiar la configuración de la app web a `mobile/.env`

1. ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → pestaña **General**.
2. Baja a **Tus apps** → elige **BUBI-Web** → sección **Configuración del SDK** → opción **Config**.
3. Verás algo así:
   ```js
   const firebaseConfig = {
     apiKey: "AIza....",
     authDomain: "bubi-246b8.firebaseapp.com",
     projectId: "bubi-246b8",
     storageBucket: "bubi-246b8.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```
4. En tu computadora: copia `mobile/.env.example` como `mobile/.env` y pega cada valor:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=AIza....
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=bubi-246b8.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=bubi-246b8
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=bubi-246b8.firebasestorage.app
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
   EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```
   Sin comillas ni espacios. Si cambias el `.env`, reinicia Expo con `npx expo start --clear`.

> Estos valores no son secretos (cualquiera que abra la app podría verlos). Lo que protege tus datos son las reglas del paso 3. **Nunca** descargues ni pegues en la app una "clave privada" o "cuenta de servicio" (Configuración → Cuentas de servicio): eso sí es secreto.

## 3. Publicar las reglas de seguridad

Tus reglas actuales están bloqueadas (nadie lee ni escribe). Con eso la app no puede ni crear perfiles. Para publicar las de BÜBÜ:

**Opción A — desde la consola (más fácil):**
1. **Firestore Database → Reglas**.
2. Borra todo y pega el contenido completo de `firebase/firestore.rules`.
3. **Publicar**. Si la consola marca un error de sintaxis, cópialo y envíamelo: estas reglas **no se han podido compilar todavía** (ver `docs/ETAPAS.md`).

**Opción B — con la terminal (cuando tengas Node):**
```bash
cd firebase
npm install
npx firebase login
npm run deploy:rules
```

> Recomendado antes de publicar: correr las pruebas automáticas (sección 6).

## 4. Crear tu cuenta y hacerte administrador

1. Abre la app (Expo Go) y **crea tu cuenta** normalmente.
2. Consola → **Authentication → Usuarios** → copia el **UID de usuario** de tu cuenta (texto largo).
3. **Firestore Database → Datos** → **+ Iniciar colección** → ID de colección: `admins`.
4. ID del documento: **pega tu UID**. Agrega un campo: `role` (string) = `superadmin` → Guardar.
5. En la app, ve a **Perfil**. Debe aparecer la insignia "Administrador" y el botón **Herramientas de administrador**.

La consola de Firebase no pasa por las reglas. Por eso es el **único** lugar donde se pueden crear administradores. La app nunca puede.

## 5. Cargar el catálogo inicial

En la app: **Perfil → Herramientas de administrador → Cargar catálogo inicial**.
Crea las 6 categorías (solo Lavandería activa) y la zona *General Zuazua*. Las colonias quedan vacías: agrégalas con datos reales en la consola (`zones/general-zuazua` → campo `colonias`, tipo array) o, más adelante, desde el panel web.

Para **activar otra categoría** (por ejemplo Limpieza): `categories/limpieza` → campo `active` → `true`. La app la muestra al instante.

## 6. Probar las reglas en tu computadora (recomendado)

Requisitos: Node.js 20+ y **Java 21+** (lo usa el emulador). Las pruebas usan un proyecto ficticio (`demo-bubu`), así que no tocan tus datos reales.

```bash
cd firebase
npm install
npm run test:rules
```

Deberías ver todas las pruebas en verde (`# pass` y `# fail 0`). Si alguna falla, envíame la salida completa.

## 7. Aprobar un proveedor (mientras no exista el panel web)

1. Con otra cuenta (o la tuya), en modo proveedor → **Comenzar solicitud** → Enviar.
2. Consola → `providers/{UID}` → cambia `status` de `pending` a `approved`.
3. En la app, el estado cambia a "Aprobado".

## Recomendaciones de seguridad adicionales (opcionales, sin costo)

- **Restringir la API key por API** (no por sitio web, porque la app móvil no envía sitio): Google Cloud Console → APIs y servicios → Credenciales → la clave "Browser key" de `bubi-246b8` → *Restricciones de API* → permite solo **Identity Toolkit API**, **Token Service API** y **Cloud Firestore API**.
- **Alertas de presupuesto**: aunque estés en Spark, configúralas si algún día pasas a Blaze.
- **App Check** (más adelante): ayuda a que solo tu app use el proyecto.
