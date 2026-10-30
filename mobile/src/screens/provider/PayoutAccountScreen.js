// Cuenta del socio para que los clientes le transfieran DIRECTO (CLABE, tarjeta o Mercado Pago).
// BÜBÜ no recibe ese dinero: solo le muestra estos datos al cliente de cada pedido.
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Field, Loading, Notice, Screen, styles } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { deletePayInfo, getPayInfo, savePayInfo } from '../../services/payments';
import { friendlyError } from '../../lib/errors';

export default function PayoutAccountScreen() {
  const { user } = useAuth();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!user) return;
    getPayInfo(user.uid)
      .then((p) => setF({ holder: p?.holder || '', bank: p?.bank || '', account: p?.account || '', note: p?.note || '', saved: !!p }))
      .catch(() => setF({ holder: '', bank: '', account: '', note: '', saved: false }));
  }, [user]);

  async function save() {
    const digits = f.account.replace(/\s+/g, '');
    if (f.holder.trim().length < 2) return setMsg({ tone: 'error', text: 'Escribe el nombre del titular de la cuenta.' });
    if (digits.length < 6) return setMsg({ tone: 'error', text: 'Escribe tu CLABE (18 dígitos), número de tarjeta o cuenta.' });
    setBusy(true); setMsg({ tone: 'info', text: '' });
    try {
      await savePayInfo(user.uid, f);
      setF((x) => ({ ...x, saved: true }));
      setMsg({ tone: 'success', text: 'Guardado. Se mostrará a tus clientes en los pedidos nuevos cuando anotes el total.' });
    } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await deletePayInfo(user.uid); setF({ holder: '', bank: '', account: '', note: '', saved: false }); setMsg({ tone: 'success', text: 'Cuenta quitada. Tus clientes solo podrán pagarte en efectivo.' }); }
    catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); } finally { setBusy(false); }
  }

  if (!f) return <Loading />;
  return (
    <Screen>
      <Text style={styles.title}>Cuenta para transferencias</Text>
      <Text style={styles.muted}>Tus clientes te podrán pagar por transferencia directo a esta cuenta. El dinero te llega a ti; BÜBÜ no lo recibe. La comisión y la cuota de servicio se suman a tu saldo con BÜBÜ, igual que en efectivo.</Text>
      <Card>
        <Field icon="person-outline" label="Nombre del titular" value={f.holder} onChangeText={set('holder')} maxLength={80} placeholder="Como aparece en tu banco" />
        <Field icon="business-outline" label="Banco o app (opcional)" value={f.bank} onChangeText={set('bank')} maxLength={40} placeholder="Ej. BBVA, Banorte, Mercado Pago" />
        <Field icon="card-outline" label="CLABE, tarjeta o número de cuenta" value={f.account} onChangeText={set('account')} maxLength={40} keyboardType="number-pad" placeholder="18 dígitos de tu CLABE" />
        <Field icon="chatbox-outline" label="Nota para el cliente (opcional)" value={f.note} onChangeText={set('note')} maxLength={100} placeholder="Ej. Pon tu nombre en el concepto" />
        <Notice tone={msg.tone}>{msg.text}</Notice>
        <Button icon="save-outline" title="Guardar cuenta" onPress={save} loading={busy} />
        {f.saved && <Button title="Quitar cuenta" variant="outline" onPress={remove} disabled={busy} />}
      </Card>
      <Text style={styles.disclaimer}>Solo tú y el equipo de BÜBÜ ven esta cuenta aquí. Cada cliente la ve únicamente dentro de su propio pedido.</Text>
    </Screen>
  );
}
