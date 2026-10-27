// Configuración PÚBLICA de la app web de Firebase (BUBI-Web, proyecto bubi-246b8).
//
// Estos valores NO son secretos: Firebase los diseñó para ir dentro de apps
// cliente. La seguridad de los datos la dan las reglas de Firestore
// (firebase/firestore.rules), no ocultar estos valores.
// Aun así se leen de variables de entorno (mobile/.env) para no mezclarlos con
// el código y poder usar otro proyecto (p. ej. uno de pruebas) sin editarlo.
//
// Expo solo inyecta variables que empiezan con EXPO_PUBLIC_ y solo si se leen
// así, de forma literal (process.env.EXPO_PUBLIC_...). No las leas dinámicamente.
//
// NUNCA pongas aquí: cuentas de servicio, claves privadas, contraseñas,
// tokens de administrador ni claves de pagos.

// Valores de la app web BUBI-Web (públicos). Se usan si no hay archivo .env
// (por ejemplo, en Expo Snack, que no lee .env).
const DEFAULTS = {
  apiKey: 'AIzaSyDeEGd6HXOxqDPEKnoKxC4-uaxkj9u3Wz4',
  authDomain: 'bubi-246b8.firebaseapp.com',
  projectId: 'bubi-246b8',
  storageBucket: 'bubi-246b8.firebasestorage.app',
  messagingSenderId: '715617953153',
  appId: '1:715617953153:web:333811bf62339cdb5e3480',
};

// Lectura de mobile/.env. Debe ser literal (process.env.EXPO_PUBLIC_...) para
// que Expo la inyecte; el try/catch cubre entornos sin "process" (p. ej. Snack).
function readEnv() {
  try {
    return {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (e) {
    return {};
  }
}

const env = readEnv();
export const firebaseConfig = Object.fromEntries(
  Object.keys(DEFAULTS).map((k) => [k, env[k] || DEFAULTS[k]])
);

const REQUIRED = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};

// Devuelve los nombres de las variables que faltan (lista vacía = todo bien).
export function missingFirebaseEnv() {
  return Object.entries(REQUIRED)
    .filter(([key]) => !firebaseConfig[key] || String(firebaseConfig[key]).trim() === '')
    .map(([, envName]) => envName);
}
