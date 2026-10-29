// Configura cuál de las dos apps se construye o publica (mismo código):
//   APP_VARIANT=clientes → BÜBÜ            (com.joseibarra.bubu)
//   APP_VARIANT=socios   → BÜBÜ Socios     (com.joseibarra.bubu.socios)
//   sin variable         → versión completa con ambos modos (Snack / pruebas)
// Parte de app.json y solo cambia lo necesario.
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT === 'socios' || process.env.APP_VARIANT === 'clientes'
    ? process.env.APP_VARIANT
    : 'completa';
  const extra = { ...(config.extra || {}), appVariant: variant };

  if (variant !== 'socios') return { ...config, extra };

  return {
    ...config,
    name: 'BÜBÜ Socios',
    scheme: 'bubusocios',
    icon: './assets/icon-socios.png',
    ios: { ...config.ios, bundleIdentifier: 'com.joseibarra.bubu.socios' },
    android: {
      ...config.android,
      package: 'com.joseibarra.bubu.socios',
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon-socios.png', backgroundColor: '#0066FF' },
    },
    // Las actualizaciones automáticas de Socios van por su propio canal.
    updates: { ...config.updates, requestHeaders: { 'expo-channel-name': 'socios' } },
    extra,
  };
};
