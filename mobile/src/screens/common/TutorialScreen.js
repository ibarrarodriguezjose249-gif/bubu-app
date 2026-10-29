// Tutorial guiado para clientes y proveedores.
// - Aparece la primera vez que la cuenta entra a cada modo (lo decide RootNavigator).
// - También se abre desde Perfil → "Ver tutorial" (route.params.mode).
// - Al terminar u omitir se guarda en el teléfono y no vuelve a salir solo.
// Para proveedores sin aprobar solo explica el registro y la espera de autorización.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { markTutorialSeen } from '../../lib/tutorial';
import { BRAND_NAME, colors, fonts } from '../../constants/brand';
import { IS_SOCIOS, SOCIOS_APP_NAME } from '../../constants/variant';

const CLIENT_STEPS = [
  { icon: 'search', title: 'Encuentra un servicio', text: 'En Inicio elige la categoría que necesitas. Hoy está disponible Lavandería; las demás aparecen como "Pronto".' },
  { icon: 'create-outline', title: 'Publica tu solicitud', text: 'Toca "Publicar pedido" y di qué necesitas, cuánta ropa, el día, el horario y tu colonia. Solo se publica la colonia: tus datos quedan privados.' },
  { icon: 'pricetags-outline', title: 'Compara las ofertas', text: 'Durante 30 minutos las lavanderías conectadas te mandan su precio y horario. Te marcamos el mejor precio, quién respondió primero y su calificación.' },
  { icon: 'checkmark-circle-outline', title: 'Elige un proveedor', text: 'Toca "Elegir esta oferta". Solo entonces compartes tu dirección y teléfono, únicamente con la lavandería que elegiste.' },
  { icon: 'navigate-outline', title: 'Sigue tu pedido', text: 'En la pestaña Pedidos ves cada avance al momento: Aceptado, En proceso, Listo y Entregado.' },
  { icon: 'star-outline', title: 'Finaliza y califica', text: 'Cuando el pedido diga Entregado, califícalo de 1 a 5 estrellas. Tu opinión ayuda a tus vecinos a elegir. El pago se acuerda directo con la lavandería.' },
];

function providerSteps(provider) {
  const approved = provider?.status === 'approved';
  const base = [
    { icon: 'person-outline', title: 'Completa tu perfil', text: provider ? 'Tu solicitud ya está enviada. Puedes editarla desde Inicio → "Editar perfil de proveedor".' : 'En Inicio toca "Comenzar solicitud": nombre del negocio, si trabajas en local o desde casa, tu zona y cómo entregas.' },
    { icon: 'shield-checkmark-outline', title: 'Espera la aprobación', text: approved ? '¡Tu cuenta ya está aprobada!' : `El equipo de ${BRAND_NAME} revisa tu solicitud. Verás el estado en Inicio. Mientras no te aprueben no podrás recibir pedidos.` },
  ];
  if (!approved) {
    return [...base, { icon: 'time-outline', title: 'Te avisamos en la app', text: 'Cuando te aprueben, en Inicio aparecerá el botón "Conectarme". Vuelve a ver este tutorial desde Perfil para conocer cómo recibir pedidos.' }];
  }
  return [
    ...base,
    { icon: 'power', title: 'Conéctate', text: 'Toca el botón grande "Conectarme". Los clientes te verán "conectado ahora". Mantén la app abierta: la pantalla no se apaga mientras estés conectado.' },
    { icon: 'notifications-outline', title: 'Recibe solicitudes', text: 'Cuando un cliente de tu zona publique un pedido, el teléfono vibra y sube una tarjeta con lo que necesita.' },
    { icon: 'pricetag-outline', title: 'Manda tu oferta', text: 'Toca "Acepto" para tomarlo en el horario del cliente, o "Proponer precio u horario". El cliente elige entre las ofertas.' },
    { icon: 'list-outline', title: 'Atiende tus pedidos', text: 'Si te eligen, verás la dirección y el teléfono. Avanza el pedido: Recibí la ropa → Listo → Entregado.' },
  ];
}

