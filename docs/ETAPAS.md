# Avance por etapas — BÜBÜ

Leyenda de verificación:
- ✅ **Verificado** — se ejecutó y funcionó en la sesión de desarrollo.
- 🟡 **Escrito, NO probado** — el código existe, pero no se pudo ejecutar (sin npm, sin emulador, sin teléfono).
- ⬜ **Pendiente** — todavía no se ha hecho.

| # | Etapa | Estado |
|---|---|---|
| 1 | Base del proyecto, configuración de Firebase, correcciones | 🟡 |
| 2 | Cuentas, perfil, modo cliente/proveedor, solicitud de proveedor | 🟡 |
| 3 | Reglas de seguridad de Firestore + pruebas automáticas | 🟡 Reglas **compiladas y publicadas** en bubi-246b8 (27-oct-2026). Pruebas del emulador aún no ejecutadas |
| 4 | Cliente: proveedores por categoría, búsqueda, solicitudes, reservas, "Mis pedidos" | ⬜ |
| 5 | Proveedor: mis servicios, solicitudes de mi zona, avanzar pedidos | ⬜ |
| 6 | Panel administrativo web (usuarios, proveedores, categorías, pedidos, zonas, bitácora) | ⬜ |
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
