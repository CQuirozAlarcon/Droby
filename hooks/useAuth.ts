import { useEffect, useState, createContext, useContext, useCallback } from 'react';
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

// El rol se consulta directamente de la tabla public.user_roles usando el
// user_id de la sesión, en vez de depender del claim "user_role" inyectado
// por el Auth Hook en el JWT. Esto evita que la app dependa de un paso manual
// (activar el hook en el Dashboard de Supabase) que es fácil de olvidar y que,
// si no está activo, dejaba a TODOS los usuarios (incluido el admin) sin rol.
async function obtenerRolDesdeTabla(userId: string | undefined): Promise<Rol | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return 'empleado'; // por defecto, el más restrictivo
  return data.role as Rol;
}

export function useAuthState(): AuthContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarRol = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    const r = await obtenerRolDesdeTabla(currentSession?.user.id);
    setRol(r);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await cargarRol(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      cargarRol(newSession);
    });

    return () => listener.subscription.unsubscribe();
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
