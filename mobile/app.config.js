// Configura cuál de las dos apps se construye o publica (mismo código):
//   APP_VARIANT=clientes → BÜBÜ            (com.joseibarra.bubu)
//   APP_VARIANT=socios   → BÜBÜ Socios     (com.joseibarra.bubu.socios)
//   sin variable         → versión completa con ambos modos (Snack / pruebas)
// Parte de app.json y solo cambia lo necesario.
const fs = require('fs');
const path = require('path');

// google-services.json (de la consola de Firebase) activa las notificaciones push
// en Android. Si todavía no está en el repositorio, el APK se construye igual
// (suena con la app abierta, pero no llegan avisos con la app cerrada).
// Ojo: ese archivo NO es la llave privada de la cuenta de servicio; esa nunca va aquí.
const GOOGLE_SERVICES = './google-services.json';
const hasGoogleServices = fs.existsSync(path.join(__dirname, GOOGLE_SERVICES));

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT === 'socios' || process.env.APP_VARIANT === 'clientes'
    ? process.env.APP_VARIANT
    : 'completa';
  const extra = { ...(config.extra || {}), appVariant: variant };
  const android = { ...config.android, ...(hasGoogleServices ? { googleServicesFile: GOOGLE_SERVICES } : {}) };

  if (variant !== 'socios') return { ...config, android, extra };

  return {
    ...config,
    name: 'BÜBÜ Socios',
    scheme: 'bubusocios',
    icon: './assets/icon-socios.png',
    ios: { ...config.ios, bundleIdentifier: 'com.joseibarra.bubu.socios' },
    android: {
      ...android,
      package: 'com.joseibarra.bubu.socios',
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon-socios.png', backgroundColor: '#0066FF' },
    },
    // Las actualizaciones automáticas de Socios van por su propio canal.
    updates: { ...config.updates, requestHeaders: { 'expo-channel-name': 'socios' } },
    extra,
  };
};
