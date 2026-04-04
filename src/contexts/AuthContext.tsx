import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  authProvider: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be inside AuthProvider');
  return ctx;
};

/** Upsert user record in users table after login */
const upsertUserRecord = async (user: User) => {
  const email = user.email || user.user_metadata?.email || null;
  const provider = user.app_metadata?.provider || 'email';

  const { error } = await supabase.from('users').upsert({
    anonymous_id: user.id,
    email,
    auth_provider: provider,
    platform: 'ios',
    app_version: '0.8.8',
    last_active_at: new Date().toISOString(),
  }, { onConflict: 'anonymous_id' });

  if (error) {
    console.error('[GoSavor] Upsert user error:', error.message);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session — sign out anonymous users
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      const u = s?.user;
      if (u && (u.is_anonymous === true || (!u.email && !u.user_metadata?.email))) {
        // Clear old anonymous session
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(u ?? null);
        if (u) upsertUserRecord(u);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) upsertUserRecord(s.user);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signInWithApple = useCallback(async () => {
    // Check if running on native iOS (Capacitor)
    const isNative = typeof (window as any).Capacitor !== 'undefined';

    if (isNative) {
      // Apple Sign In — 等 Apple Developer Program 審核通過後啟用
      throw new Error('Apple Sign In 尚未啟用，請使用 Email 登入');
    } else {
      // PWA: use Supabase OAuth redirect
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(error.message);
  }, []);

  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  // Anonymous users (no email) are NOT considered authenticated
  const userEmail = user?.email || user?.user_metadata?.email || null;
  const isAnonymous = user?.is_anonymous === true || (!userEmail && !!user);
  const isAuthenticated = !!session && !!user && !isAnonymous;
  const authProvider = user?.app_metadata?.provider || null;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated,
      isLoading,
      userEmail,
      authProvider,
      signInWithEmail,
      signUpWithEmail,
      signInWithApple,
      resetPassword,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
