// Identidad de marca. Cambia el nombre aquí y se actualiza en toda la app.
export const BRAND_NAME = 'BÜBÜ';
export const BRAND_SLOGAN = 'Tu comunidad, tus servicios';
export const LAUNCH_ZONE_LABEL = 'General Zuazua, N.L.';

// Paleta oficial (actualización de diseño v0.3):
// Azul eléctrico #0066FF (principal), Turquesa #00D1C1 (secundario),
// Blanco #FFFFFF (fondo), Azul oscuro #0B2E5B (textos), Gris claro #E5E7EB (bordes).
export const colors = {
  blue: '#0066FF',
  blueDark: '#0052CC',
  turquoise: '#00D1C1',
  turquoiseSoft: '#CCF6F2',
  white: '#FFFFFF',
  ink: '#0B2E5B',          // textos importantes
  muted: '#5B6B82',        // texto secundario (contraste AA sobre blanco)
  bg: '#FFFFFF',           // fondo principal
  surface: '#F5F8FC',      // zonas suaves (secciones, chips)
  border: '#E5E7EB',
  blueSoft: '#EAF2FF',
  successBg: '#E3F8EE',
  successText: '#0E7A4B',
  success: '#12B76A',
  warnBg: '#FFF6DD',
  warnText: '#7A5600',
  errorBg: '#FFECEC',
  errorText: '#B42318',
  navy: '#0B2E5B',
};

// Tipografía Montserrat (paquete @expo-google-fonts/montserrat).
// Cada grosor es una familia distinta: así se ve igual en Android, iPhone y web.
export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extra: 'Montserrat_800ExtraBold',
  black: 'Montserrat_900Black',
};

// Sombra suave para tarjetas sobre fondo blanco.
export const shadow = {
  shadowColor: '#0B2E5B',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
