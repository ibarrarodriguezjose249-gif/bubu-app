// Zona de servicio del socio: su punto en el mapa + hasta cuántos km atiende.
// Se guarda aproximado (±100 m). Con esto le llegan solo pedidos que le quedan cerca.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Button, Card, Notice, Screen, styles } from '../../components/ui';
import MapPicker from '../../components/MapPicker';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { db } from '../../lib/firebase';
import { DEFAULT_CENTER, approxArea, coverageConfigured, zonesForArea } from '../../lib/geo';
import { getGpsPoint } from '../../lib/location';
import { friendlyError } from '../../lib/errors';

const STEPS = [1, 2, 3, 5, 8, 10, 15, 20];

export default function ServiceAreaScreen({ navigation }) {
  const { user, provider } = useAuth();
  const { zones } = useCatalog();
  const start = provider?.serviceArea || zones.find((z) => z.active && z.coverage)?.coverage || DEFAULT_CENTER;
  const [point, setPoint] = useState({ lat: start.lat, lng: start.lng });
  const [radius, setRadius] = useState(provider?.serviceArea?.radiusKm || 3);
  const [moveTo, setMoveTo] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ tone: 'info', text: '' });
  const area = approxArea(point, radius);
  const covered = zonesForArea(zones, area);
  const configured = coverageConfigured(zones);

  async function gps() {
    setBusy('gps'); setMsg({ tone: 'info', text: '' });
    try { const p = await getGpsPoint(); setPoint(p); setMoveTo(p); } catch (e) { setMsg({ tone: 'error', text: e.message }); } finally { setBusy(''); }
  }
  async function save() {
    setBusy('save'); setMsg({ tone: 'info', text: '' });
    try {
      const data = { serviceArea: area, updatedAt: serverTimestamp() };
      if (covered.length) data.zoneIds = covered.slice(0, 5).map((z) => z.id);
      await updateDoc(doc(db, 'providers', user.uid), data);
      setMsg(covered.length || !configured
        ? { tone: 'success', text: 'Zona guardada. Te llegarán los pedidos dentro de tu círculo.' }
        : { tone: 'warn', text: 'Zona guardada, pero ahí todavía no hay cobertura de BÜBÜ. Te avisaremos cuando lleguemos.' });
    } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); } finally { setBusy(''); }
  }

  return (
    <Screen>
      <Text style={styles.title}>Mi zona de servicio</Text>
      <Text style={styles.muted}>Mueve el pin a tu local (o donde trabajas) y elige hasta cuántos kilómetros das servicio. Los clientes no ven tu domicilio exacto.</Text>
      <Button icon="locate-outline" title="Usar mi ubicación" variant="soft" onPress={gps} loading={busy === 'gps'} />
      <MapPicker mode="radius" value={point} radiusKm={radius} moveTo={moveTo} height={340}
        circles={zones.filter((z) => z.active && z.coverage).map((z) => z.coverage)} onChange={setPoint} />
      <Text style={[styles.label, { marginTop: 14 }]}>Radio de servicio: {radius} km</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {STEPS.map((k) => <Button key={k} title={`${k} km`} variant={k === radius ? 'primary' : 'outline'} onPress={() => setRadius(k)} style={{ minWidth: 70 }} />)}
      </View>
      <Card>
        {configured && covered.length > 0 && <Text style={styles.muted}>Con cobertura en: {covered.map((z) => z.name).join(', ')}.</Text>}
        {configured && covered.length === 0 && <Notice tone="warn">Tu zona todavía no tiene cobertura de BÜBÜ. Puedes guardarla igual; te avisaremos cuando lleguemos.</Notice>}
        <Notice tone={msg.tone}>{msg.text}</Notice>
        <Button icon="save-outline" title="Guardar mi zona" onPress={save} loading={busy === 'save'} />
      </Card>
    </Screen>
  );
}
