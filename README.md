# BÜBÜ — Servicios locales

BÜBÜ conecta a clientes con proveedores de servicios locales. El piloto empieza en **General Zuazua, Nuevo León**, con la categoría **lavandería**. Las demás categorías (limpieza, reparaciones, jardinería, mudanzas, cuidado de mascotas) ya existen en el catálogo como "próximamente" y se activan desde la base de datos, sin cambiar código.

> **Estado: versión de desarrollo 0.2 — NO probada en dispositivo.**
> El código se escribió sin poder instalar paquetes (npm no estaba disponible en la sesión de desarrollo).
> Lo que se verificó y lo que falta verificar está en [`docs/ETAPAS.md`](docs/ETAPAS.md).
> No hay pagos. No hay proveedores reales cargados.

## Estructura

```
bubi_proyecto/
├── mobile/              App Expo (React Native) para Android, iPhone y web
│   ├── App.js           Punto de entrada
│   ├── app.json         Nombre, iconos, identificadores de tienda
│   ├── eas.json         Perfiles de compilación con EAS (APK de prueba / tiendas)
│   ├── .env.example     Plantilla de configuración de Firebase (copiar a .env)
│   └── src/
│       ├── constants/   Marca y colores, catálogo inicial, estados de pedido
│       ├── lib/         Inicialización de Firebase, errores, validaciones
│       ├── context/     Sesión (AuthContext) y catálogo (CatalogContext)
│       ├── services/    Lectura/escritura en Firestore por tema
│       ├── components/  Piezas visuales (cabecera, botones, tarjetas…)
│       ├── navigation/  Navegación entre pantallas
│       └── screens/     Pantallas (auth, client, provider, admin, common)
├── firebase/            Reglas de seguridad de Firestore + pruebas con emulador
├── admin/               (Etapa 6) Panel administrativo web estático para Cloudflare Pages (ver admin/LEEME.md)
├── docs/
│   ├── ETAPAS.md                Avance por etapas, archivos y pruebas
│   ├── CONFIGURAR_FIREBASE.md   Pasos que debes hacer en la consola de Firebase
│   ├── PUBLICAR.md              Cloudflare Pages (web) y Expo EAS (Android/iPhone)
│   ├── MODELO_FIRESTORE.md      Colecciones, campos y quién puede hacer qué
│   ├── PLAN_LANZAMIENTO.md      Plan de negocio/lanzamiento (original)
│   └── referencia/              Archivos del proyecto inicial conservados
└── prototipo_web.html   Prototipo visual original (sin cambios; referencia de diseño)
```

## Arranque rápido (en tu computadora)

Requisitos: Node.js 20.19 o más reciente (LTS), y la app **Expo Go** en tu teléfono.

```bash
cd mobile
cp .env.example .env        # y llénalo (ver docs/CONFIGURAR_FIREBASE.md)
npm install
npx expo install --fix      # ajusta versiones exactas compatibles con Expo SDK 54
npx expo start
```

Escanea el código QR con la cámara del iPhone (abre Expo Go) o con Expo Go en Android.

> **Por qué Expo SDK 54:** es la versión que hoy abre la app Expo Go de la App Store. Las versiones 55–57 todavía no están aprobadas ahí, y para usarlas en iPhone necesitarías la membresía de Apple Developer. Actualizaremos cuando Expo Go de la App Store lo permita.

## Seguridad (resumen)

- La configuración web de Firebase (`EXPO_PUBLIC_FIREBASE_*`) es pública por diseño. La protección real está en `firebase/firestore.rules`.
- No hay claves privadas, cuentas de servicio, contraseñas ni tokens de admin en el código.
- Los administradores se dan de alta **a mano** en la consola de Firebase (`admins/{UID}`). La app no puede crear admins.
- Los proveedores quedan "pendientes" hasta que un admin los aprueba. No pueden aprobarse solos.
