import React, { useState } from 'react';
import { Loader2, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OneHubLogo } from './OneHubLogo';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'signup';
  reasonMessage?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'login',
  reasonMessage,
  onClose,
  onSuccess,
}) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    authActionLoading,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setLocalError(null);
    clearAuthError();
  };

  const handleGoogle = async () => {
    setLocalError(null);
    const ok = await signInWithGoogle();
    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      const cleanName = displayName.trim();
      if (cleanName.length < 1) {
        setLocalError('Please enter your name.');
        return;
      }
      const ok = await signUpWithEmail({
        email: cleanEmail,
        password,
        displayName: cleanName,
      });
      if (ok) {
        onSuccess?.();
        onClose();
      }
    } else {
      const ok = await signInWithEmail({ email: cleanEmail, password });
      if (ok) {
        onSuccess?.();
        onClose();
      }
    }
  };

  const errorBanner = localError || authError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signup' ? 'Create your ONEHUB account' : 'Sign in to ONEHUB'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-[#E7EAF3] bg-[#FFFFFF] p-6 pb-8 shadow-2xl sm:rounded-3xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E7EAF3] sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <OneHubLogo compact />
            <h2 className="mt-3 text-xl font-bold text-[#111827]">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#687386]">
              {reasonMessage ||
                'Connect, create, and discover with your personal ONEHUB profile.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* One-Tap Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={authActionLoading}
          className="mt-5 flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] shadow-[0_2px_8px_rgba(17,24,39,0.04)] transition-all hover:border-[#5366FF]/45 hover:bg-[#F7F8FC] active:scale-[0.99] disabled:opacity-55"
        >
          {authActionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#5366FF]" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E7EAF3]" />
          <span className="text-[11px] font-medium text-[#687386]">or with email</span>
          <div className="h-px flex-1 bg-[#E7EAF3]" />
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all ${
              mode === 'login'
                ? 'bg-[#FFFFFF] text-[#111827] shadow-sm'
                : 'text-[#687386] hover:text-[#111827]'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all ${
              mode === 'signup'
                ? 'bg-[#FFFFFF] text-[#111827] shadow-sm'
                : 'text-[#687386] hover:text-[#111827]'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="mb-1 block text-xs font-medium text-[#111827]">
                Full name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687386]" />
                <input
                  id="auth-name"
                  type="text"
                  maxLength={60}
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] pl-10 pr-3.5 text-sm text-[#111827] placeholder:text-[#687386]/75 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-medium text-[#111827]">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687386]" />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] pl-10 pr-3.5 text-sm text-[#111827] placeholder:text-[#687386]/75 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-medium text-[#111827]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687386]" />
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] pl-10 pr-3.5 text-sm text-[#111827] placeholder:text-[#687386]/75 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>
          </div>

          {errorBanner && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-700"
            >
              {errorBanner}
            </div>
          )}

          <button
            type="submit"
            disabled={authActionLoading}
            className="elegance-gradient flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-[0.99] disabled:opacity-55"
          >
            {authActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{mode === 'signup' ? 'Create Account' : 'Log In'}</span>
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#687386]">
          Your email stays private and is never shown on your public profile.
        </p>
      </div>
    </div>
  );
};
