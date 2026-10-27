// Navegación: sin sesión → bienvenida/login/registro.
// Con sesión → pestañas (Inicio, Pedidos, Perfil) + pantallas secundarias.
import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { BRAND_NAME, colors } from '../constants/brand';
import { Loading } from '../components/ui';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ClientHomeScreen from '../screens/client/ClientHomeScreen';
import OrdersScreen from '../screens/client/OrdersScreen';
import ProviderHomeScreen from '../screens/provider/ProviderHomeScreen';
import ProviderApplicationScreen from '../screens/provider/ProviderApplicationScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import EditProfileScreen from '../screens/common/EditProfileScreen';
import AdminToolsScreen from '../screens/admin/AdminToolsScreen';
import { ProfileMissingScreen, SuspendedScreen } from '../screens/common/SystemScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.blue, background: colors.bg, card: colors.white, text: colors.ink, border: colors.border },
};

const stackOptions = {
  headerTintColor: colors.blue,
  headerTitleStyle: { color: colors.ink, fontWeight: '800' },
  headerBackTitle: 'Atrás',
};

function TabIcon({ glyph, focused }) {
  return <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;
}

function HomeByMode(props) {
  const { mode } = useAuth();
  return mode === 'provider' ? <ProviderHomeScreen {...props} /> : <ClientHomeScreen {...props} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: '#68768e',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Inicio" component={HomeByMode} options={{ tabBarIcon: (p) => <TabIcon glyph="⌂" {...p} /> }} />
      <Tab.Screen name="Pedidos" component={OrdersScreen} options={{ tabBarIcon: (p) => <TabIcon glyph="🧾" {...p} /> }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ tabBarIcon: (p) => <TabIcon glyph="👤" {...p} /> }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { loading, user, profile } = useAuth();

  if (loading) return <Loading text={`Abriendo ${BRAND_NAME}…`} />;

  let content;
  if (!user) {
    content = (
      <Stack.Navigator screenOptions={stackOptions}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
      </Stack.Navigator>
    );
  } else if (!profile) {
    content = (
      <Stack.Navigator>
        <Stack.Screen name="ProfileMissing" component={ProfileMissingScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  } else if (profile.status === 'suspended') {
    content = (
      <Stack.Navigator>
        <Stack.Screen name="Suspended" component={SuspendedScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  } else {
    content = (
      <Stack.Navigator screenOptions={stackOptions}>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ProviderApplication" component={ProviderApplicationScreen} options={{ title: 'Solicitud de proveedor' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar datos' }} />
        <Stack.Screen name="AdminTools" component={AdminToolsScreen} options={{ title: 'Administrador' }} />
      </Stack.Navigator>
    );
  }

  return <NavigationContainer theme={theme}>{content}</NavigationContainer>;
}
