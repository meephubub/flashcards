'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          return;
        }
        
        if (session) {
          const redirectTo = searchParams.get('redirectedFrom') || '/';
          // Use replace instead of push to prevent going back to login
          window.location.replace(redirectTo);
          return;
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsCheckingSession(false);
        setMounted(true);
      }
    };

    checkSession();
  }, [searchParams, supabase.auth]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Redirect to the original page or home
      const redirectTo = searchParams.get('redirectedFrom') || '/';
      router.replace(redirectTo);
      router.refresh();
    } catch (error: any) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectTo = searchParams.get('redirectedFrom') || '/';
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      
      if (data.user && data.user.identities?.length === 0) {
        // This case might indicate an existing user with unconfirmed email
        setMessage('User already exists. If you haven\'t confirmed your email, please check your inbox.');
        setError('User already exists or email needs confirmation.');
        return;
      }
      
      if (data.session) {
        // User is signed up and logged in (email confirmation is disabled)
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      
      // If we get here, user needs to confirm their email
      setMessage('Sign up successful! Please check your email to confirm your account.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
      // Auto-switch to login mode after a delay
      setTimeout(() => {
        setIsSignUpMode(false);
      }, 5000);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'An error occurred during sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUpMode(!isSignUpMode);
    setError(null);
    setMessage(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  // Show loading state while checking session
  if (isCheckingSession || !mounted) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>{isSignUpMode ? 'Create Account' : 'Welcome Back'}</h1>
          <p className={styles.subtitle}>
            {isSignUpMode 
              ? 'Create an account to get started' 
              : 'Sign in to continue to your account'}
          </p>
        </div>
        
        <form onSubmit={isSignUpMode ? handleSignUp : handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className={styles.input}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <div className={styles.labelContainer}>
              <label htmlFor="password" className={styles.label}>Password</label>
              {!isSignUpMode && (
                <Link href="/forgot-password" className={styles.forgotPassword}>
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              minLength={isSignUpMode ? 6 : undefined}
              className={styles.input}
              placeholder="••••••••"
              autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
            />
            {isSignUpMode && (
              <p className={styles.hintText}>Must be at least 6 characters</p>
            )}
          </div>
          
          {isSignUpMode && (
            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
                className={styles.input}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          )}
          
          {error && (
            <div className={styles.errorContainer}>
              <AlertTriangle size={16} className={styles.errorIcon} />
              <span className={styles.errorText}>{error}</span>
            </div>
          )}
          
          {message && (
            <div className={styles.messageContainer}>
              <span className={styles.messageText}>{message}</span>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={isLoading} 
            className={`${styles.button} ${isLoading ? styles.buttonLoading : ''}`}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {isSignUpMode ? 'Creating Account...' : 'Signing in...'}
              </>
            ) : (
              isSignUpMode ? 'Create Account' : 'Sign In'
            )}
          </button>
          
          <div className={styles.divider}>
            <span className={styles.dividerText}>OR</span>
          </div>
          
          <div className={styles.socialButtons}>
            <button type="button" className={styles.socialButton} disabled={isLoading}>
              <svg width="20" height="20" viewBox="0 0 24 24" className={styles.socialIcon}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </form>
        
        <p className={styles.footerText}>
          {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}
          <button 
            type="button" 
            onClick={toggleMode} 
            className={styles.toggleLink}
            disabled={isLoading}
          >
            {isSignUpMode ? ' Sign in' : ' Sign up'}
          </button>
        </p>
        
        <div className={styles.legalText}>
          By {isSignUpMode ? 'creating an account' : 'signing in'}, you agree to our
          <a href="/terms" className={styles.legalLink}> Terms of Service</a> and
          <a href="/privacy" className={styles.legalLink}> Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
