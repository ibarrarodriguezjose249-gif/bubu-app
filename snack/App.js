// Punto de entrada de la app BÜBÜ.
// Carga la tipografía Montserrat y después muestra la app.
import React from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold,
  Montserrat_700Bold, Montserrat_800ExtraBold, Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import { firebaseReady, firebaseMissingEnv } from './bubuFirebase';
import { AuthProvider } from './AuthContext';
import { CatalogProvider } from './CatalogContext';
import RootNavigator from './RootNavigator';
import { ConfigMissingScreen } from './SystemScreens';
import { BRAND_NAME, colors } from './brand';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold,
    Montserrat_700Bold, Montserrat_800ExtraBold, Montserrat_900Black,
  });

  // Mientras carga la tipografía: pantalla azul con el nombre (como el ícono).
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.white, fontSize: 48, fontWeight: '900' }}>{BRAND_NAME}</Text>
      </View>
    );
  }

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
