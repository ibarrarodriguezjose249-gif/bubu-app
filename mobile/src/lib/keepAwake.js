// Mantener la pantalla encendida mientras el proveedor está "Conectado".
// Usa expo-keep-awake (módulo oficial de Expo, incluido en Expo Go).
// Si el dispositivo no lo permite (algunos navegadores), no pasa nada.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'bubu-conectado';

export function keepScreenOn(on) {
  try {
    if (on) {
      const p = activateKeepAwakeAsync(TAG);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      const p = deactivateKeepAwake(TAG);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) {
    // Sin soporte: la app sigue funcionando, solo que la pantalla puede apagarse.
  }
}
