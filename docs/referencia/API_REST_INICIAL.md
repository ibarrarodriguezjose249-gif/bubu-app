# API inicial de BÜBÜ (especificación, no servidor desplegado)

Prefijo propuesto: `/api/v1`

## Autenticación y perfil
- `POST /auth/register` — crear cuenta.
- `POST /auth/login` — iniciar sesión.
- `GET /me` — perfil del usuario autenticado.
- `PATCH /me/mode` — cambiar modo cliente/proveedor.

## Proveedores
- `POST /providers/applications` — enviar solicitud para ser proveedor.
- `GET /providers` — listar proveedores aprobados dentro de cobertura.
- `GET /providers/:id` — detalle de proveedor.
- `POST /providers/:id/documents` — subir documentos de verificación, con acceso privado.

## Pedidos
- `POST /requests` — publicar solicitud.
- `POST /orders` — crear reserva directa.
- `GET /orders` — consultar pedidos del usuario autenticado.
- `PATCH /orders/:id/status` — transición de estado validada por el servidor.
- `POST /orders/:id/evidence` — evidencias de recogida/entrega.
- `POST /orders/:id/incidents` — reportar incidente.

## Pagos
- `POST /payments/checkout` — iniciar pago con proveedor autorizado.
- `POST /payments/webhook` — confirmar eventos firmados del procesador.
- Nunca confiar en el monto ni el estado de pago enviado por el teléfono; calcularlos y verificarlos en el servidor.

## Administración
- `GET /admin/coverage` — ver zonas (solo permisos autorizados).
- `POST /admin/coverage` — crear zona.
- `PATCH /admin/coverage/:id` — activar/desactivar zona.
- `GET /admin/provider-applications` — revisar solicitudes.
- `PATCH /admin/provider-applications/:id` — aprobar/rechazar con registro de auditoría.

## Reglas críticas
- Un proveedor no recibe pedidos hasta ser aprobado.
- Validar cobertura por coordenadas en el servidor, no solo por lo que muestra la app.
- Verificar autorización y propiedad del pedido en cada endpoint.
- Los webhooks de pagos deben verificar firma y ser idempotentes.
- No almacenar números completos de tarjeta ni secretos de pago.
- Registrar acciones administrativas sensibles en una bitácora.
