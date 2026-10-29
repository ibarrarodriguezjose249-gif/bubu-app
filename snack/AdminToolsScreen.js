// Herramientas mínimas de administrador dentro de la app.
// Solo se muestran si existe admins/{tuUID} (creado a mano en la consola).
// Aunque alguien forzara esta pantalla, las reglas de Firestore rechazan
// las escrituras de quien no sea administrador.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Notice, Screen, styles } from './ui';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import { seedInitialCatalog } from './services_catalog';
import { friendlyError } from './errors';

export default function AdminToolsScreen() {
  const { isAdmin, user } = useAuth();
  const { categories, zones } = useCatalog();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });

  if (!isAdmin) {
    return (
      <Screen>
        <Notice tone="error">Esta sección es solo para administradores.</Notice>
      </Screen>
    );
  }

  async function seed() {
    setBusy(true);
    try {
      const created = await seedInitialCatalog();
      setMsg(created > 0
        ? { tone: 'success', text: `Listo: se crearon ${created} documentos (categorías y zonas que faltaban).` }
        : { tone: 'info', text: 'El catálogo ya estaba completo; no se cambió nada.' });
    } catch (e) {
      setMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Administrador</Text>
      <Text style={styles.muted}>Tu UID: {user?.uid}</Text>
      <Card>
        <Text style={styles.section}>Catálogo inicial</Text>
        <Text style={styles.muted}>
          Crea las categorías (Lavandería activa; Limpieza, Reparaciones, Jardinería, Mudanzas y Cuidado de mascotas como “próximamente”) y la zona General Zuazua. Solo crea lo que falte.
        </Text>
        <Text style={styles.muted}>Actualmente: {categories.length} categorías · {zones.length} zonas.</Text>
        <Button title="Cargar catálogo inicial" onPress={seed} loading={busy} />
        <Notice tone={msg.tone}>{msg.text}</Notice>
      </Card>
      <Card>
        <Text style={styles.section}>Aprobar proveedores</Text>
        <Text style={styles.muted}>
          Se hará desde el panel web administrativo (Etapa 6). Mientras tanto puedes aprobar desde la consola de Firebase cambiando el campo “status” del documento providers/(UID) a “approved”.
        </Text>
      </Card>
    </Screen>
  );
}
