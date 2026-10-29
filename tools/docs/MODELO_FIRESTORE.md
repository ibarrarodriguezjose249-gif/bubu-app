# Modelo de datos en Cloud Firestore

Traducción del esquema PostgreSQL original (`docs/referencia/schema_postgresql.sql`) a colecciones de Firestore. Las reglas que lo protegen están en `firebase/firestore.rules`.

| Colección | ID del documento | Quién lee | Quién escribe | Equivale a (SQL) |
|---|---|---|---|---|
| `admins` | UID | El propio usuario (para saber si es admin) y admins | **Nadie desde la app.** Solo la consola de Firebase | — (antes: permisos de servidor) |
| `users` | UID | El dueño y admins | El dueño (nombre, teléfono, colonia, modo). Admin: solo `status` | `users` |
| `providers` | UID | Aprobados: cualquier usuario con sesión. Pendientes/rechazados: dueño y admin | Dueño: crea como `pending` y edita datos. Admin: `status`, `reviewNote` | `provider_profiles` |
| `categories` | texto (`lavanderia`) | Público | Admin | `service_category` (antes fijo en CHECK) |
| `zones` | texto (`general-zuazua`) | Público | Admin | `coverage_zones` |
| `services` | automático | Usuarios con sesión (activos); dueño y admin (todos) | Proveedor **aprobado** dueño; admin solo activa/desactiva | `service_listings` |
| `requests` | automático | Dueño; proveedores aprobados de esa categoría y zona (solo abiertas); admin | Cliente crea; cliente cierra/cancela | (nuevo: "publicar solicitud") |
| `requests/{id}/offers` | UID del proveedor | Cliente dueño de la solicitud, el proveedor y admin | Proveedor aprobado | (nuevo) |
| `orders` | automático | Cliente, proveedor y admin del pedido | Cliente crea; estado según tabla de abajo | `orders` |
| `auditLog` | automático | Admin | Admin (solo agregar; no se edita ni borra) | `admin_audit_log` |

Pendientes para etapas futuras (estaban en el SQL): `order_evidence` (fotos de recolección/entrega, requiere Firebase Storage) e `incidents` (reportes).

## Campos principales

**users/{uid}**: `displayName`, `email`, `phone` (10 dígitos, opcional), `colonia`, `zoneId`, `activeMode` (`client`|`provider`), `status` (`active`|`suspended`), `createdAt`, `updatedAt`.

**providers/{uid}**: `businessName`, `description`, `categoryIds[]`, `zoneIds[]`, `fulfillmentModes[]` (`dropoff` = el cliente lo lleva, `pickup_delivery` = recojo y entrego), `status` (`pending`|`approved`|`rejected`|`suspended`), `reviewNote`, `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt`.
⚠️ Cuando un perfil está aprobado, `reviewNote` es visible para otros usuarios: úsala solo para explicar rechazos y bórrala al aprobar.

**categories/{id}**: `name`, `icon` (emoji), `description`, `active`, `order`.

**zones/{id}**: `name`, `municipality`, `state`, `colonias[]` (capturar con datos reales), `active`.

**services/{id}**: `providerId`, `providerName`, `categoryId`, `zoneIds[]`, `title`, `description`, `priceFrom` (MXN, **solo referencia**), `priceUnit`, `fulfillmentModes[]`, `active`.

**requests/{id}**: `customerId`, `customerName`, `categoryId`, `zoneId`, `colonia`, `description`, `fulfillmentMode`, `preferredDate?`, `status` (`open`|`closed`|`cancelled`).

**orders/{id}**: `customerId`, `providerId`, `serviceId?`, `requestId?`, `categoryId`, `zoneId`, `customerName`, `providerName`, `details`, `fulfillmentMode`, `colonia`, `address` (obligatorio si es recolección), `customerPhone?`, `providerPhone?`, `scheduledAt?` (**reserva** = pedido con fecha), `priceEstimate?` (solo referencia), `status`, `statusChangedAt`, `cancelReason?`, `adminNote?`.

## Estados de pedido

```
requested ──(proveedor)──▶ accepted ──▶ in_progress ──▶ ready ──▶ delivered
    │  └──(proveedor)──▶ rejected        │
    └──(cliente)──▶ cancelled ◀──(cliente o proveedor)
Admin: puede poner cualquier estado, incluido "disputed" (en revisión).
```

Diferencias con el SQL original: `pickup_scheduled` se reemplazó por `scheduledAt` (fecha) + `accepted`; se agregó `rejected`. Montos: nada se cobra; los precios son informativos, y las reglas impiden cambiarlos después de crear el pedido.

## Límites conocidos (honestos)

- **Búsqueda:** Firestore no hace búsqueda de texto completo. Para el piloto se filtra por categoría y zona en la base, y por texto en el teléfono. Si crece, se puede usar un servicio de búsqueda (p. ej. Algolia o Typesense).
- **Cobertura:** se valida por zona (`zoneId` activo). La validación por coordenadas/mapa queda pendiente.
- **Verificación de identidad** de proveedores: pendiente (requiere almacenamiento privado de documentos).
- Las reglas validan que la **primera** categoría y zona de una solicitud de proveedor estén activas. El admin revisa el resto al aprobar.
