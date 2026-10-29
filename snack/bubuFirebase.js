// Inicialización única de Firebase (Auth + Firestore) para iOS, Android y web.
import { initializeApp, getApps, getApp } from '@firebase/app';
import { getFirestore } from '@firebase/firestore';
import { firebaseConfig, missingFirebaseEnv } from './firebaseConfig';
import { createAuth } from './authInit';

export const firebaseMissingEnv = missingFirebaseEnv();
export const firebaseReady = firebaseMissingEnv.length === 0;

let app = null;
let auth = null;
let db = null;

if (firebaseReady) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = createAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
