// Variante de la app (mismo código, dos apps en las tiendas):
// - 'clientes' → BÜBÜ: solo pedir servicios.
// - 'socios'   → BÜBÜ Socios: solo modo proveedor.
// - 'completa' → ambos modos con botón para cambiar (Snack y pruebas).
// La define app.config.js con la variable APP_VARIANT al construir o publicar.
import Constants from 'expo-constants';

const raw = Constants?.expoConfig?.extra?.appVariant;
export const APP_VARIANT = raw === 'socios' || raw === 'clientes' ? raw : 'completa';
export const IS_SOCIOS = APP_VARIANT === 'socios';
export const IS_CLIENTES = APP_VARIANT === 'clientes';
export const CAN_SWITCH_MODE = APP_VARIANT === 'completa';
export const SOCIOS_APP_NAME = 'BÜBÜ Socios';
