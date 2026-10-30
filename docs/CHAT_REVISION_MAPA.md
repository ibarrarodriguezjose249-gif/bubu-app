# BÜBÜ — Chat, revisión, colaboradores y mapa (v0.4.0)

## Chat por pedido
- **Una conversación por pedido** entre el cliente y el socio: app (botón "Mensajes") y web de socios (dentro del pedido).
- **Cuándo la ven ellos:** mientras el pedido está activo y hasta **48 h después de entregado**. Después desaparece para ellos, y nunca se ve en otro pedido aunque sean el mismo cliente y el mismo local.
- **Tú y tus colaboradores** la leen **siempre**, en vivo, en el panel → Pedidos → Ver → "Conversación".
- **Nadie puede editar ni borrar mensajes**, ni siquiera el admin. Así queda la evidencia.
- **Aviso:** el otro recibe una notificación con el mensaje.
- ⚖️ **Legal:** en tu **aviso de privacidad y términos** debe decir que los chats se guardan y el equipo de BÜBÜ puede revisarlos por seguridad. En la pantalla del chat ya se avisa, pero el documento legal es aparte (revisa con un abogado).

## Revisión y bloqueo
- **Socio:** "Poner en revisión" (deja de recibir pedidos nuevos y termina los que tiene) o "Suspender". Para regresarlo, usa "Aprobar".
- **Cliente:** "Poner en revisión" (ve "Cuenta en revisión" y no puede hacer pedidos nuevos) o "Suspender". Para regresarlo, usa "Reactivar".
- **Dónde están los botones:** en el pedido (Socio a revisión / Cliente a revisión), en el detalle del local y en Usuarios.
- **Bitácora:** todo queda registrado, con el motivo.

## Detalle del local y del cliente
- **Proveedores → Ver:** datos del local, su zona de servicio y **todos sus pedidos**, con la forma de pago, si hay comprobante y si lo cerró el cliente. Tocas uno y ves el comprobante, la clave de rastreo y la conversación.
- **Usuarios → Ver:** los pedidos de ese cliente.

## Colaboradores (panel → Colaboradores)
- **Cómo agregar:** el dueño (superadmin) escribe el correo de una cuenta de BÜBÜ ya registrada. Esa persona entra al panel con su propia cuenta.
- **Qué puede hacer un colaborador:** revisar pedidos, chats y comprobantes; aprobar, poner en revisión y suspender; editar zonas y categorías.
- **Qué NO puede hacer:** tocar dinero (depósitos y pagos de socios), cambiar comisión, cuota o límite, ni agregar o quitar colaboradores.
- **Bitácora:** todo lo que hace queda con su nombre.

## Mapa
- **Cobertura (panel → Zonas → Cobertura):**
  - Arrastras el centro de cada zona y eliges el radio en km. "Ver mapa de cobertura" muestra todas las zonas y las zonas de servicio de los socios; los que están fuera aparecen en rojo.
  - Mientras no dibujes ninguna cobertura, la app funciona como antes, sin mapa.
- **Clientes:**
  - Al pedir eligen **"Usar mi ubicación"** (GPS) o mueven un pin.
  - **Fuera de cobertura** pueden tener cuenta, pero ven **"Aún no llegamos a tu colonia o ciudad"** y no pueden publicar ni reservar.
  - Solo se guarda una **ubicación aproximada (~1 km)**. Los socios no ven el punto exacto, solo la colonia.
- **Socios:**
  - "Mi zona de servicio" (app: Perfil; web: Mi negocio) → punto + radio. Su punto se guarda aproximado (±100 m).
  - Solo les llegan pedidos (lista y avisos) dentro de su círculo.
  - **Fuera de cobertura** pueden registrarse igual; se les avisa y tú los ves marcados.
- **Mapas:** OpenStreetMap con Leaflet, sin llaves ni costo. Si algún día hay mucho tráfico, conviene un proveedor de mapas con cuenta (por ejemplo MapTiler o Stadia), porque OpenStreetMap pide no abusar de sus servidores.

## Lo que necesita la app nueva (APK)
Paquetes nativos nuevos: `react-native-webview` (mapa), `expo-location` (GPS) y `expo-image-picker` (comprobante). Por eso hay que instalar el APK 0.4.0; no llega solo con "Publicar actualización".

## Pruebas
- **Web de socios:** 63/63 en navegador con datos simulados. Incluye el chat y la zona de servicio.
- **Panel admin:** 87/87 en navegador con datos simulados. Incluye la conversación, la revisión, los colaboradores, la cobertura y los socios fuera de cobertura.
- **Servidor:** 21/21. Incluye que solo se avise a los socios dentro de su radio.
- **Reglas de Firestore:** 110 pruebas escritas (antes 107), **no ejecutadas** (el emulador no corre en la sesión de desarrollo).
- **Sin probar:**
  - El mapa en el teléfono (WebView y GPS) y el chat en la app. El mapa en las pruebas usa una versión simulada de Leaflet, así que su funcionamiento real en el navegador tampoco está probado.
  - Que OpenStreetMap entregue los mapas desde la app.
