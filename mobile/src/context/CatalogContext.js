// Categorías y zonas, escuchadas en tiempo real desde Firestore.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeCategories, subscribeZones } from '../services/catalog';

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let pending = 2;
    const done = () => { pending -= 1; if (pending <= 0) setLoading(false); };
    const onErr = (e) => { setError(e); setLoading(false); };
    const u1 = subscribeCategories((list) => { setCategories(list); done(); }, onErr);
    const u2 = subscribeZones((list) => { setZones(list); done(); }, onErr);
    return () => { u1(); u2(); };
  }, []);

  const value = useMemo(() => ({
    categories,
    activeCategories: categories.filter((c) => c.active),
    zones,
    activeZones: zones.filter((z) => z.active),
    loading,
    error,
    categoryById: (id) => categories.find((c) => c.id === id),
    zoneById: (id) => zones.find((z) => z.id === id),
  }), [categories, zones, loading, error]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <CatalogProvider>');
  return ctx;
}
