import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  auth,
  extractReadableError,
  googleProvider,
  testConnection,
  type ConnectionCheckStatus,
} from '../lib/firebase';
import { activeDataAdapter } from '../services/dataAdapter';
import type { PublicCreatorProfile, UserPrivateProfile } from '../types/onehub';

interface AuthContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  privateProfile: UserPrivateProfile | null;
  publicProfile: PublicCreatorProfile | null;
  profileLoading: boolean;
  needsOnboarding: boolean;
  connectionStatus: ConnectionCheckStatus;
  authActionLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  signUpWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<boolean>;
  signInWithEmail: (params: { email: string; password: string }) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshAuthUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing.';
    case 'auth/popup-blocked':
      return 'Pop-up was blocked by your browser. Please allow pop-ups for ONEHUB and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication settings yet.';
    case 'auth/operation-not-allowed':
      return 'Email & Password sign-in is not enabled yet in Firebase Console (Authentication → Sign-in method).';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your credentials and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment before trying again.';
    case 'auth/network-request-failed':
      return 'Network error while reaching Firebase Auth. Check your connection.';
    default:
      return extractReadableError(error, 'Authentication failed. Please try again.');
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [privateProfile, setPrivateProfile] = useState<UserPrivateProfile | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicCreatorProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionCheckStatus>('checking');
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfilesForUser = useCallback(async (user: User | null) => {
    if (!user) {
      setPrivateProfile(null);
      setPublicProfile(null);
      setProfileChecked(true);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    try {
      const [priv, pub] = await Promise.all([
        activeDataAdapter.fetchUserPrivate(user.uid),
        activeDataAdapter.fetchPublicProfile(user.uid),
      ]);
      setPrivateProfile(priv);
      setPublicProfile(pub);
    } catch (error) {
      // Do not fabricate a profile on permission or offline error
      console.error('Failed loading user profile:', error);
      setPrivateProfile(null);
      setPublicProfile(null);
    } finally {
      setProfileChecked(true);
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    void testConnection().then((status) => {
      setConnectionStatus(status);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      void loadProfilesForUser(user);
    });

    return () => unsubscribe();
  }, [loadProfilesForUser]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(result.user);
      await loadProfilesForUser(result.user);
      return true;
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
      return false;
    } finally {
      setAuthActionLoading(false);
    }
  }, [loadProfilesForUser]);

  const signUpWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
    }): Promise<boolean> => {
      setAuthActionLoading(true);
      setAuthError(null);
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          params.email.trim(),
          params.password
        );
        const cleanName = params.displayName.trim().slice(0, 60);
        if (cleanName) {
          await updateProfile(credential.user, { displayName: cleanName });
        }
        try {
          await sendEmailVerification(credential.user);
        } catch {
          // Verification email sending may throttle on repeat attempts
        }
        setFirebaseUser(credential.user);
        await loadProfilesForUser(credential.user);
        return true;
      } catch (error) {
        setAuthError(formatFirebaseAuthError(error));
        return false;
      } finally {
        setAuthActionLoading(false);
      }
    },
    [loadProfilesForUser]
  );

  const signInWithEmail = useCallback(
    async (params: { email: string; password: string }): Promise<boolean> => {
      setAuthActionLoading(true);
      setAuthError(null);
      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          params.email.trim(),
          params.password
        );
        setFirebaseUser(credential.user);
        await loadProfilesForUser(credential.user);
        return true;
      } catch (error) {
        setAuthError(formatFirebaseAuthError(error));
        return false;
      } finally {
        setAuthActionLoading(false);
      }
    },
    [loadProfilesForUser]
  );

  const resendVerificationEmail = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
      return false;
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const refreshAuthUser = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setFirebaseUser(refreshed);
      await loadProfilesForUser(refreshed);
      return Boolean(refreshed?.emailVerified);
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
      return false;
    } finally {
      setAuthActionLoading(false);
    }
  }, [loadProfilesForUser]);

  const logout = useCallback(async () => {
    setAuthActionLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setPrivateProfile(null);
      setPublicProfile(null);
    } catch (error) {
      setAuthError(formatFirebaseAuthError(error));
    } finally {
      setAuthActionLoading(false);
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    await loadProfilesForUser(auth.currentUser);
  }, [loadProfilesForUser]);

  const needsOnboarding = Boolean(
    authReady &&
      firebaseUser &&
      firebaseUser.emailVerified &&
      profileChecked &&
      !profileLoading &&
      (!privateProfile || !publicProfile)
  );

  return (
    <AuthContext.Provider
      value={{
        authReady,
        firebaseUser,
        privateProfile,
        publicProfile,
        profileLoading,
        needsOnboarding,
        connectionStatus,
        authActionLoading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        resendVerificationEmail,
        refreshAuthUser,
        logout,
        refreshProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
