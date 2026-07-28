/**
 * Login Page - Google sign-in
 * On mobile PWA: opens login in external browser (only reliable method)
 * On desktop/mobile browser: uses popup
 */
import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setError('Popup blocked. Tap "Open in Browser" below to sign in.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('');
      } else {
        setError(err.message || 'Login failed.');
      }
      setLoading(false);
    }
  };

  // Detect if running as installed PWA
  const isPWA = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);

  return (
    <div className="min-h-[100dvh] bg-bb-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
        <img src="/logo-gold.png" alt="Bluebell" className="h-14 mx-auto mb-4 object-contain" />
        <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome to Bluebell</h1>
        <p className="text-sm text-gray-500 mb-8">Event Planners LLP</p>

        {!isPWA ? (
          /* Normal browser - popup works */
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </span>
          </button>
        ) : (
          /* PWA standalone mode - must open in browser */
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              To sign in, open this app in your browser first:
            </p>
            <a
              href="https://bluebell-event.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-bb-accent text-white rounded-xl font-medium cursor-pointer"
            >
              Open in Browser to Sign In
            </a>
            <p className="text-xs text-gray-400">
              Sign in once in the browser, then come back to this app — you'll stay logged in.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
      </div>
    </div>
  );
}
