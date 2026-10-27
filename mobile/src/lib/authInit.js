// Inicializa Firebase Auth guardando la sesión:
//  - iPhone / Android: en AsyncStorage (no pide login cada vez que se abre la app).
//  - Web: en el almacenamiento local del navegador.
// Guía oficial: https://expo.fyi/firebase-js-auth-setup
// Se usa "import * as" porque cada plataforma exporta funciones distintas.
import { Platform } from 'react-native';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function createAuth(app) {
  try {
    if (Platform.OS === 'web') {
      return FirebaseAuth.initializeAuth(app, { persistence: FirebaseAuth.browserLocalPersistence });
    }
    return FirebaseAuth.initializeAuth(app, {
      persistence: FirebaseAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // En recargas rápidas Auth ya estaba inicializado.
    return FirebaseAuth.getAuth(app);
  }
}
