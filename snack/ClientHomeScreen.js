// Inicio del cliente: buscador, tarjeta para publicar pedido, actividad real de la zona,
// categorías en cuadrícula y pedidos que están recibiendo ofertas.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Hero from './Hero';
import CategoryList from './CategoryList';
import ModeSwitchModal from './ModeSwitchModal';
import Icon from './Icon';
import { Notice, styles } from './ui';
import { RequestCard } from './cards';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import { BRAND_NAME, colors, fonts, shadow } from './brand';
import { isOnline, subscribeApprovedProviders } from './providers';
import { requestState, subscribeMyRequests } from './services_requests';
import { useNow } from './time';

export default function ClientHomeScreen({ navigation }) {
  const { profile, user } = useAuth();
  const { categories, loading, error, zoneById } = useCatalog();
  const [search, setSearch] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const now = useNow(1000);
  const zoneId = profile?.zoneId || 'general-zuazua';

  useEffect(() => subscribeApprovedProviders(setProviders, () => setProviders([])), []);
  useEffect(() => (user ? subscribeMyRequests(user.uid, setMyRequests, () => {}) : undefined), [user]);

  const inZone = useMemo(() => providers.filter((p) => p.id !== user?.uid && (p.zoneIds || []).includes(zoneId) && (p.categoryIds || []).includes('lavanderia')), [providers, zoneId, user]);
  const onlineCount = inZone.filter((p) => isOnline(p, now)).length;
  const activeRequests = myRequests.filter((r) => requestState(r, now) === 'open');

  const q = search.trim().toLowerCase();
  const filtered = categories.filter((c) => `${c.name} ${c.description || ''}`.toLowerCase().includes(q));
  const firstName = (profile?.displayName || '').split(' ')[0];
  const zone = zoneById(zoneId);
  const zoneName = zone?.name || 'tu zona';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blue }} edges={['top']}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Hero
          title={firstName ? `Hola, ${firstName}` : null}
          search={search}
          onSearch={setSearch}
          modeLabel="Cliente"
          modeIcon="person-outline"
          onModePress={() => setModeOpen(true)}
          zoneLabel={zone ? `${zone.name}, N.L.` : undefined}
        />
        <View style={styles.page}>
          {/* Tarjeta principal: publicar pedido de lavandería */}
          <Pressable onPress={() => navigation.navigate('NewRequest', { categoryId: 'lavanderia' })} style={({ pressed }) => [s.promo, pressed && { opacity: 0.92 }]} accessibilityRole="button" accessibilityLabel="Publicar pedido de lavandería">
            <View style={{ flex: 1 }}>
              <Text style={s.promoTitle}>Tu ropa limpia, sin complicaciones</Text>
              <Text style={s.promoText}>Publica tu pedido y las lavanderías de tu zona te mandan su oferta en 30 minutos. Tú eliges.</Text>
              <View style={s.promoBtn}>
                <Text style={s.promoBtnText}>Publicar pedido</Text>
                <Icon name="arrow-forward" size={16} color={colors.blue} />
              </View>
            </View>
            <View style={s.promoArt}><Icon name="washing-machine" size={56} color={colors.white} /></View>
          </Pressable>

          {/* Actividad real de la zona */}
          <View style={s.liveRow}>
            <View style={s.live}>
              <View style={[s.dot, { backgroundColor: onlineCount > 0 ? colors.success : '#B7C0CF' }]} />
              <Text style={s.liveNum}>{onlineCount}</Text>
              <Text style={s.liveLabel}>conectadas ahora</Text>
            </View>
            <View style={s.live}>
              <Icon name="storefront-outline" size={16} color={colors.blue} />
              <Text style={s.liveNum}>{inZone.length}</Text>
              <Text style={s.liveLabel}>lavanderías en {zoneName}</Text>
            </View>
          </View>
          {inZone.length === 0 && (
            <Text style={[styles.muted, { marginTop: 8 }]}>Estamos sumando lavanderías en {zoneName}. Si publicas ahora, verás las ofertas en cuanto se conecten.</Text>
          )}

          {activeRequests.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: 24 }]}>Tus pedidos recibiendo ofertas</Text>
              {activeRequests.slice(0, 3).map((r) => (
                <RequestCard key={r.id} request={r} state="open" now={now} onPress={() => navigation.navigate('RequestDetail', { id: r.id })} />
              ))}
            </>
          )}

          {user && !user.emailVerified && (
            <Notice tone="warn">Te enviamos un correo para verificar tu cuenta. Puedes seguir usando la app mientras tanto.</Notice>
          )}

          <Text style={[styles.section, { marginTop: 24, marginBottom: 6 }]}>Categorías de servicios</Text>
          {loading && <Text style={styles.muted}>Cargando categorías…</Text>}
          {!!error && <Notice tone="error">No se pudieron cargar las categorías.</Notice>}
          {!loading && !error && categories.length === 0 && (
            <Notice tone="warn">Aún no hay categorías. Un administrador debe cargar el catálogo inicial (Perfil → Herramientas de administrador).</Notice>
          )}
          <CategoryList
            categories={filtered}
            onPress={(c) => c.active && navigation.navigate('CategoryProviders', { categoryId: c.id })}
          />

          <View style={s.community}>
            <View style={s.communityIcon}><Icon name="people-outline" size={22} color={colors.blue} /></View>
            <Text style={s.communityText}>Servicios locales, en tu comunidad. {BRAND_NAME} no cobra dentro de la app: el pago se acuerda directo con la lavandería.</Text>
          </View>
        </View>
      </ScrollView>
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  promo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.blue, borderRadius: 22, padding: 18, marginTop: 4, overflow: 'hidden', ...shadow },
  promoTitle: { fontFamily: fonts.extra, fontSize: 19, color: colors.white, lineHeight: 24 },
  promoText: { fontFamily: fonts.regular, fontSize: 13, color: '#E3EEFF', marginTop: 6, lineHeight: 19 },
  promoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 22, paddingVertical: 9, paddingHorizontal: 14, marginTop: 14 },
  promoBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  promoArt: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#FFFFFF22', alignItems: 'center', justifyContent: 'center' },
  liveRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  live: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  liveNum: { fontFamily: fonts.extra, fontSize: 18, color: colors.ink },
  liveLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  community: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginTop: 18 },
  communityIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  communityText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.ink, lineHeight: 18 },
});
