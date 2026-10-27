// Pantalla pública de inicio (sin sesión). Conserva el diseño de la versión 0.
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Hero from '../../components/Hero';
import CategoryList from '../../components/CategoryList';
import { Button, Card, Notice, styles } from '../../components/ui';
import { useCatalog } from '../../context/CatalogContext';
import { BRAND_NAME, colors } from '../../constants/brand';

export default function WelcomeScreen({ navigation }) {
  const { categories, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = categories.filter((c) => `${c.name} ${c.description || ''}`.toLowerCase().includes(q));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blue }} edges={['top']}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Hero
          title="Lo que necesitas, cerca de ti."
          intro="Encuentra servicios de confianza en tu zona. Comenzamos con lavanderías en General Zuazua."
          search={search}
          onSearch={setSearch}
        />
        <View style={styles.page}>
          <Text style={styles.section}>¿Qué necesitas hoy?</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>Explora las categorías disponibles</Text>
          {loading && <Text style={styles.muted}>Cargando categorías…</Text>}
          {!!error && <Notice tone="error">No se pudieron cargar las categorías. Revisa tu conexión o la configuración de Firebase.</Notice>}
          {!loading && !error && categories.length === 0 && (
            <Notice tone="warn">Todavía no hay categorías cargadas. Un administrador debe cargar el catálogo inicial.</Notice>
          )}
          <CategoryList
            categories={filtered}
            onPress={(c) => setNotice(c.active ? `Crea una cuenta o inicia sesión para pedir ${c.name.toLowerCase()}.` : `${c.name} estará disponible próximamente.`)}
          />
          <Notice tone="success">{notice}</Notice>

          <Card>
            <Text style={styles.section}>Únete a {BRAND_NAME}</Text>
            <Text style={styles.muted}>Una sola cuenta te permite contratar servicios u ofrecer los tuyos.</Text>
            <Button title="Crear cuenta" onPress={() => navigation.navigate('Register')} />
            <Button title="Ya tengo cuenta" variant="outline" onPress={() => navigation.navigate('Login')} />
          </Card>
          <Text style={styles.disclaimer}>Versión de desarrollo: no hay pagos dentro de la app.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
