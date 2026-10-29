# BÜBÜ — Panel administrativo web

Página web estática (HTML + JS). **No se instala nada y no hay que compilar.** Usa Firebase desde su CDN oficial (`www.gstatic.com`, versión 13.1.0).

## Qué hace
| Sección | Qué puedes hacer |
|---|---|
| Resumen | Números reales: proveedores conectados, por revisar, solicitudes, pedidos en curso y entregados |
| Proveedores | Aprobar, rechazar (con motivo) o suspender. Ver titular, zona, modalidad y si está conectado |
| Pedidos | Ver todos los pedidos; corregir el estado con una nota interna obligatoria |
| Solicitudes | Ver las publicadas (abiertas, asignadas, vencidas), sus ofertas, y cancelar una abierta |
| Usuarios | Buscar y suspender/reactivar cuentas (no puedes suspender la tuya) |
| Categorías | Activar/desactivar, editar nombre, ícono, descripción y opciones de servicio; crear nuevas |
| Zonas y colonias | Capturar colonias, activar zonas y crear nuevas |
| Bitácora | Cada acción queda registrada (quién, qué, cuándo). Nadie puede editarla ni borrarla |

## Seguridad
- No contiene claves privadas. `config.js` es la configuración **pública** de Firebase.
- Solo entra una cuenta que exista en `admins/{UID}` de Firestore; las reglas bloquean a cualquier otra, aunque alguien copie la página.
- Cada cambio y su registro en `auditLog` se guardan **en el mismo paso** (si uno falla, no se guarda ninguno).
- `_headers` agrega protecciones de navegador en Cloudflare (no indexar, no incrustar en otras páginas, solo scripts de gstatic).

## Publicar en Cloudflare Pages (sin instalar nada)
1. Cloudflare → **Workers & Pages** → **Create** → pestaña **Pages** → **Upload assets** (subir archivos).
2. Nombre del proyecto: `bubu-admin` → **Create project**.
3. Arrastra el ZIP `bubu_admin_panel.zip` (o el contenido de esta carpeta) → **Deploy site**.
4. Te da una dirección como `https://bubu-admin.pages.dev`.
5. **Firebase** → Authentication → **Settings / Configuración** → **Authorized domains / Dominios autorizados** → **Add domain** → `bubu-admin.pages.dev`.
6. Abre la dirección e inicia sesión con tu cuenta de administrador.

Para actualizar: el mismo proyecto → **Create new deployment / Nuevo despliegue** → sube el ZIP nuevo.

Opcional (más seguridad): Cloudflare → Zero Trust → **Access** para que solo tu correo pueda abrir la dirección.
