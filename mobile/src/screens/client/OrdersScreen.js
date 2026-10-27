// "Mis pedidos". En esta etapa solo explica lo que viene; no muestra datos falsos.
import React from 'react';
import { Text } from 'react-native';
import { Card, Screen, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export default function OrdersScreen() {
  const { mode } = useAuth();
  return (
    <Screen>
      <Text style={styles.title}>{mode === 'provider' ? 'Pedidos recibidos' : 'Mis pedidos'}</Text>
      <Card>
        <Text style={styles.section}>Aún no disponible</Text>
        <Text style={styles.muted}>
          {mode === 'provider'
            ? 'Aquí verás los pedidos y reservas que te hagan los clientes, y podrás avanzar su estado (aceptado, en proceso, listo, entregado). Se implementa en la Etapa 5.'
            : 'Aquí verás tus solicitudes, reservas y pedidos con su estado. Se implementa en la Etapa 4.'}
        </Text>
      </Card>
    </Screen>
  );
}
