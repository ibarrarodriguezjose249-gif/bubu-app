// Punto de entrada de la app BÜBÜ.
// La pantalla única de la versión 0 se conserva en docs/referencia/App_v0_pantalla_unica.js
// y su diseño se reutiliza en src/components/Hero.js y src/screens/*/…HomeScreen.js.
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { firebaseReady, firebaseMissingEnv } from './bubuFirebase';
import { AuthProvider } from './AuthContext';
import { CatalogProvider } from './CatalogContext';
import RootNavigator from './RootNavigator';
import { ConfigMissingScreen } from './SystemScreens';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {firebaseReady ? (
        <AuthProvider>
          <CatalogProvider>
            <RootNavigator />
          </CatalogProvider>
        </AuthProvider>
      ) : (
        <ConfigMissingScreen missing={firebaseMissingEnv} />
      )}
    </SafeAreaProvider>
  );
}
