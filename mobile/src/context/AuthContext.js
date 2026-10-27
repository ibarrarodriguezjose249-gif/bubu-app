// Estado de sesión compartido por toda la app:
// usuario de Firebase Auth + su perfil (users/{uid}) + su perfil de proveedor
// (providers/{uid}, si existe) + si es administrador (admins/{uid}).
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ensureUserProfile, setActiveMode } from '../services/users';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando
  const [profile, setProfile] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // UID para el que ya llegó la primera lectura del perfil (evita parpadeos).
  const [loadedFor, setLoadedFor] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProvider(null);
      setIsAdmin(false);
      setError(null);
      setLoadedFor(null);
      return undefined;
    }
    setError(null);
    const uid = user.uid;

    // Nota: aquí NO se crea el perfil automáticamente, para no chocar con el
    // registro (que lo crea con nombre y teléfono). Si falta, la app muestra
    // una pantalla con botón para completarlo (repairProfile).
    const unsubs = [
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoadedFor(uid);
        },
        (e) => { setError(e); setLoadedFor(uid); }
      ),
      onSnapshot(
        doc(db, 'providers', uid),
        (snap) => setProvider(snap.exists() ? { id: snap.id, ...snap.data() } : null),
        () => setProvider(null)
      ),
      // Las reglas permiten que cada usuario lea SOLO su propio documento de admins.
      onSnapshot(
        doc(db, 'admins', uid),
        (snap) => setIsAdmin(snap.exists()),
        () => setIsAdmin(false)
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const value = useMemo(() => {
    const mode = profile?.activeMode === 'provider' ? 'provider' : 'client';
    return {
      loading: user === undefined || (!!user && loadedFor !== user.uid),
      user: user || null,
      profile,
      provider,
      isAdmin,
      isApprovedProvider: provider?.status === 'approved',
      mode,
      error,
      switchMode: (next) => (user ? setActiveMode(user.uid, next) : Promise.resolve()),
      repairProfile: () => (user ? ensureUserProfile(user) : Promise.resolve()),
    };
  }, [user, profile, provider, isAdmin, loadedFor, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
