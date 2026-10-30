// Traduce errores de Firebase a mensajes claros en español.
const AUTH_MESSAGES = {
  'auth/invalid-email': 'El correo no tiene un formato válido.',
  'auth/missing-email': 'Escribe tu correo.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'auth/weak-password': 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos de seguridad.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Contacta a soporte.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  'auth/operation-not-allowed': 'El acceso con correo no está habilitado en Firebase (Authentication → Método de acceso).',
  'auth/invalid-api-key': 'La configuración de Firebase no es válida. Revisa el archivo .env.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La configuración de Firebase no es válida. Revisa el archivo .env.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e inténtalo otra vez.',
};

const FIRESTORE_MESSAGES = {
  'permission-denied': 'No tienes permiso para esta acción. Si acabas de configurar Firebase, revisa que publicaste las reglas de Firestore.',
  unavailable: 'El servicio no está disponible. Revisa tu conexión.',
  'not-found': 'No se encontró la información solicitada.',
  'failed-precondition': 'Falta configurar algo en Firestore (por ejemplo, un índice).',
  'resource-exhausted': 'Se alcanzó el límite de uso. Inténtalo más tarde.',
};

export function friendlyError(err) {
  if (!err) return 'Ocurrió un error inesperado.';
  const code = String(err.code || '');
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  const short = code.replace(/^firestore\//, '');
  if (FIRESTORE_MESSAGES[short]) return FIRESTORE_MESSAGES[short];
  return err.message ? `Error: ${err.message}` : 'Ocurrió un error inesperado.';
}
