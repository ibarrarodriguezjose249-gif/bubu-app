// Validaciones de formularios. Las reglas de Firestore repiten los límites
// importantes; esto solo da mensajes rápidos al usuario.

export const LIMITS = {
  name: 80,
  businessName: 80,
  description: 500,
  phone: 20,
  colonia: 80,
  passwordMin: 8,
};

export function validateEmail(email) {
  const v = String(email || '').trim();
  if (!v) return 'Escribe tu correo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'El correo no tiene un formato válido.';
  return null;
}

export function validatePassword(pw) {
  const v = String(pw || '');
  if (v.length < LIMITS.passwordMin) return `La contraseña debe tener al menos ${LIMITS.passwordMin} caracteres.`;
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Usa letras y números en la contraseña.';
  return null;
}

export function validateName(name, max = LIMITS.name) {
  const v = String(name || '').trim();
  if (v.length < 2) return 'Escribe un nombre de al menos 2 letras.';
  if (v.length > max) return `Máximo ${max} caracteres.`;
  return null;
}

// Teléfono opcional: 10 dígitos de México (se permiten espacios, guiones y +52).
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const local = digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits;
  return local;
}

export function validatePhoneOptional(phone) {
  const local = normalizePhone(phone);
  if (!local) return null;
  if (local.length !== 10) return 'El teléfono debe tener 10 dígitos.';
  return null;
}

export function clampText(text, max) {
  return String(text || '').trim().slice(0, max);
}
