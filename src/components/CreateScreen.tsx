import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Hash,
  ImagePlus,
  Loader2,
  MailCheck,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  extractReadableError,
  FIREBASE_CONFIG_SUMMARY,
  uploadCompressedImageToStorage,
} from '../lib/firebase';
import {
  compressImageFile,
  formatFileSize,
  type CompressedImageResult,
} from '../lib/imageCompression';
import {
  activeDataAdapter,
  computeInitials,
  extractHashtagsFromText,
  gradientForUid,
} from '../services/dataAdapter';
import {
  ONEHUB_TOPICS,
  type OneHubTopic,
  type PostItem,
} from '../types/onehub';

interface CreateScreenProps {
  onPostCreated: (post: PostItem) => void;
  onRequireAuth: (reason?: string) => void;
  onShowToast: (message: string) => void;
}

const QUICK_HASHTAGS = ['#ONEHUB', '#Design', '#Technology', '#Photography', '#Cinema'];

export const CreateScreen: React.FC<CreateScreenProps> = ({
  onPostCreated,
  onRequireAuth,
  onShowToast,
}) => {
  const {
    firebaseUser,
    publicProfile,
    resendVerificationEmail,
    refreshAuthUser,
    authActionLoading,
  } = useAuth();

  const [content, setContent] = useState('');
  const [topic, setTopic] = useState<OneHubTopic>('Community');
  const [compressedImage, setCompressedImage] = useState<CompressedImageResult | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (compressedImage?.previewUrl) {
        URL.revokeObjectURL(compressedImage.previewUrl);
      }
    };
  }, [compressedImage]);

  const detectedHashtags = extractHashtagsFromText(content);

  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setCompressing(true);

    try {
      const result = await compressImageFile(file, {
        maxDimension: 1280,
        targetBytes: 240 * 1024,
      });
      if (compressedImage?.previewUrl) {
        URL.revokeObjectURL(compressedImage.previewUrl);
      }
      setCompressedImage(result);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : 'Could not process image.'
      );
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    if (compressedImage?.previewUrl) {
      URL.revokeObjectURL(compressedImage.previewUrl);
    }
    setCompressedImage(null);
    setUploadPercent(null);
  };

  const appendQuickHashtag = (tag: string) => {
    if (content.toLowerCase().includes(tag.toLowerCase())) return;
    const sep = content.trim().length > 0 && !content.endsWith(' ') ? ' ' : '';
    const next = `${content}${sep}${tag} `.slice(0, 1000);
    setContent(next);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      onRequireAuth('Sign in to publish posts on ONEHUB.');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setErrorMsg('Please verify your email address before publishing.');
      return;
    }
    if (!publicProfile) {
      setErrorMsg('Complete your quick profile setup before publishing.');
      return;
    }

    const cleanContent = content.trim();
    if (!cleanContent) {
      setErrorMsg('Write a caption or thought before publishing.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      let uploadedImageUrl = '';
      if (compressedImage) {
        if (!FIREBASE_CONFIG_SUMMARY.hasStorageBucket) {
          throw new Error(
            'Firebase Storage is not configured yet. Remove the image to post text-only, or enable Firebase Storage in Firebase Console.'
          );
        }
        setUploadPercent(5);
        uploadedImageUrl = await uploadCompressedImageToStorage({
          blob: compressedImage.blob,
          userId: firebaseUser.uid,
          folder: 'posts',
          mimeType: compressedImage.mimeType,
          onProgress: (pct) => setUploadPercent(pct),
        });
      }

      const created = await activeDataAdapter.createPost({
        author: publicProfile,
        content: cleanContent,
        topic,
        hashtags: detectedHashtags,
        imageUrl: uploadedImageUrl,
      });

      setContent('');
      handleRemoveImage();
      onPostCreated(created);
    } catch (error) {
      setUploadPercent(null);
      setErrorMsg(extractReadableError(error, 'Could not publish your post.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!firebaseUser) {
    return (
      <section className="elegance-card rounded-2xl p-6 text-center sm:p-8">
        <div className="elegance-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
          <ImagePlus className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#111827]">Create on ONEHUB</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#687386]">
          Sign in to share posts, photos, and hashtags with the community.
        </p>
        <button
          type="button"
          onClick={() => onRequireAuth('Sign in to create your first post.')}
          className="elegance-gradient mt-6 min-h-[46px] rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-95"
        >
          Sign in to Create
        </button>
      </section>
    );
  }

  if (!firebaseUser.emailVerified) {
    return (
      <section className="elegance-card rounded-2xl p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F8FC] text-[#5366FF] ring-1 ring-[#E7EAF3]">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#111827]">
          Verify your email to publish
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#687386]">
          We sent a verification link to <strong className="text-[#111827]">{firebaseUser.email}</strong>.
          Verify your email to protect the community and unlock posting.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={authActionLoading}
            onClick={async () => {
              const verified = await refreshAuthUser();
              onShowToast(
                verified ? 'Email verified!' : 'Still waiting for email verification.'
              );
            }}
            className="elegance-gradient inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-55"
          >
            {authActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>I&apos;ve verified — Refresh</span>
          </button>
          <button
            type="button"
            disabled={authActionLoading}
            onClick={async () => {
              const sent = await resendVerificationEmail();
              if (sent) onShowToast('Verification email resent');
            }}
            className="min-h-[44px] rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] hover:bg-[#F7F8FC] disabled:opacity-55"
          >
            Resend email
          </button>
        </div>
      </section>
    );
  }

  const authorName = publicProfile?.displayName || firebaseUser.displayName || 'You';
  const authorHandle = publicProfile?.handle || 'member';
  const authorAvatar = publicProfile?.avatarUrl || firebaseUser.photoURL || '';

  return (
    <section aria-label="Create post" className="elegance-card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-[#E7EAF3] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              referrerPolicy="no-referrer"
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#E7EAF3]"
            />
          ) : (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientForUid(firebaseUser.uid)} font-[family-name:var(--font-display)] text-sm font-bold text-white`}
            >
              {computeInitials(authorName)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-[#111827]">Create Post</h1>
            <p className="truncate text-xs text-[#687386]">
              Posting as @{authorHandle} · Public
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handlePublish} className="mt-4 space-y-4">
        {/* Caption Input */}
        <div>
          <label htmlFor="create-caption" className="sr-only">
            Write your post caption
          </label>
          <textarea
            id="create-caption"
            rows={4}
            maxLength={1000}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a thought, photo, or update... Add #hashtags to help people discover it."
            className="w-full resize-none rounded-2xl border border-[#E7EAF3] bg-[#F7F8FC] p-4 text-[15px] leading-relaxed text-[#111827] placeholder:text-[#687386]/75 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#687386]">
            <span>
              {detectedHashtags.length > 0
                ? `Detected: ${detectedHashtags.join(' ')}`
                : 'Tip: include #hashtags directly in your caption'}
            </span>
            <span className="shrink-0 font-mono tabular-nums">
              {content.length}/1000
            </span>
          </div>
        </div>

        {/* Quick Hashtag Suggestions */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_HASHTAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => appendQuickHashtag(tag)}
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#687386] transition-colors hover:border-[#5366FF]/45 hover:text-[#5366FF]"
            >
              <Hash className="h-3 w-3 text-[#805CFF]" />
              <span>{tag.replace(/^#/, '')}</span>
            </button>
          ))}
        </div>

        {/* Topic Selector */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-[#111827]">Topic</p>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {ONEHUB_TOPICS.map((item) => {
              const active = topic === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTopic(item)}
                  className={`min-h-[36px] shrink-0 rounded-xl px-3 text-xs font-semibold transition-all ${
                    active
                      ? 'elegance-gradient text-white shadow-sm'
                      : 'border border-[#E7EAF3] bg-[#F7F8FC] text-[#687386] hover:text-[#111827]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compressed Image Preview */}
        {compressedImage && (
          <div className="relative overflow-hidden rounded-2xl border border-[#E7EAF3] bg-[#F7F8FC]">
            <img
              src={compressedImage.previewUrl}
              alt="Compressed upload preview"
              className="max-h-80 w-full object-cover"
            />
            <div className="flex items-center justify-between gap-2 border-t border-[#E7EAF3] bg-[#FFFFFF] px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Compressed: {formatFileSize(compressedImage.originalBytes)} →{' '}
                  <strong className="font-mono tabular-nums">
                    {formatFileSize(compressedImage.compressedBytes)}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={submitting}
                aria-label="Remove image"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        )}

        {/* Upload Progress Bar */}
        {uploadPercent !== null && (
          <div className="space-y-1.5 rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] p-3">
            <div className="flex items-center justify-between text-xs font-medium text-[#111827]">
              <span className="flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4 text-[#5366FF]" />
                Uploading compressed image...
              </span>
              <span className="font-mono tabular-nums text-[#5366FF]">
                {uploadPercent}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E7EAF3]">
              <div
                className="elegance-gradient h-full rounded-full transition-[width] duration-150"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-700"
          >
            {errorMsg}
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E7EAF3] pt-4">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleSelectImage}
              className="hidden"
            />
            <button
              type="button"
              disabled={compressing || submitting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-4 text-xs font-semibold text-[#111827] transition-colors hover:border-[#5366FF]/45 hover:text-[#5366FF] disabled:opacity-50"
            >
              {compressing ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#5366FF]" />
              ) : (
                <ImagePlus className="h-4 w-4 text-[#5366FF]" />
              )}
              <span>{compressedImage ? 'Change Photo' : 'Add Photo'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || compressing || !content.trim()}
            className="elegance-gradient inline-flex min-h-[44px] items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>{submitting ? 'Publishing...' : 'Publish Post'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};
