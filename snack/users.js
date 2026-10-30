// Cuentas y perfiles (colección `users`).
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
} from '@firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@firebase/firestore';
import { auth, db } from './bubuFirebase';
import { clampText, normalizePhone, LIMITS } from './validation';
import { unregisterPushToken } from './notifications';

export const DEFAULT_ZONE_ID = 'general-zuazua';

function profileData({ displayName, email, phone, colonia }) {
  return {
    displayName: clampText(displayName, LIMITS.name),
    email: String(email || '').trim().toLowerCase(),
    phone: normalizePhone(phone),
    colonia: clampText(colonia, LIMITS.colonia),
    zoneId: DEFAULT_ZONE_ID,
    activeMode: 'client',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function registerWithEmail({ displayName, email, password, phone, colonia }) {
  const cred = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
  await updateProfile(cred.user, { displayName: clampText(displayName, LIMITS.name) });
  await setDoc(doc(db, 'users', cred.user.uid), profileData({ displayName, email: cred.user.email, phone, colonia }));
  // La verificación de correo es recomendable, pero no bloquea el uso en esta etapa.
  try { await sendEmailVerification(cred.user); } catch (_) { /* no crítico */ }
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
  try { await ensureUserProfile(cred.user); } catch (_) { /* la app ofrecerá repararlo */ }
  return cred;
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, String(email).trim());
}

export function resendVerification() {
  return auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.resolve();
}

export async function logout() {
  // Primero se borra el aviso de este teléfono (después ya no habría permiso).
  if (auth.currentUser) await unregisterPushToken(auth.currentUser.uid);
  return signOut(auth);
}

// Si la cuenta existe en Authentication pero falta su documento en Firestore
// (p. ej. se cortó internet justo al registrarse), lo crea.
export async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, profileData({ displayName: user.displayName || 'Usuario', email: user.email, phone: '', colonia: '' }));
  }
}

export function updateMyProfile(uid, { displayName, phone, colonia }) {
  return updateDoc(doc(db, 'users', uid), {
    displayName: clampText(displayName, LIMITS.name),
    phone: normalizePhone(phone),
    colonia: clampText(colonia, LIMITS.colonia),
    updatedAt: serverTimestamp(),
  });
}

export function setActiveMode(uid, mode) {
  if (mode !== 'client' && mode !== 'provider') throw new Error('Modo inválido');
  return updateDoc(doc(db, 'users', uid), { activeMode: mode, updatedAt: serverTimestamp() });
}
