"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          throw error;
        }
        console.log('Session retrieved:', session ? 'Session exists' : 'No session');
        setSession(session);
        setUser(session?.user ?? null);
      } catch (e: any) {
        console.error('Error getting session:', e.message);
        setError(e.message || 'Failed to fetch session');
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (event === 'SIGNED_OUT') {
        // Clear any sensitive data or state
        setError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Error signing in:', error);
        throw error;
      }
      // Session will be updated by onAuthStateChange
    } catch (e: any) {
      console.error('Error signing in:', e.message);
      setError(e.message || 'An error occurred during sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      // Session will be updated by onAuthStateChange
    } catch (e: any) {
      console.error('Error signing out:', e.message);
      setError(e.message || 'An error occurred during sign out');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
