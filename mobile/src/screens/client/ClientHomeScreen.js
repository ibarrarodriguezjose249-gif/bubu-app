// Inicio del cliente: publicar pedido, ver lavanderías conectadas (datos reales),
// pedidos activos y categorías.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Hero from '../../components/Hero';
import CategoryList from '../../components/CategoryList';
import ModeSwitchModal from '../../components/ModeSwitchModal';
import { Button, Card, Notice, styles } from '../../components/ui';
import { RequestCard, StatPill } from '../../components/cards';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { colors } from '../../constants/brand';
import { isOnline, subscribeApprovedProviders } from '../../services/providers';
import { requestState, subscribeMyRequests } from '../../services/requests';
import { useNow } from '../../lib/time';

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
  const zoneName = zoneById(zoneId)?.name || 'tu zona';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blue }} edges={['top']}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Hero
          title={firstName ? `Hola, ${firstName}.` : 'Lo que necesitas, cerca de ti.'}
          intro="Publica lo que necesitas, recibe ofertas de lavanderías de tu zona y elige la que más te guste."
          search={search}
          onSearch={setSearch}
          modeLabel="👤 Modo cliente"
          onModePress={() => setModeOpen(true)}
        />
        <View style={styles.page}>
          {/* Actividad real de la zona */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatPill value={onlineCount} label={`🟢 conectadas ahora`} tone={onlineCount > 0 ? 'success' : 'info'} />
            <StatPill value={inZone.length} label={`lavanderías en ${zoneName}`} />
          </View>

          <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy }}>
            <Text style={[styles.section, { color: colors.white }]}>🧺 ¿Ropa por lavar?</Text>
            <Text style={[styles.muted, { color: '#cfdef5' }]}>
              Publica tu pedido y las lavanderías disponibles te mandan su precio y horario. Tú eliges. Recibes ofertas durante 30 minutos.
            </Text>
            <Button title="Publicar pedido" variant="light" onPress={() => navigation.navigate('NewRequest', { categoryId: 'lavanderia' })} />
            {inZone.length === 0 && (
              <Text style={[styles.muted, { color: '#cfdef5', marginTop: 10 }]}>
                Estamos sumando lavanderías en {zoneName}. Si publicas ahora, verás las ofertas en cuanto se conecten.
              </Text>
            )}
          </Card>

          {activeRequests.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: 22 }]}>Tus pedidos recibiendo ofertas</Text>
              {activeRequests.slice(0, 3).map((r) => (
                <RequestCard key={r.id} request={r} state="open" now={now} onPress={() => navigation.navigate('RequestDetail', { id: r.id })} />
              ))}
            </>
          )}

          {user && !user.emailVerified && (
            <Notice tone="warn">Te enviamos un correo para verificar tu cuenta. Puedes seguir usando la app mientras tanto.</Notice>
          )}

          <Text style={[styles.section, { marginTop: 22 }]}>Servicios</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>Toca una categoría para ver quién la ofrece</Text>
          {loading && <Text style={styles.muted}>Cargando categorías…</Text>}
          {!!error && <Notice tone="error">No se pudieron cargar las categorías.</Notice>}
          {!loading && !error && categories.length === 0 && (
            <Notice tone="warn">Aún no hay categorías. Un administrador debe cargar el catálogo inicial (Perfil → Herramientas de administrador).</Notice>
          )}
          <CategoryList
            categories={filtered}
            onPress={(c) => c.active && navigation.navigate('CategoryProviders', { categoryId: c.id })}
          />
          <Text style={styles.disclaimer}>BÜBÜ no cobra dentro de la app: el pago se acuerda directo con la lavandería.</Text>
        </View>
      </ScrollView>
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </SafeAreaView>
  );
}
