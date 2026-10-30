// Avisos al teléfono para socios: sonido cuando llega un pedido y notificaciones
// "push" (llegan aunque la app esté cerrada; las manda el servidor, Cloud Functions).
//
// • Con la app abierta: la pantalla detecta el pedido y suena un aviso local.
// • Con la app cerrada o en segundo plano: llega la notificación push.
// • Para no sonar doble, con la app en pantalla se callan los push de lo que
//   la pantalla ya está mostrando.
import { AppState, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { APP_VARIANT } from '../constants/variant';

let N = null;
if (Platform.OS !== 'web') {
  try { N = require('expo-notifications'); } catch (e) { N = null; }
}

export const CHANNEL_ID = 'pedidos';
// Tipos que la pantalla del socio ya muestra con su propia tarjeta y sonido.
const HANDLED_ON_SCREEN = ['new_request', 'direct_order', 'chosen'];

let ready = false;
export async function setupNotifications() {
  if (!N || ready) return;
  ready = true;
  try {
    N.setNotificationHandler({
      handleNotification: async (n) => {
        const data = n?.request?.content?.data || {};
        const silent = !data.local && HANDLED_ON_SCREEN.includes(data.type) && AppState.currentState === 'active';
        return { shouldShowBanner: !silent, shouldShowList: !silent, shouldPlaySound: !silent, shouldSetBadge: false };
      },
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Pedidos nuevos',
        description: 'Pedidos de tu zona, reservas y cuando un cliente te elige',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        enableVibrate: true,
        lightColor: '#0066FF',
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
      });
    }
  } catch (e) { /* sin notificaciones en este equipo */ }
}

// Pide permiso. Devuelve 'granted', 'denied' o 'unavailable'.
export async function askPermission() {
  if (!N) return 'unavailable';
  try {
    await setupNotifications();
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return 'granted';
    if (!cur.canAskAgain) return 'denied';
    const res = await N.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch (e) { return 'unavailable'; }
}

// Guarda el token de ESTE teléfono para que el servidor le pueda avisar.
// Si falla (sin internet, emulador, falta configurar FCM), el sonido con la app
// abierta sigue funcionando.
export async function registerPushToken(uid) {
  const permission = await askPermission();
  if (permission !== 'granted' || !uid || !db) return { permission, token: null };
  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return { permission, token: null };
    await setDoc(doc(db, 'pushTokens', uid), {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      app: APP_VARIANT,
      updatedAt: serverTimestamp(),
    });
    return { permission, token };
  } catch (e) {
    return { permission, token: null, error: e };
  }
}

// Al cerrar sesión: que este teléfono ya no reciba avisos de esa cuenta.
export async function unregisterPushToken(uid) {
  if (!uid || !db) return;
  try { await deleteDoc(doc(db, 'pushTokens', uid)); } catch (e) { /* no crítico */ }
}

// Sonido + aviso inmediato desde la propia app (solo si está en pantalla;
// en segundo plano ya llega el push del servidor).
export async function notifyLocal({ title, body, data = {} }) {
  if (!N || AppState.currentState !== 'active') return;
  try {
    await setupNotifications();
    await N.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { ...data, local: true } },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch (e) { /* sin sonido */ }
}

export function openNotificationSettings() {
  Linking.openSettings().catch(() => {});
}
