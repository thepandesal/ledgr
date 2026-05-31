import React, { createContext, useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/auth';

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize session on app load
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setIsLoading(true);
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          // Store session token for persistence
          await SecureStore.setItemAsync(
            'auth_session',
            JSON.stringify(initialSession)
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
        setError(errorMessage);
        console.error('Session initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await SecureStore.setItemAsync(
          'auth_session',
          JSON.stringify(newSession)
        );
      } else {
        await SecureStore.deleteItemAsync('auth_session');
      }
      setError(null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: false,
        },
      });
      if (signInError) throw signInError;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(errorMessage);
      console.error('Google sign-in error:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          skipBrowserRedirect: false,
        },
      });
      if (signInError) throw signInError;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Apple sign-in failed';
      setError(errorMessage);
      console.error('Apple sign-in error:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          skipBrowserRedirect: false,
        },
      });
      if (signInError) throw signInError;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'GitHub sign-in failed';
      setError(errorMessage);
      console.error('GitHub sign-in error:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
      await SecureStore.deleteItemAsync('auth_session');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign-out failed';
      setError(errorMessage);
      console.error('Sign-out error:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isSigningIn,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
