// Mapa (OpenStreetMap + Leaflet dentro de un WebView). Sin llaves ni cuentas.
//   mode="pin":    el usuario mueve un pin (ubicación del cliente).
//   mode="radius": pin + círculo con radio en km (zona de servicio del socio).
//   circles:       coberturas a mostrar de fondo (zonas con servicio).
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './brand';

let WebView = null;
try { WebView = require('react-native-webview').WebView; } catch (e) { WebView = null; }

const html = (init) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>html,body,#m{margin:0;height:100%;width:100%}.leaflet-control-attribution{font-size:9px}</style></head><body><div id="m"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var I=${JSON.stringify(init)};
var map=L.map('m',{zoomControl:true}).setView([I.lat,I.lng],I.zoom||13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
(I.circles||[]).forEach(function(c){L.circle([c.lat,c.lng],{radius:c.radiusKm*1000,color:'#00D1C1',weight:1,fillOpacity:.08}).addTo(map);});
var mk=L.marker([I.lat,I.lng],{draggable:true}).addTo(map);
var ci=I.mode==='radius'?L.circle([I.lat,I.lng],{radius:(I.radiusKm||3)*1000,color:'#0066FF',fillOpacity:.15}).addTo(map):null;
if(ci){map.fitBounds(ci.getBounds(),{padding:[20,20]});}
function send(){var p=mk.getLatLng();window.ReactNativeWebView.postMessage(JSON.stringify({lat:p.lat,lng:p.lng}));}
function move(ll){mk.setLatLng(ll);if(ci)ci.setLatLng(ll);send();}
mk.on('dragend',function(){move(mk.getLatLng());});
map.on('click',function(e){move(e.latlng);});
window.setRadius=function(km){if(ci){ci.setRadius(km*1000);map.fitBounds(ci.getBounds(),{padding:[20,20]});}};
window.setPoint=function(lat,lng){move(L.latLng(lat,lng));map.setView([lat,lng],Math.max(map.getZoom(),14));};
</script></body></html>`;

//   moveTo: { lat, lng } para mover el pin desde fuera (por ejemplo, con el GPS).
export default function MapPicker({ mode = 'pin', value, radiusKm = 3, circles = [], onChange, moveTo, height = 300 }) {
  const ref = useRef(null);
  // El HTML se arma una sola vez; después se mueve con setPoint/setRadius.
  const source = useMemo(() => ({
    html: html({ mode, lat: value?.lat, lng: value?.lng, radiusKm, circles, zoom: mode === 'pin' ? 15 : 12 }),
    baseUrl: 'https://bubu.app/',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ref.current?.injectJavaScript(`window.setRadius && window.setRadius(${Number(radiusKm) || 3}); true;`); }, [radiusKm]);
  useEffect(() => {
    if (moveTo && typeof moveTo.lat === 'number') ref.current?.injectJavaScript(`window.setPoint && window.setPoint(${moveTo.lat},${moveTo.lng}); true;`);
  }, [moveTo]);
  if (!WebView) return <View style={[s.box, { height }]} />;
  return (
    <View style={[s.box, { height }]}>
      <WebView ref={ref} source={source} originWhitelist={['*']} javaScriptEnabled
        onMessage={(e) => { try { const p = JSON.parse(e.nativeEvent.data); if (onChange) onChange(p); } catch (x) { /* nada */ } }} />
    </View>
  );
}

const s = StyleSheet.create({ box: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#E4E9F1', marginTop: 10 } });
