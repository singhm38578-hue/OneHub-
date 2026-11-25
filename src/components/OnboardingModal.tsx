import React, { useEffect, useState } from 'react';
import { AtSign, Check, Globe, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { extractReadableError } from '../lib/firebase';
import {
  activeDataAdapter,
  isValidHandleFormat,
  normalizeHandle,
} from '../services/dataAdapter';
import { ONEHUB_LANGUAGES, ONEHUB_TOPICS } from '../types/onehub';

interface OnboardingModalProps {
  open: boolean;
  onCompleted: () => void;
}

function buildDefaultHandle(displayName?: string | null, email?: string | null, uid?: string): string {
  const base =
    normalizeHandle(displayName || (email ? email.split('@')[0] : '') || 'creator') ||
    'creator';
  const suffix = (uid || '100').slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, '0');
  return `${base.slice(0, 24)}_${suffix}`.slice(0, 32);
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  onCompleted,
}) => {
  const { firebaseUser, refreshProfiles } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [language, setLanguage] = useState('en');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Design',
    'Technology',
  ]);
  const [handleStatus, setHandleStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !firebaseUser) return;
    const initialName =
      firebaseUser.displayName ||
      (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'ONEHUB Member');
    setDisplayName(initialName.slice(0, 60));
    setHandle(buildDefaultHandle(firebaseUser.displayName, firebaseUser.email, firebaseUser.uid));
    setErrorMsg(null);
  }, [open, firebaseUser]);

  useEffect(() => {
    if (!open || !firebaseUser) return;
    const clean = normalizeHandle(handle);
    if (!isValidHandleFormat(clean)) {
      setHandleStatus('invalid');
      return;
    }

    let cancelled = false;
    setHandleStatus('checking');
    const timer = window.setTimeout(async () => {
      try {
        const available = await activeDataAdapter.isHandleAvailable(
          clean,
          firebaseUser.uid
        );
        if (!cancelled) {
          setHandleStatus(available ? 'available' : 'taken');
        }
      } catch {
        if (!cancelled) setHandleStatus('idle');
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handle, open, firebaseUser]);

  if (!open || !firebaseUser) return null;

  const toggleInterest = (topic: string) => {
    setSelectedInterests((prev) =>
      prev.includes(topic)
        ? prev.filter((item) => item !== topic)
        : prev.length < 10
        ? [...prev, topic]
        : prev
    );
  };

  const submitProfile = async (skipped: boolean) => {
    if (!firebaseUser) return;
    setSubmitting(true);
    setErrorMsg(null);

    const targetHandle = skipped
      ? buildDefaultHandle(firebaseUser.displayName, firebaseUser.email, firebaseUser.uid)
      : normalizeHandle(handle);

    if (!isValidHandleFormat(targetHandle)) {
      setErrorMsg('Username must be 2–32 characters (lowercase letters, numbers, underscores).');
      setSubmitting(false);
      return;
    }

    try {
      await activeDataAdapter.createUserProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email || `${firebaseUser.uid}@onehub.local`,
        displayName: (displayName.trim() || firebaseUser.displayName || 'ONEHUB Member').slice(
          0,
          60
        ),
        handle: targetHandle,
        bio: '',
        avatarUrl: firebaseUser.photoURL || '',
        language: skipped ? 'en' : language,
        interests: skipped ? [] : selectedInterests,
        onboardingCompleted: !skipped,
      });
      await refreshProfiles();
      onCompleted();
    } catch (error) {
      setErrorMsg(
        extractReadableError(error, 'Could not save your profile right now.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your ONEHUB profile"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#E7EAF3] bg-[#FFFFFF] p-6 pb-8 shadow-2xl sm:rounded-3xl sm:pb-6">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E7EAF3] sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5366FF]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Quick Setup</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-[#111827]">
              Personalize your ONEHUB
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#687386]">
              Choose your username, preferred language, and a few topics. You can change these anytime.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitProfile(true)}
            className="min-h-[40px] shrink-0 rounded-xl px-3 text-xs font-semibold text-[#687386] transition-colors hover:bg-[#F7F8FC] hover:text-[#111827] disabled:opacity-50"
          >
            Skip
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitProfile(false);
          }}
          className="mt-5 space-y-4"
        >
          {/* Display Name & Unique Username */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="onboard-name" className="mb-1 block text-xs font-medium text-[#111827]">
                Display name
              </label>
              <input
                id="onboard-name"
                type="text"
                maxLength={60}
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="onboard-handle" className="mb-1 block text-xs font-medium text-[#111827]">
                Unique username
              </label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687386]" />
                <input
                  id="onboard-handle"
                  type="text"
                  maxLength={32}
                  required
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] pl-9 pr-3 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px]">
                {handleStatus === 'checking' && (
                  <span className="text-[#687386]">Checking availability...</span>
                )}
                {handleStatus === 'available' && (
                  <span className="font-medium text-emerald-600">@{normalizeHandle(handle)} is available</span>
                )}
                {handleStatus === 'taken' && (
                  <span className="font-medium text-rose-600">Username already taken</span>
                )}
                {handleStatus === 'invalid' && (
                  <span className="text-[#687386]">Use 2–32 lowercase letters, numbers, or _</span>
                )}
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <label
              htmlFor="onboard-language"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#111827]"
            >
              <Globe className="h-3.5 w-3.5 text-[#5366FF]" />
              <span>Preferred language</span>
            </label>
            <select
              id="onboard-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
            >
              {ONEHUB_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Interests Selector */}
          <div>
            <p className="mb-2 text-xs font-medium text-[#111827]">
              Interests <span className="font-normal text-[#687386]">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {ONEHUB_TOPICS.map((topic) => {
                const selected = selectedInterests.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleInterest(topic)}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all active:scale-95 ${
                      selected
                        ? 'elegance-gradient text-white shadow-sm'
                        : 'border border-[#E7EAF3] bg-[#FFFFFF] text-[#111827] hover:border-[#5366FF]/45'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                    <span>{topic}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitProfile(true)}
              className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={submitting || handleStatus === 'taken' || handleStatus === 'invalid'}
              className="elegance-gradient inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Finish Setup</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
