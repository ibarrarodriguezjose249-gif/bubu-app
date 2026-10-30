// "¿Dónde estás?": GPS o pin en el mapa. Revisa si hay cobertura.
// Solo se guarda una ubicación APROXIMADA (~1 km) en el pedido.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Notice, styles } from './ui';
import MapPicker from './MapPicker';
import { useCatalog } from '../context/CatalogContext';
import { DEFAULT_CENTER, coverageConfigured, zoneForPoint } from '../lib/geo';
import { getGpsPoint, loadLastPoint, saveLastPoint } from '../lib/location';

// onResult({ point, zone, covered, configured })
export default function LocationField({ uid, onResult }) {
  const { zones } = useCatalog();
  const configured = coverageConfigured(zones);
  const [point, setPoint] = useState(null);
  const [moveTo, setMoveTo] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (uid) loadLastPoint(uid).then((p) => { if (p) setPoint(p); }); }, [uid]);
  const zone = zoneForPoint(zones, point);
  useEffect(() => {
    if (onResult) onResult({ point, zone, covered: !configured || !!zone, configured });
  }, [point?.lat, point?.lng, zone?.id, configured]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(p) { setPoint(p); if (uid) saveLastPoint(uid, p); }
  async function gps() {
    setBusy(true); setErr('');
    try { const p = await getGpsPoint(); choose(p); setMoveTo(p); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (!configured) return null; // el admin aún no dibuja la cobertura: se pide como antes
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>¿Dónde estás?</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button icon="locate-outline" title="Usar mi ubicación" variant="soft" onPress={gps} loading={busy} style={{ flex: 1 }} />
        <Button icon="map-outline" title={showMap ? 'Ocultar mapa' : 'Elegir en el mapa'} variant="outline" onPress={() => setShowMap((v) => !v)} style={{ flex: 1 }} />
      </View>
      {showMap && (
        <MapPicker mode="pin" value={point || zones.find((z) => z.coverage)?.coverage || DEFAULT_CENTER} moveTo={moveTo}
          circles={zones.filter((z) => z.active && z.coverage).map((z) => z.coverage)} onChange={choose} />
      )}
      <Notice tone="error">{err}</Notice>
      {point && zone && <Notice tone="success">Hay servicio en tu zona ({zone.name}). A las lavanderías solo les llega tu ubicación aproximada.</Notice>}
      {point && !zone && <Notice tone="warn">Aún no llegamos a tu colonia o ciudad. ¡Pronto estaremos ahí! Si estás en otro lugar, mueve el pin.</Notice>}
      {!point && <Text style={styles.muted}>Lo usamos para encontrar lavanderías cerca de ti.</Text>}
    </View>
  );
}
