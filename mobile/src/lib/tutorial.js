// Recuerda en el teléfono si el tutorial ya se vio (completo u omitido),
// por cuenta y por modo (cliente / proveedor). Usa AsyncStorage, que ya está en el proyecto.
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (uid, mode) => `bubu:tutorial:${uid}:${mode === 'provider' ? 'provider' : 'client'}`;

export async function tutorialSeen(uid, mode) {
  try { return (await AsyncStorage.getItem(key(uid, mode))) === 'done'; } catch (e) { return true; } // si falla, no bloquea la app
}

export async function markTutorialSeen(uid, mode) {
  try { await AsyncStorage.setItem(key(uid, mode), 'done'); } catch (e) { /* sin almacenamiento: se vuelve a ofrecer */ }
}
