// Inicio en modo cliente: categorías reales desde Firestore + búsqueda.
// La lista de proveedores, solicitudes y reservas llega en la Etapa 4.
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Hero from '../../components/Hero';
import CategoryList from '../../components/CategoryList';
import ModeSwitchModal from '../../components/ModeSwitchModal';
import { Card, Notice, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { colors } from '../../constants/brand';

export default function ClientHomeScreen() {
  const { profile, user } = useAuth();
  const { categories, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const q = search.trim().toLowerCase();
  const filtered = categories.filter((c) => `${c.name} ${c.description || ''}`.toLowerCase().includes(q));
  const firstName = (profile?.displayName || '').split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blue }} edges={['top']}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Hero
          title={firstName ? `Hola, ${firstName}.` : 'Lo que necesitas, cerca de ti.'}
          intro="Encuentra servicios de confianza en tu zona. Comenzamos con lavanderías."
          search={search}
          onSearch={setSearch}
          modeLabel="👤 Modo cliente"
          onModePress={() => setModeOpen(true)}
        />
        <View style={styles.page}>
          {user && !user.emailVerified && (
            <Notice tone="warn">Te enviamos un correo para verificar tu cuenta. Puedes seguir usando la app mientras tanto.</Notice>
          )}
          <Text style={[styles.section, { marginTop: 8 }]}>¿Qué necesitas hoy?</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>Explora las categorías disponibles</Text>
          {loading && <Text style={styles.muted}>Cargando categorías…</Text>}
          {!!error && <Notice tone="error">No se pudieron cargar las categorías.</Notice>}
          {!loading && !error && categories.length === 0 && (
            <Notice tone="warn">Aún no hay categorías. Un administrador debe cargar el catálogo inicial (Perfil → Herramientas de administrador).</Notice>
          )}
          {!loading && categories.length > 0 && filtered.length === 0 && (
            <Notice tone="info">No encontramos “{search}”. Pronto podrás publicar una solicitud para que te respondan proveedores de tu zona.</Notice>
          )}
          <CategoryList
            categories={filtered}
            onPress={(c) =>
              setNotice(
                c.active
                  ? `Elegiste ${c.name}. La búsqueda de proveedores y las reservas se habilitan en la siguiente etapa del desarrollo.`
                  : `${c.name} estará disponible próximamente.`
              )
            }
          />
          <Notice tone="success">{notice}</Notice>
          <Card>
            <Text style={styles.section}>¿No encuentras lo que buscas?</Text>
            <Text style={styles.muted}>Próximamente podrás publicar una solicitud y recibir respuestas de proveedores de tu zona.</Text>
          </Card>
          <Text style={styles.disclaimer}>Versión de desarrollo: todavía no hay reservas ni pagos dentro de la app.</Text>
        </View>
      </ScrollView>
      <ModeSwitchModal visible={modeOpen} onClose={() => setModeOpen(false)} />
    </SafeAreaView>
  );
}