export default function TutorialScreen({ route, navigation, mode: modeProp, onFinish }) {
  const { user, provider } = useAuth();
  const mode = modeProp || route?.params?.mode || 'client';
  const manual = !!route?.params?.manual;
  const steps = useMemo(() => (mode === 'provider' ? providerSteps(provider) : CLIENT_STEPS), [mode, provider]);
  // -1 = pantalla de inicio; 0..n-1 = pasos; n = final
  const [i, setI] = useState(manual ? 0 : -1);

  async function finish() {
    if (user) await markTutorialSeen(user.uid, mode);
    if (onFinish) onFinish();
    else if (navigation?.canGoBack()) navigation.goBack();
  }

  const skip = (
    <Pressable onPress={finish} style={s.skip} hitSlop={10} accessibilityRole="button">
      <Text style={s.skipText}>Omitir tutorial</Text>
    </Pressable>
  );

  // Pantalla de inicio
  if (i === -1) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.page}>
          <View style={s.center}>
            <View style={s.bigCircle}><Icon name={mode === 'provider' ? 'briefcase-outline' : 'heart-outline'} size={64} color={colors.blue} /></View>
            <Text style={s.hello}>{IS_SOCIOS ? `¡Bienvenido a ${SOCIOS_APP_NAME}! 💙` : mode === 'provider' ? 'Bienvenido al modo proveedor' : `¡Bienvenido a ${BRAND_NAME}! 💙`}</Text>
            <Text style={s.ask}>¿Cómo quieres comenzar?</Text>
          </View>
          <View>
            <Button title="Enseñarme cómo funciona" icon="school-outline" onPress={() => setI(0)} />
            <Button title={`Ya conozco ${IS_SOCIOS ? SOCIOS_APP_NAME : BRAND_NAME}, omitir tutorial`} variant="outline" onPress={finish} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Pantalla final
  if (i >= steps.length) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.page}>
          <View style={s.center}>
            <View style={[s.bigCircle, { backgroundColor: colors.turquoiseSoft }]}><Icon name="checkmark-done" size={64} color={colors.blue} /></View>
            <Text style={s.hello}>¡Listo!</Text>
            <Text style={s.ask}>{mode === 'provider' ? 'Ya sabes cómo funciona el modo proveedor.' : `Ya sabes cómo usar ${BRAND_NAME}. Tu comunidad, tus servicios.`}</Text>
          </View>
          <View>
            <Button title={`Comenzar a usar ${IS_SOCIOS ? SOCIOS_APP_NAME : BRAND_NAME}`} onPress={finish} />
            <Button title="Anterior" variant="ghost" onPress={() => setI(i - 1)} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const step = steps[i];
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.page}>
        <View>
          <View style={s.topRow}>
            <Text style={s.progress}>Paso {i + 1} de {steps.length}</Text>
            {skip}
          </View>
          <View style={s.bar}><View style={[s.barFill, { width: `${((i + 1) / steps.length) * 100}%` }]} /></View>
        </View>
        <View style={s.center}>
          <View style={s.bigCircle}><Icon name={step.icon} size={64} color={colors.blue} /></View>
          <Text style={s.stepTitle}>{step.title}</Text>
          <Text style={s.stepText}>{step.text}</Text>
        </View>
        <View style={s.navRow}>
          {i > 0 ? <Button title="Anterior" variant="outline" onPress={() => setI(i - 1)} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
          <Button title="Siguiente" onPress={() => setI(i + 1)} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { flexGrow: 1, justifyContent: 'space-between', padding: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  center: { alignItems: 'center', marginVertical: 28 },
  bigCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  hello: { fontFamily: fonts.extra, fontSize: 26, color: colors.ink, textAlign: 'center' },
  ask: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 23 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progress: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  skip: { paddingVertical: 6 },
  skipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.turquoise },
  stepTitle: { fontFamily: fonts.extra, fontSize: 24, color: colors.ink, textAlign: 'center' },
  stepText: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  navRow: { flexDirection: 'row', gap: 12 },
});
