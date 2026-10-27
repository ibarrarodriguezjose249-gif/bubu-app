// Inicio en modo proveedor: muestra el estado de la solicitud de proveedor.
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Hero from '../../components/Hero';
import ModeSwitchModal from '../../components/ModeSwitchModal';
import { Badge, Button, Card, Notice, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { PROVIDER_STATUS } from '../../services/providers';
import { FULFILLMENT_MODES } from '../../constants/catalog';
import { BRAND_NAME, colors } from '../../constants/brand';

export default function ProviderHomeScreen({ navigation }) {
  const { provider } = useAuth();
  const { categoryById, zoneById } = useCatalog();
  const [modeOpen, setModeOpen] = useState(false);
  const st = provider ? PROVIDER_STATUS[provider.status] || PROVIDER_STATUS.pending : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blue }} edges={['top']}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Hero
          eyebrow="MODO PROVEEDOR"
          title="Ofrece tus servicios."
          intro="Registra tu negocio o tu servicio desde casa."
          modeLabel="🧰 Modo proveedor"
          onModePress={() => setModeOpen(true)}
        />
        <View style={styles.page}>
          {!provider ? (
            <Card>
              <Text style={styles.section}>Ofrece tus servicios en {BRAND_NAME}</Text>
              <Text style={styles.muted}>
                Envía tu solicitud. El equipo de {BRAND_NAME} la revisa y, cuando la apruebe, podrás publicar tus servicios y recibir pedidos.
              </Text>
              <Button title="Comenzar solicitud" onPress={() => navigation.navigate('ProviderApplication')} />
            </Card>
          ) : (
            <Card>
              <View style={styles.row}>
                <Text style={[styles.section, { flex: 1 }]} numberOfLines={2}>{provider.businessName}</Text>
                <Badge tone={st.tone}>{st.label}</Badge>
              </View>
              <Notice tone={st.tone}>{st.text}</Notice>
              {!!provider.reviewNote && <Notice tone="info">Nota del equipo: {provider.reviewNote}</Notice>}
              <Text style={[styles.muted, { marginTop: 14 }]}>
                Categorías: {(provider.categoryIds || []).map((id) => categoryById(id)?.name || id).join(', ') || '—'}
              </Text>
              <Text style={styles.muted}>
                Zonas: {(provider.zoneIds || []).map((id) => zoneById(id)?.name || id).join(', ') || '—'}
              </Text>
              <Text style={styles.muted}>
                Modalidad: {(provider.fulfillmentModes || []).map((m) => FULFILLMENT_MODES[m]?.providerLabel || m).join(' · ') || '—'}
              </Text>
              {provider.status !== 'suspended' && (
                <Button title={provider.status === 'rejected' ? 'Corregir y reenviar' : 'Editar solicitud'} variant="outline" onPress={() => navigation.navigate('ProviderApplication')} />
              )}
            </Card>
          )}
          {provider?.status === 'approved' && (
            <Card>
              <Text style={styles.section}>Mis servicios</Text>
              <Text style={styles.muted}>La publicación de servicios con precios de referencia y la recepción de pedidos se habilitan en la Etapa 5.</Text>
            </Card>
          )}
          <Text style={styles.disclaimer}>{BRAND_NAME} no procesa pagos todavía. Los precios que publiques serán solo de referencia.</Text>
        </View>
      </ScrollView>
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </SafeAreaView>
  );
}
