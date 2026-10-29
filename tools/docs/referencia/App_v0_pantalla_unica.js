import React, { useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, Pressable, StyleSheet, StatusBar } from 'react-native';

const services = [
  { icon: '🧺', title: 'Lavandería', subtitle: 'Lavado, doblado y recolección' },
  { icon: '🧽', title: 'Limpieza', subtitle: 'Servicios para el hogar' },
  { icon: '🛠️', title: 'Reparaciones', subtitle: 'Ayuda con arreglos' },
  { icon: '🌿', title: 'Jardinería', subtitle: 'Cuidado de patios y jardines' },
];

export default function App() {
  const [mode, setMode] = useState('cliente');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const filtered = services.filter(s => (s.title + ' ' + s.subtitle).toLowerCase().includes(search.toLowerCase()));
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <View style={styles.nav}><Text style={styles.logo}>BÜBÜ<Text style={styles.dot}>.</Text></Text><Text style={styles.location}>📍 General Zuazua, NL</Text></View>
          <Text style={styles.eyebrow}>SERVICIOS LOCALES, MÁS FÁCILES</Text>
          <Text style={styles.heading}>Lo que necesitas, cerca de ti.</Text>
          <Text style={styles.intro}>Encuentra servicios de confianza en tu zona. Comenzamos con lavanderías.</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Buscar un servicio..." placeholderTextColor="#6e7b91" style={styles.search} />
        </View>
        <View style={styles.content}>
          <View style={styles.modeRow}>
            <Text style={styles.section}>¿Qué necesitas hoy?</Text>
            <Pressable onPress={() => { setMode(mode === 'cliente' ? 'proveedor' : 'cliente'); setNotice(''); }} style={styles.modeButton}><Text style={styles.modeText}>{mode === 'cliente' ? 'Soy proveedor' : 'Soy cliente'}</Text></Pressable>
          </View>
          <Text style={styles.muted}>{mode === 'cliente' ? 'Explora categorías disponibles' : 'Modo proveedor de demostración'}</Text>
          {mode === 'cliente' ? filtered.map(s => <Pressable key={s.title} onPress={() => setNotice(`Elegiste ${s.title}. En la siguiente etapa conectaremos proveedores reales.`)} style={styles.service}><Text style={styles.serviceIcon}>{s.icon}</Text><View style={{flex:1}}><Text style={styles.serviceTitle}>{s.title}</Text><Text style={styles.serviceSub}>{s.subtitle}</Text></View><Text style={styles.arrow}>›</Text></Pressable>) : <View style={styles.panel}><Text style={styles.serviceTitle}>Ofrece tus servicios en BÜBÜ</Text><Text style={styles.serviceSub}>El registro real deberá incluir datos de contacto, verificación de identidad y aprobación del equipo BÜBÜ.</Text><Pressable style={styles.primary} onPress={() => setNotice('Formulario de proveedor pendiente de conectar al servidor.') }><Text style={styles.primaryText}>Comenzar registro</Text></Pressable></View>}
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          <View style={styles.panel}><Text style={styles.section}>¿No encuentras lo que buscas?</Text><Text style={styles.serviceSub}>Próximamente podrás publicar una solicitud y recibir respuestas de proveedores de tu zona.</Text><Pressable style={styles.primary} onPress={() => setNotice('La publicación de solicitudes se implementará al conectar la API.') }><Text style={styles.primaryText}>Publicar solicitud</Text></Pressable></View>
          <Text style={styles.disclaimer}>Versión de desarrollo: no hay cuentas, reservas ni pagos reales todavía.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#f4f7fc'},page:{paddingBottom:32},hero:{backgroundColor:'#1769ff',paddingHorizontal:22,paddingTop:24,paddingBottom:30,borderBottomLeftRadius:28,borderBottomRightRadius:28},nav:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:35},logo:{fontSize:28,fontWeight:'900',color:'#fff',letterSpacing:-1},dot:{color:'#9ffaff'},location:{fontSize:11,color:'#fff',backgroundColor:'#ffffff25',padding:8,borderRadius:20},eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.4,color:'#d8efff'},heading:{fontSize:38,lineHeight:43,fontWeight:'900',color:'#fff',marginTop:10},intro:{fontSize:15,lineHeight:22,color:'#e3f1ff',marginTop:10,marginBottom:18},search:{backgroundColor:'#fff',borderRadius:13,paddingHorizontal:15,paddingVertical:13,fontSize:15,color:'#13233d'},content:{paddingHorizontal:18,paddingTop:22},modeRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},section:{fontSize:19,fontWeight:'850',color:'#13233d'},modeButton:{padding:9,borderRadius:10,backgroundColor:'#e5efff'},modeText:{fontSize:12,color:'#1769ff',fontWeight:'800'},muted:{fontSize:13,color:'#6e7b91',marginTop:5,marginBottom:14},service:{backgroundColor:'#fff',borderRadius:16,padding:15,marginBottom:10,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:'#e5ebf4'},serviceIcon:{fontSize:25,backgroundColor:'#eaf2ff',padding:10,borderRadius:13,overflow:'hidden'},serviceTitle:{fontSize:15,fontWeight:'800',color:'#13233d'},serviceSub:{fontSize:12,color:'#6e7b91',lineHeight:18,marginTop:4},arrow:{fontSize:26,color:'#1769ff'},panel:{backgroundColor:'#fff',padding:18,borderRadius:17,borderWidth:1,borderColor:'#e5ebf4',marginTop:18},primary:{backgroundColor:'#1769ff',padding:13,borderRadius:12,alignItems:'center',marginTop:14},primaryText:{color:'#fff',fontWeight:'800'},notice:{backgroundColor:'#e1f9ed',color:'#126748',padding:12,borderRadius:11,marginTop:12,fontSize:13,lineHeight:18},disclaimer:{fontSize:11,color:'#8793a5',textAlign:'center',marginTop:25,lineHeight:17}});
