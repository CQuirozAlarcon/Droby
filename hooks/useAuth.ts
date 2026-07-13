import { useEffect, useState, createContext, useContext } from 'react';
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

// El JWT de Supabase es un token en 3 partes separadas por ".".
// La parte central (payload) está en base64url y contiene los claims,
// incluido "user_role" inyectado por el Auth Hook (custom_access_token_hook).
function decodificarRolDesdeJWT(accessToken: string | undefined): Rol | null {
  if (!accessToken) return null;
  try {
    const payloadBase64 = accessToken.split('.')[1];
    const payloadJson = decodeURIComponent(
      atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const payload = JSON.parse(payloadJson);
    return (payload.user_role as Rol) ?? null;
  } catch {
    return null;
  }
}

export function useAuthState(): AuthContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setRol(decodificarRolDesdeJWT(data.session?.access_token));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setRol(decodificarRolDesdeJWT(newSession?.access_token));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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
