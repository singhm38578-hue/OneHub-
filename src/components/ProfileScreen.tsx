import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AtSign,
  Bookmark,
  Camera,
  Check,
  Edit3,
  Globe,
  Grid,
  Link as LinkIcon,
  Loader2,
  Lock,
  LogOut,
  MailCheck,
  MapPin,
  Settings,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  extractReadableError,
  FIREBASE_CONFIG_SUMMARY,
  uploadCompressedImageToStorage,
} from '../lib/firebase';
import { compressImageFile } from '../lib/imageCompression';
import {
  activeDataAdapter,
  computeInitials,
  gradientForUid,
  isValidHandleFormat,
  normalizeHandle,
  type ViewerSocialState,
} from '../services/dataAdapter';
import {
  ONEHUB_LANGUAGES,
  ONEHUB_TOPICS,
  type PostItem,
} from '../types/onehub';
import { FeedEmptyState, FeedLoadingState } from './FeedStates';
import { PostCard } from './PostCard';

interface ProfileScreenProps {
  viewerSocialState: ViewerSocialState;
  onRequireAuth: (reason?: string) => void;
  onOpenCreate: () => void;
  onToggleLike: (post: PostItem) => void;
  onToggleSave: (post: PostItem) => void;
  onToggleFollow: (creatorUid: string, currentlyFollowing: boolean) => void;
  onLoadComments: (postId: string) => Promise<void>;
  onAddComment: (post: PostItem, text: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onSharePost: (post: PostItem) => void;
  onSelectHashtag: (hashtag: string) => void;
  onShowToast: (message: string) => void;
}

type ProfileTab = 'posts' | 'saved' | 'settings';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  viewerSocialState,
  onRequireAuth,
  onOpenCreate,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onLoadComments,
  onAddComment,
  onDeletePost,
  onSharePost,
  onSelectHashtag,
  onShowToast,
}) => {
  const {
    firebaseUser,
    privateProfile,
    publicProfile,
    profileLoading,
    refreshProfiles,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
    authActionLoading,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostItem[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [loadingTab, setLoadingTab] = useState(false);

  // Edit Profile Modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Settings state
  const [savingSettings, setSavingSettings] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadProfileData = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingTab(true);
    try {
      const [myPosts, mySaved, counts] = await Promise.all([
        activeDataAdapter.fetchUserPosts(firebaseUser.uid, viewerSocialState).catch(() => []),
        activeDataAdapter.fetchSavedPostsForOwner(firebaseUser.uid, viewerSocialState).catch(() => []),
        activeDataAdapter.fetchFollowCounts(firebaseUser.uid).catch(() => ({ followers: 0, following: 0 })),
      ]);
      setUserPosts(myPosts);
      setSavedPosts(mySaved);
      setFollowCounts(counts);
    } finally {
      setLoadingTab(false);
    }
  }, [firebaseUser, viewerSocialState]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  const openEditModal = () => {
    if (!privateProfile) return;
    setEditName(privateProfile.displayName);
    setEditHandle(privateProfile.handle);
    setEditBio(privateProfile.bio);
    setEditLocation(privateProfile.location);
    setEditWebsite(privateProfile.website);
    setEditAvatarUrl(privateProfile.avatarUrl);
    setEditError(null);
    setEditOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setEditError(null);
    setAvatarUploading(true);
    try {
      if (!FIREBASE_CONFIG_SUMMARY.hasStorageBucket) {
        throw new Error('Firebase Storage is not configured yet for avatar uploads.');
      }
      const compressed = await compressImageFile(file, {
        maxDimension: 512,
        targetBytes: 120 * 1024,
      });
      URL.revokeObjectURL(compressed.previewUrl);
      const url = await uploadCompressedImageToStorage({
        blob: compressed.blob,
        userId: firebaseUser.uid,
        folder: 'avatars',
        mimeType: compressed.mimeType,
      });
      setEditAvatarUrl(url);
      onShowToast('Profile photo uploaded');
    } catch (error) {
      setEditError(extractReadableError(error, 'Avatar upload failed.'));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !privateProfile) return;

    const cleanHandle = normalizeHandle(editHandle);
    if (!isValidHandleFormat(cleanHandle)) {
      setEditError('Username must be 2–32 characters (lowercase letters, numbers, underscores).');
      return;
    }

    setSavingProfile(true);
    setEditError(null);
    try {
      await activeDataAdapter.updateUserProfile({
        uid: firebaseUser.uid,
        currentHandle: privateProfile.handle,
        displayName: editName.trim(),
        handle: cleanHandle,
        bio: editBio.trim(),
        avatarUrl: editAvatarUrl,
        location: editLocation.trim(),
        website: editWebsite.trim(),
        language: privateProfile.language,
        interests: privateProfile.interests,
        isPrivateAccount: privateProfile.isPrivateAccount,
        lowDataMode: privateProfile.lowDataMode,
        onboardingCompleted: true,
      });
      await refreshProfiles();
      setEditOpen(false);
      onShowToast('Profile updated');
    } catch (error) {
      setEditError(extractReadableError(error, 'Could not update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleQuickSettingUpdate = async (patch: {
    language?: string;
    interests?: string[];
    isPrivateAccount?: boolean;
    lowDataMode?: boolean;
  }) => {
    if (!firebaseUser || !privateProfile) return;
    setSavingSettings(true);
    try {
      await activeDataAdapter.updateUserProfile({
        uid: firebaseUser.uid,
        currentHandle: privateProfile.handle,
        displayName: privateProfile.displayName,
        handle: privateProfile.handle,
        bio: privateProfile.bio,
        avatarUrl: privateProfile.avatarUrl,
        location: privateProfile.location,
        website: privateProfile.website,
        language: patch.language ?? privateProfile.language,
        interests: patch.interests ?? privateProfile.interests,
        isPrivateAccount: patch.isPrivateAccount ?? privateProfile.isPrivateAccount,
        lowDataMode: patch.lowDataMode ?? privateProfile.lowDataMode,
        onboardingCompleted: privateProfile.onboardingCompleted,
      });
      await refreshProfiles();
      onShowToast('Preferences saved');
    } catch (error) {
      onShowToast(extractReadableError(error, 'Failed to save preferences.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteOwnPost = async (postId: string) => {
    await onDeletePost(postId);
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
    setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (!firebaseUser) {
    return (
      <section className="elegance-card rounded-2xl p-6 text-center sm:p-8">
        <div className="elegance-gradient mx-auto flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm">
          OH
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#111827]">Your ONEHUB Profile</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#687386]">
          Sign in with Google or Email to create your profile, publish posts, follow creators, and keep private saved posts.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => onRequireAuth('Sign in to access your ONEHUB profile.')}
            className="elegance-gradient min-h-[46px] rounded-xl px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-95"
          >
            Sign In / Sign Up
          </button>
        </div>
      </section>
    );
  }

  if (profileLoading) {
    return <FeedLoadingState />;
  }

  const displayName =
    publicProfile?.displayName ||
    privateProfile?.displayName ||
    firebaseUser.displayName ||
    'ONEHUB Member';
  const handle = publicProfile?.handle || privateProfile?.handle || 'member';
  const bio = publicProfile?.bio || privateProfile?.bio || '';
  const avatarUrl =
    publicProfile?.avatarUrl ||
    privateProfile?.avatarUrl ||
    firebaseUser.photoURL ||
    '';

  return (
    <section aria-label="User profile" className="space-y-4">
      {/* Unverified Email Notice for Email/Password accounts */}
      {!firebaseUser.emailVerified && (
        <div className="elegance-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[#5366FF]/30 p-4">
          <div className="flex items-start gap-3">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5366FF]" />
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                Verify your email address
              </p>
              <p className="text-xs text-[#687386]">
                Check {firebaseUser.email} to unlock profile editing, posting, and saving.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={authActionLoading}
              onClick={async () => {
                const ok = await refreshAuthUser();
                onShowToast(ok ? 'Email verified!' : 'Not verified yet.');
              }}
              className="elegance-gradient min-h-[38px] rounded-xl px-3.5 text-xs font-semibold text-white"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={authActionLoading}
              onClick={async () => {
                const sent = await resendVerificationEmail();
                if (sent) onShowToast('Verification link sent');
              }}
              className="min-h-[38px] rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#111827]"
            >
              Resend
            </button>
          </div>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="elegance-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[#5366FF]/25 sm:h-20 sm:w-20"
              />
            ) : (
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientForUid(firebaseUser.uid)} font-[family-name:var(--font-display)] text-xl font-bold text-white shadow-sm sm:h-20 sm:w-20`}
              >
                {computeInitials(displayName)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-xl font-bold text-[#111827]">
                  {displayName}
                </h1>
                {privateProfile?.isPrivateAccount && (
                  <Lock className="h-4 w-4 shrink-0 text-[#687386]" aria-label="Private account" />
                )}
              </div>
              <p className="truncate text-sm text-[#687386]">@{handle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {privateProfile && (
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-3.5 text-xs font-semibold text-[#111827] transition-colors hover:border-[#5366FF]/45 hover:text-[#5366FF]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              disabled={authActionLoading}
              aria-label="Sign out"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3 text-xs font-semibold text-[#687386] transition-colors hover:text-rose-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        {bio && (
          <p className="mt-4 text-sm leading-relaxed text-[#111827]">{bio}</p>
        )}

        {(privateProfile?.location || privateProfile?.website) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#687386]">
            {privateProfile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#805CFF]" />
                <span>{privateProfile.location}</span>
              </span>
            )}
            {privateProfile.website && (
              <a
                href={privateProfile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#5366FF] hover:underline"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                <span className="truncate">{privateProfile.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>
        )}

        {/* Metrics Row */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E7EAF3] pt-4 text-center">
          <div>
            <p className="font-mono text-base font-bold tabular-nums text-[#111827]">
              {userPosts.length}
            </p>
            <p className="text-xs text-[#687386]">Posts</p>
          </div>
          <div>
            <p className="font-mono text-base font-bold tabular-nums text-[#111827]">
              {followCounts.followers}
            </p>
            <p className="text-xs text-[#687386]">Followers</p>
          </div>
          <div>
            <p className="font-mono text-base font-bold tabular-nums text-[#111827]">
              {followCounts.following}
            </p>
            <p className="text-xs text-[#687386]">Following</p>
          </div>
        </div>
      </div>

      {/* Profile Section Tabs: Posts | Saved (Owner Only) | Settings & Privacy */}
      <div
        role="tablist"
        aria-label="Profile sections"
        className="grid grid-cols-3 rounded-2xl border border-[#E7EAF3] bg-[#FFFFFF] p-1 shadow-[0_1px_4px_rgba(17,24,39,0.03)]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'posts'}
          onClick={() => setActiveTab('posts')}
          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'posts'
              ? 'elegance-gradient text-white shadow-sm'
              : 'text-[#687386] hover:text-[#111827]'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
          <span>Posts</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'saved'}
          onClick={() => setActiveTab('saved')}
          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'saved'
              ? 'elegance-gradient text-white shadow-sm'
              : 'text-[#687386] hover:text-[#111827]'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>Saved</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'settings'
              ? 'elegance-gradient text-white shadow-sm'
              : 'text-[#687386] hover:text-[#111827]'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        loadingTab ? (
          <FeedLoadingState />
        ) : userPosts.length === 0 ? (
          <FeedEmptyState
            title="No posts yet"
            description="Share your first photo or thought to start building your ONEHUB profile."
            actionLabel="Create your first post"
            onAction={onOpenCreate}
          />
        ) : (
          <div className="space-y-3.5">
            {userPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={firebaseUser.uid}
                lowDataMode={privateProfile?.lowDataMode}
                onToggleLike={() => onToggleLike(post)}
                onToggleSave={() => onToggleSave(post)}
                onToggleFollow={() => onToggleFollow(post.author.uid, post.author.isFollowed)}
                onLoadComments={onLoadComments}
                onAddComment={(text) => onAddComment(post, text)}
                onDeletePost={() => handleDeleteOwnPost(post.id)}
                onShare={onSharePost}
                onSelectHashtag={onSelectHashtag}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'saved' && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#687386]">
            <Lock className="h-3.5 w-3.5 shrink-0 text-[#805CFF]" />
            <span>Saved posts are private and visible only to you.</span>
          </div>

          {loadingTab ? (
            <FeedLoadingState />
          ) : savedPosts.length === 0 ? (
            <FeedEmptyState
              title="No saved posts"
              description="Tap the bookmark button on any post in your feed to save it privately here."
            />
          ) : (
            savedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={firebaseUser.uid}
                lowDataMode={privateProfile?.lowDataMode}
                onToggleLike={() => onToggleLike(post)}
                onToggleSave={() => {
                  onToggleSave(post);
                  setSavedPosts((prev) => prev.filter((p) => p.id !== post.id));
                }}
                onToggleFollow={() => onToggleFollow(post.author.uid, post.author.isFollowed)}
                onLoadComments={onLoadComments}
                onAddComment={(text) => onAddComment(post, text)}
                onDeletePost={
                  post.author.uid === firebaseUser.uid
                    ? () => handleDeleteOwnPost(post.id)
                    : undefined
                }
                onShare={onSharePost}
                onSelectHashtag={onSelectHashtag}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'settings' && privateProfile && (
        <div className="elegance-card space-y-5 rounded-2xl p-5 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
              <ShieldCheck className="h-4 w-4 text-[#5366FF]" />
              <span>Privacy & Account Settings</span>
            </h2>
            <p className="mt-1 text-xs text-[#687386]">
              Signed in as <strong className="text-[#111827]">{privateProfile.email}</strong> (private, never shared publicly).
            </p>
          </div>

          {/* Account Privacy Toggle */}
          <div className="flex items-center justify-between gap-4 border-t border-[#E7EAF3] pt-4">
            <div>
              <p className="text-sm font-semibold text-[#111827]">Private Profile</p>
              <p className="text-xs text-[#687386]">
                Hide your profile card from public discovery lists.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={privateProfile.isPrivateAccount}
              disabled={savingSettings}
              onClick={() =>
                void handleQuickSettingUpdate({
                  isPrivateAccount: !privateProfile.isPrivateAccount,
                })
              }
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                privateProfile.isPrivateAccount ? 'bg-[#5366FF]' : 'bg-[#E7EAF3]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  privateProfile.isPrivateAccount ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Low-Data Mode Toggle */}
          <div className="flex items-center justify-between gap-4 border-t border-[#E7EAF3] pt-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-[#111827]">
                <Wifi className="h-4 w-4 text-[#06B6D4]" />
                <span>Low-Data Mode</span>
              </p>
              <p className="text-xs text-[#687386]">
                Tap to load feed photos on demand to save mobile data.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={privateProfile.lowDataMode}
              disabled={savingSettings}
              onClick={() =>
                void handleQuickSettingUpdate({
                  lowDataMode: !privateProfile.lowDataMode,
                })
              }
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                privateProfile.lowDataMode ? 'bg-[#5366FF]' : 'bg-[#E7EAF3]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  privateProfile.lowDataMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Language Preference */}
          <div className="border-t border-[#E7EAF3] pt-4">
            <label
              htmlFor="settings-language"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#111827]"
            >
              <Globe className="h-4 w-4 text-[#805CFF]" />
              <span>Preferred Language</span>
            </label>
            <select
              id="settings-language"
              value={privateProfile.language}
              disabled={savingSettings}
              onChange={(e) =>
                void handleQuickSettingUpdate({ language: e.target.value })
              }
              className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
            >
              {ONEHUB_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Interests */}
          <div className="border-t border-[#E7EAF3] pt-4">
            <p className="mb-2 text-sm font-semibold text-[#111827]">Your Interests</p>
            <div className="flex flex-wrap gap-2">
              {ONEHUB_TOPICS.map((topic) => {
                const selected = privateProfile.interests.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    disabled={savingSettings}
                    onClick={() => {
                      const next = selected
                        ? privateProfile.interests.filter((x) => x !== topic)
                        : [...privateProfile.interests, topic].slice(0, 10);
                      void handleQuickSettingUpdate({ interests: next });
                    }}
                    className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3 text-xs font-semibold transition-all ${
                      selected
                        ? 'elegance-gradient text-white shadow-sm'
                        : 'border border-[#E7EAF3] bg-[#FFFFFF] text-[#687386] hover:text-[#111827]'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    <span>{topic}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out */}
          <div className="border-t border-[#E7EAF3] pt-4">
            <button
              type="button"
              onClick={() => void logout()}
              disabled={authActionLoading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#E7EAF3] bg-[#FFFFFF] p-6 pb-8 shadow-2xl sm:rounded-3xl sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E7EAF3] sm:hidden" />

            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#111827]">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close edit profile"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileEdit} className="mt-4 space-y-4">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4">
                {editAvatarUrl ? (
                  <img
                    src={editAvatarUrl}
                    alt="Avatar preview"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-[#E7EAF3]"
                  />
                ) : (
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${gradientForUid(firebaseUser.uid)} text-lg font-bold text-white`}
                  >
                    {computeInitials(editName || displayName)}
                  </div>
                )}

                <div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-xs font-semibold text-[#111827] hover:border-[#5366FF]/45 hover:text-[#5366FF]"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#5366FF]" />
                    ) : (
                      <Camera className="h-4 w-4 text-[#5366FF]" />
                    )}
                    <span>{avatarUploading ? 'Uploading...' : 'Change photo'}</span>
                  </button>
                  <p className="mt-1 text-[11px] text-[#687386]">
                    Compressed automatically before upload
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="edit-name" className="mb-1 block text-xs font-medium text-[#111827]">
                  Display name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  maxLength={60}
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-handle" className="mb-1 block text-xs font-medium text-[#111827]">
                  Username
                </label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687386]" />
                  <input
                    id="edit-handle"
                    type="text"
                    maxLength={32}
                    required
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value.toLowerCase())}
                    className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] pl-9 pr-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-bio" className="mb-1 block text-xs font-medium text-[#111827]">
                  Bio
                </label>
                <textarea
                  id="edit-bio"
                  rows={3}
                  maxLength={240}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell people a bit about yourself..."
                  className="w-full resize-none rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 py-2.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                />
                <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-[#687386]">
                  {editBio.length}/240
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-location" className="mb-1 block text-xs font-medium text-[#111827]">
                    Location
                  </label>
                  <input
                    id="edit-location"
                    type="text"
                    maxLength={80}
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Bengaluru, India"
                    className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-website" className="mb-1 block text-xs font-medium text-[#111827]">
                    Website (https://)
                  </label>
                  <input
                    id="edit-website"
                    type="url"
                    maxLength={512}
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
              </div>

              {editError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-700"
                >
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-[#687386] hover:bg-[#F7F8FC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile || avatarUploading}
                  className="elegance-gradient inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
