import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Rol } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  rol: Rol | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  rol: null,
  loading: true,
  signIn: async () => ({ error: 'no-provider' }),
  signOut: async () => {},
});

async function obtenerRolDesdeTabla(userId: string | undefined): Promise<Rol | null> {
  if (!userId) return null;
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  if (error) {
    // fail-closed: ante un error transitorio tratamos al usuario como empleado,
    // pero lo registramos para que no sea un downgrade silencioso
    console.warn('No se pudo obtener el rol del usuario, usando "empleado":', error.message);
    return 'empleado';
  }
  if (!data) return 'empleado';
  return data.role as Rol;
}

export function useAuthState(): AuthContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);
  // guarda de orden: si dos eventos de auth resuelven fuera de orden,
  // solo el rol del evento más reciente llega al estado
  const rolRequestRef = useRef(0);

  const cargarRol = useCallback(async (currentSession: Session | null) => {
    const requestId = ++rolRequestRef.current;
    setSession(currentSession);
    const r = await obtenerRolDesdeTabla(currentSession?.user.id);
    if (requestId === rolRequestRef.current) setRol(r);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (mounted) await cargarRol(data.session);
      })
      .catch((e) => {
        // sin esto, un fallo de red/storage dejaba la app eternamente en el spinner
        console.warn('No se pudo recuperar la sesión:', e?.message ?? e);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // se difiere el trabajo async: supabase-js advierte que llamar a sus
      // propias APIs dentro de este callback puede bloquear el lock de sesión
      setTimeout(() => {
        if (mounted) cargarRol(newSession);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [cargarRol]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, rol, loading, signIn, signOut };
}

export function useAuth() {
  return useContext(AuthContext);
}
