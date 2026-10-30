// Ubicación del teléfono (GPS) y la última ubicación elegida por el usuario.
import AsyncStorage from '@react-native-async-storage/async-storage';

let Location = null;
try { Location = require('expo-location'); } catch (e) { Location = null; }

export async function getGpsPoint() {
  if (!Location) throw new Error('Esta versión de la app no puede usar el GPS. Mueve el pin en el mapa.');
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Permite el acceso a tu ubicación, o mueve el pin en el mapa.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

const key = (uid) => `bubu:ubicacion:${uid}`;
export async function loadLastPoint(uid) {
  try { const v = await AsyncStorage.getItem(key(uid)); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
export async function saveLastPoint(uid, p) {
  try { await AsyncStorage.setItem(key(uid), JSON.stringify({ lat: p.lat, lng: p.lng })); } catch (e) { /* nada */ }
}
