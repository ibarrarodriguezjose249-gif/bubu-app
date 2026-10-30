// Navegación (como Uber):
// - Sin sesión → Bienvenida → Iniciar sesión / Registrarse / Recuperar contraseña.
// - Con sesión guardada → entra directo a la app (Firebase Authentication recuerda la sesión).
// - La primera vez en cada modo (cliente / proveedor) aparece el tutorial (se puede omitir).
import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { BRAND_NAME, colors, fonts } from '../constants/brand';
import { Loading } from '../components/ui';
import Icon from '../components/Icon';
import { tutorialSeen } from '../lib/tutorial';

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
import NewRequestScreen from '../screens/client/NewRequestScreen';
import RequestDetailScreen from '../screens/client/RequestDetailScreen';
import CategoryProvidersScreen from '../screens/client/CategoryProvidersScreen';
import DirectBookingScreen from '../screens/client/DirectBookingScreen';
import OrderDetailScreen from '../screens/common/OrderDetailScreen';
import MakeOfferScreen from '../screens/provider/MakeOfferScreen';
import CommissionsScreen from '../screens/provider/CommissionsScreen';
import PayoutAccountScreen from '../screens/provider/PayoutAccountScreen';
import OrderChatScreen from '../screens/common/OrderChatScreen';
import ServiceAreaScreen from '../screens/provider/ServiceAreaScreen';
import TutorialScreen from '../screens/common/TutorialScreen';
import { ProfileMissingScreen, SuspendedScreen } from '../screens/common/SystemScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.blue, background: colors.bg, card: colors.white, text: colors.ink, border: colors.border },
};

const stackOptions = {
  headerTintColor: colors.blue,
  headerTitleStyle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
  headerBackTitle: 'Atrás',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.white },
  contentStyle: { backgroundColor: colors.bg },
};

const TAB_ICONS = { Inicio: 'home', Pedidos: 'receipt', Perfil: 'person' };

function HomeByMode(props) {
  const { mode } = useAuth();
  return mode === 'provider' ? <ProviderHomeScreen {...props} /> : <ClientHomeScreen {...props} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: '#8A96A8',
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarIcon: ({ focused, color }) => <Icon name={`${TAB_ICONS[route.name]}${focused ? '' : '-outline'}`} size={23} color={color} />,
      })}
    >
      <Tab.Screen name="Inicio" component={HomeByMode} />
      <Tab.Screen name="Pedidos" component={OrdersScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { loading, user, profile, mode } = useAuth();

  // ¿Ya vio el tutorial de este modo? null = consultando.
  const [seen, setSeen] = useState(null);
  const uid = user?.uid;
  useEffect(() => {
    let alive = true;
    setSeen(null);
    if (!uid) return undefined;
    tutorialSeen(uid, mode).then((v) => alive && setSeen(v));
    return () => { alive = false; };
  }, [uid, mode]);

  if (loading) return <Loading text={`Abriendo ${BRAND_NAME}…`} />;

  let content;
  if (!user) {
    content = (
      <Stack.Navigator screenOptions={{ ...stackOptions, headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </Stack.Navigator>
    );
  } else if (!profile) {
    content = (
      <Stack.Navigator>
        <Stack.Screen name="ProfileMissing" component={ProfileMissingScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  } else if (profile.status === 'suspended' || profile.status === 'review') {
    content = (
      <Stack.Navigator>
        <Stack.Screen name="Suspended" component={SuspendedScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  } else if (seen === null) {
    return <Loading text={`Abriendo ${BRAND_NAME}…`} />;
  } else if (!seen) {
    // Primera vez en este modo: tutorial (con opción de omitir).
    return <TutorialScreen mode={mode} onFinish={() => setSeen(true)} />;
  } else {
    content = (
      <Stack.Navigator screenOptions={stackOptions}>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ProviderApplication" component={ProviderApplicationScreen} options={{ title: 'Solicitud de proveedor' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar datos' }} />
        <Stack.Screen name="AdminTools" component={AdminToolsScreen} options={{ title: 'Administrador' }} />
        <Stack.Screen name="NewRequest" component={NewRequestScreen} options={{ title: 'Publicar pedido' }} />
        <Stack.Screen name="RequestDetail" component={RequestDetailScreen} options={{ title: 'Tu pedido' }} />
        <Stack.Screen name="CategoryProviders" component={CategoryProvidersScreen} options={{ title: 'Proveedores' }} />
        <Stack.Screen name="DirectBooking" component={DirectBookingScreen} options={{ title: 'Reservar' }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Pedido' }} />
        <Stack.Screen name="MakeOffer" component={MakeOfferScreen} options={{ title: 'Oferta' }} />
        <Stack.Screen name="Commissions" component={CommissionsScreen} options={{ title: 'Pagos y comisiones' }} />
        <Stack.Screen name="PayoutAccount" component={PayoutAccountScreen} options={{ title: 'Cuenta para transferencias' }} />
        <Stack.Screen name="OrderChat" component={OrderChatScreen} options={{ title: 'Mensajes' }} />
        <Stack.Screen name="ServiceArea" component={ServiceAreaScreen} options={{ title: 'Zona de servicio' }} />
        <Stack.Screen name="Tutorial" component={TutorialScreen} options={{ headerShown: false, presentation: 'modal' }} />
      </Stack.Navigator>
    );
  }

  return <NavigationContainer theme={theme}>{content}</NavigationContainer>;
}
