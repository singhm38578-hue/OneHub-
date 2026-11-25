import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Bookmark,
  Compass,
  Film,
  Home,
  LogIn,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { AuthModal } from './components/AuthModal';
import { CreateScreen } from './components/CreateScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeScreen } from './components/HomeScreen';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { OnboardingModal } from './components/OnboardingModal';
import { OneHubLogo } from './components/OneHubLogo';
import { ProfileScreen } from './components/ProfileScreen';
import { TrendingPanel } from './components/TrendingPanel';
import { UpcomingSectionView } from './components/UpcomingSectionView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { extractReadableError } from './lib/firebase';
import {
  activeDataAdapter,
  computeInitials,
  deriveTrendingFromPosts,
  gradientForUid,
  type ViewerSocialState,
} from './services/dataAdapter';
import type {
  FeedTab,
  FeedViewState,
  NavSection,
  NotificationItem,
  PostItem,
  StoryItem,
} from './types/onehub';

interface NavItemConfig {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'create', label: 'Create', icon: Plus },
  { id: 'shorts', label: 'Shorts', icon: Film },
  { id: 'profile', label: 'Profile', icon: User },
];

const FEED_PAGE_SIZE = 12;

function OneHubAppShell() {
  const {
    authReady,
    firebaseUser,
    privateProfile,
    publicProfile,
    needsOnboarding,
  } = useAuth();

  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [feedTab, setFeedTab] = useState<FeedTab>('for-you');
  const [feedState, setFeedState] = useState<FeedViewState>('loading');
  const [feedErrorMessage, setFeedErrorMessage] = useState<string | null>(null);

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(() => new Set());
  const [realtimePosts, setRealtimePosts] = useState<PostItem[]>([]);
  const [olderPosts, setOlderPosts] = useState<PostItem[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostItem['comments']>>({});
  const [loadedCommentsPosts, setLoadedCommentsPosts] = useState<Set<string>>(() => new Set());

  const [lastCursor, setLastCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const [viewerSocial, setViewerSocial] = useState<ViewerSocialState>({
    likedIds: new Set(),
    savedIds: new Set(),
    followingIds: new Set(),
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const promptAuth = useCallback((reason?: string) => {
    setAuthModalReason(reason || null);
    setAuthModalOpen(true);
  }, []);

  // Load viewer's real likes, saves, and follows when signed in
  const loadViewerSocial = useCallback(async (uid: string | null) => {
    if (!uid) {
      setViewerSocial({
        likedIds: new Set(),
        savedIds: new Set(),
        followingIds: new Set(),
      });
      return;
    }
    try {
      const state = await activeDataAdapter.fetchViewerSocialState(uid);
      setViewerSocial(state);
    } catch (error) {
      console.error('Failed to hydrate viewer social state:', error);
    }
  }, []);

  // Load stories + initial feed snapshot
  const loadInitialFeed = useCallback(async () => {
    setFeedState('loading');
    setFeedErrorMessage(null);
    try {
      const [page, liveStories] = await Promise.all([
        activeDataAdapter.fetchPostsPage({ pageSize: FEED_PAGE_SIZE }),
        activeDataAdapter.fetchStories().catch(() => []),
      ]);
      setRealtimePosts(page.posts);
      setOlderPosts([]);
      setLastCursor(page.lastCursor);
      setHasMorePosts(page.hasMore);
      setStories(liveStories);
      setFeedState('ready');
    } catch (error) {
      setFeedErrorMessage(
        extractReadableError(
          error,
          'Could not connect to Cloud Firestore. Ensure Firestore rules and indexes are deployed.'
        )
      );
      setFeedState('error');
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void loadViewerSocial(firebaseUser?.uid ?? null);
  }, [authReady, firebaseUser?.uid, loadViewerSocial]);

  // Real-time subscription to latest public posts + stories fetch
  useEffect(() => {
    if (!authReady) return;

    void activeDataAdapter
      .fetchStories()
      .then((liveStories) => setStories(liveStories))
      .catch(() => {
        // Stories error will not break feed
      });

    setFeedState('loading');
    setFeedErrorMessage(null);

    const unsubscribe = activeDataAdapter.subscribeLatestPosts(
      FEED_PAGE_SIZE,
      (latestPosts, cursor) => {
        setRealtimePosts(latestPosts);
        setLastCursor((prev) => (olderPosts.length > 0 ? prev : cursor));
        setHasMorePosts((prev) => (olderPosts.length > 0 ? prev : latestPosts.length >= FEED_PAGE_SIZE));
        setFeedState('ready');
        setFeedErrorMessage(null);
      },
      (err) => {
        setFeedErrorMessage(
          extractReadableError(
            err,
            'Could not load posts from Firestore. Verify firestore.rules are deployed.'
          )
        );
        setFeedState('error');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time notifications subscription for signed-in user
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setNotifications([]);
      return;
    }

    const unsubscribe = activeDataAdapter.subscribeNotifications(
      firebaseUser.uid,
      (items) => setNotifications(items),
      (err) => {
        console.error('Notifications listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  // Merge real-time page 1 + paginated older pages + viewer social state + loaded comments
  const hydratedPosts = useMemo(() => {
    const merged: PostItem[] = [];
    const seen = new Set<string>();

    for (const post of [...realtimePosts, ...olderPosts]) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push({
        ...post,
        isLiked: viewerSocial.likedIds.has(post.id),
        isSaved: viewerSocial.savedIds.has(post.id),
        author: {
          ...post.author,
          isFollowed: viewerSocial.followingIds.has(post.author.uid),
        },
        comments: commentsByPost[post.id] ?? post.comments,
        commentsLoaded: loadedCommentsPosts.has(post.id) || post.commentsLoaded,
      });
    }
    return merged;
  }, [realtimePosts, olderPosts, viewerSocial, commentsByPost, loadedCommentsPosts]);

  const hydratedStories = useMemo(
    () =>
      stories.map((story) => ({
        ...story,
        viewed: viewedStoryIds.has(story.id),
      })),
    [stories, viewedStoryIds]
  );

  const trendingTopics = useMemo(
    () => deriveTrendingFromPosts(hydratedPosts),
    [hydratedPosts]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleSelectNav = (section: NavSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadMorePosts = async () => {
    if (!lastCursor || loadingMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const nextPage = await activeDataAdapter.fetchPostsPage({
        pageSize: FEED_PAGE_SIZE,
        cursor: lastCursor,
        viewerState: viewerSocial,
      });
      setOlderPosts((prev) => [...prev, ...nextPage.posts]);
      setLastCursor(nextPage.lastCursor);
      setHasMorePosts(nextPage.hasMore);
    } catch (error) {
      showToast(extractReadableError(error, 'Could not load more posts.'));
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const ensureVerifiedProfile = (actionLabel: string): boolean => {
    if (!firebaseUser) {
      promptAuth(`Sign in to ${actionLabel}.`);
      return false;
    }
    if (!firebaseUser.emailVerified) {
      showToast('Please verify your email address first (see Profile).');
      return false;
    }
    if (!publicProfile) {
      showToast('Please finish your quick profile setup first.');
      return false;
    }
    return true;
  };

  const handleViewStory = (storyId: string) => {
    setViewedStoryIds((prev) => new Set(prev).add(storyId));
  };

  const handleAddStory = async (caption: string, imageUrl: string) => {
    if (!ensureVerifiedProfile('share a story') || !publicProfile) return;
    try {
      const created = await activeDataAdapter.createStory({
        author: publicProfile,
        caption,
        imageUrl,
      });
      setStories((prev) => [created, ...prev]);
      showToast('Story published');
    } catch (error) {
      showToast(extractReadableError(error, 'Could not publish story.'));
    }
  };

  const handleToggleLike = async (post: PostItem) => {
    if (!ensureVerifiedProfile('like posts') || !publicProfile) return;
    const currentlyLiked = viewerSocial.likedIds.has(post.id);

    // Optimistic update
    setViewerSocial((prev) => {
      const nextLiked = new Set(prev.likedIds);
      if (currentlyLiked) nextLiked.delete(post.id);
      else nextLiked.add(post.id);
      return { ...prev, likedIds: nextLiked };
    });

    try {
      await activeDataAdapter.toggleLike({
        postId: post.id,
        postAuthorId: post.author.uid,
        actor: publicProfile,
        currentlyLiked,
        currentLikesCount: post.likesCount,
      });
    } catch (error) {
      // Rollback on failure
      setViewerSocial((prev) => {
        const nextLiked = new Set(prev.likedIds);
        if (currentlyLiked) nextLiked.add(post.id);
        else nextLiked.delete(post.id);
        return { ...prev, likedIds: nextLiked };
      });
      showToast(extractReadableError(error, 'Could not update like.'));
    }
  };

  const handleToggleSave = async (post: PostItem) => {
    if (!ensureVerifiedProfile('save posts') || !firebaseUser) return;
    const currentlySaved = viewerSocial.savedIds.has(post.id);

    setViewerSocial((prev) => {
      const nextSaved = new Set(prev.savedIds);
      if (currentlySaved) nextSaved.delete(post.id);
      else nextSaved.add(post.id);
      return { ...prev, savedIds: nextSaved };
    });

    try {
      await activeDataAdapter.toggleSave({
        postId: post.id,
        userId: firebaseUser.uid,
        currentlySaved,
      });
      showToast(currentlySaved ? 'Removed from saved' : 'Saved privately to your profile');
    } catch (error) {
      setViewerSocial((prev) => {
        const nextSaved = new Set(prev.savedIds);
        if (currentlySaved) nextSaved.add(post.id);
        else nextSaved.delete(post.id);
        return { ...prev, savedIds: nextSaved };
      });
      showToast(extractReadableError(error, 'Could not update saved posts.'));
    }
  };

  const handleToggleFollow = async (creatorUid: string, currentlyFollowing: boolean) => {
    if (!ensureVerifiedProfile('follow creators') || !publicProfile) return;
    if (creatorUid === publicProfile.uid) return;

    setViewerSocial((prev) => {
      const nextFollowing = new Set(prev.followingIds);
      if (currentlyFollowing) nextFollowing.delete(creatorUid);
      else nextFollowing.add(creatorUid);
      return { ...prev, followingIds: nextFollowing };
    });

    try {
      await activeDataAdapter.toggleFollow({
        follower: publicProfile,
        targetUid: creatorUid,
        currentlyFollowing,
      });
      showToast(currentlyFollowing ? 'Unfollowed creator' : 'Following creator');
    } catch (error) {
      setViewerSocial((prev) => {
        const nextFollowing = new Set(prev.followingIds);
        if (currentlyFollowing) nextFollowing.add(creatorUid);
        else nextFollowing.delete(creatorUid);
        return { ...prev, followingIds: nextFollowing };
      });
      showToast(extractReadableError(error, 'Could not update follow status.'));
    }
  };

  const handleLoadComments = async (postId: string) => {
    try {
      const list = await activeDataAdapter.fetchComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: list }));
      setLoadedCommentsPosts((prev) => new Set(prev).add(postId));
    } catch (error) {
      showToast(extractReadableError(error, 'Could not load comments.'));
    }
  };

  const handleAddComment = async (post: PostItem, text: string) => {
    if (!ensureVerifiedProfile('comment on posts') || !publicProfile) return;
    try {
      const created = await activeDataAdapter.addComment({
        postId: post.id,
        postAuthorId: post.author.uid,
        actor: publicProfile,
        text,
        currentCommentsCount: post.commentsCount,
      });
      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: [...(prev[post.id] ?? []), created],
      }));
      setLoadedCommentsPosts((prev) => new Set(prev).add(post.id));
      showToast('Comment posted');
    } catch (error) {
      showToast(extractReadableError(error, 'Could not post comment.'));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!ensureVerifiedProfile('delete posts')) return;
    try {
      await activeDataAdapter.deletePost(postId);
      setRealtimePosts((prev) => prev.filter((p) => p.id !== postId));
      setOlderPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast('Post deleted');
    } catch (error) {
      showToast(extractReadableError(error, 'Could not delete post.'));
    }
  };

  const handlePostCreated = (post: PostItem) => {
    setRealtimePosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
    setActiveSection('home');
    setFeedTab('for-you');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Post published to ONEHUB');
  };

  const handleSharePost = async (post: PostItem) => {
    const shareUrl = `${window.location.origin}/#post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ONEHUB · ${post.author.displayName}`,
          text: post.content,
          url: shareUrl,
        });
        showToast('Shared post');
        return;
      }
    } catch {
      // User dismissed native share sheet
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Post link copied to clipboard');
    } catch {
      showToast('Share link ready');
    }
  };

  const handleSelectHashtag = (hashtag: string | null) => {
    setActiveHashtag(hashtag);
    if (hashtag && activeSection !== 'home') {
      setActiveSection('home');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await activeDataAdapter.markAllNotificationsRead(unreadIds);
    } catch (error) {
      showToast(extractReadableError(error, 'Could not mark notifications read.'));
    }
  };

  const handleMarkOneRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    try {
      await activeDataAdapter.markNotificationRead(id);
    } catch (error) {
      showToast(extractReadableError(error, 'Could not mark notification read.'));
    }
  };

  const handleOpenSavedInHome = () => {
    if (!firebaseUser) {
      promptAuth('Sign in to view your saved posts.');
      return;
    }
    setSavedOnly(true);
    setFeedTab('for-you');
    setActiveSection('home');
  };

  const lowDataMode = Boolean(privateProfile?.lowDataMode);
  const headerClass = lowDataMode
    ? 'bg-[#FFFFFF]/95 sticky top-0 z-30 border-b border-[#E7EAF3] lg:hidden'
    : 'elegance-glass sticky top-0 z-30 border-b border-[#E7EAF3] lg:hidden';
  const bottomNavClass = lowDataMode
    ? 'bg-[#FFFFFF]/95 pb-safe fixed bottom-0 left-0 right-0 z-30 border-t border-[#E7EAF3] lg:hidden'
    : 'elegance-glass pb-safe fixed bottom-0 left-0 right-0 z-30 border-t border-[#E7EAF3] lg:hidden';

  return (
    <div className="min-h-dvh bg-[#F7F8FC] text-[#111827]">
      {/* Mobile Compact Sticky Header (<lg) — 50px tall */}
      <header className={headerClass}>
        <div className="mx-auto flex h-[50px] max-w-2xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => handleSelectNav('home')}
            className="flex min-h-[44px] items-center focus-visible:rounded-lg"
            aria-label="ONEHUB Home"
          >
            <OneHubLogo compact />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((prev) => !prev);
                if (activeSection !== 'home') setActiveSection('home');
              }}
              aria-expanded={searchOpen}
              aria-label="Toggle search"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors ${
                searchOpen || searchQuery
                  ? 'bg-[#5366FF]/10 text-[#5366FF]'
                  : 'text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]'
              }`}
            >
              <Search className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label={`Open notifications (${unreadNotificationsCount} unread)`}
              className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#687386] transition-colors hover:bg-[#F7F8FC] hover:text-[#111827]"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationsCount > 0 && (
                <span className="elegance-gradient absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold tabular-nums text-white shadow-sm">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {!firebaseUser && authReady && (
              <button
                type="button"
                onClick={() => promptAuth()}
                className="elegance-gradient ml-1 inline-flex min-h-[34px] items-center rounded-xl px-3 text-xs font-semibold text-white shadow-sm"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Expandable Mobile Search Input */}
        {searchOpen && (
          <div className="border-t border-[#E7EAF3] bg-[#FFFFFF] px-4 py-2">
            <div className="relative mx-auto flex max-w-2xl items-center">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#687386]" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts, creators, or #hashtags..."
                aria-label="Search posts, creators, or hashtags"
                className="min-h-[42px] w-full rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] pl-10 pr-10 text-sm text-[#111827] placeholder:text-[#687386]/80 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1 flex min-h-[38px] min-w-[38px] items-center justify-center text-[#687386] hover:text-[#111827]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Responsive Layout Shell */}
      <div className="mx-auto flex w-full max-w-[1380px] justify-center lg:gap-6 lg:px-6 xl:gap-8 xl:px-8">
        {/* Desktop Navigation Sidebar (lg+) */}
        <aside
          aria-label="Primary navigation"
          className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-[#E7EAF3] lg:bg-[#FFFFFF] lg:px-4 lg:py-6 xl:w-64"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => handleSelectNav('home')}
                className="focus-visible:rounded-lg"
                aria-label="ONEHUB Home"
              >
                <OneHubLogo />
              </button>
            </div>

            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const isCreate = item.id === 'create';

                if (isCreate) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`elegance-gradient my-2 flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-3.5 text-sm font-semibold text-white whitespace-nowrap shadow-[0_6px_16px_rgba(83,102,255,0.24)] transition-all duration-150 hover:opacity-95 active:scale-[0.98] ${
                        isActive ? 'ring-2 ring-[#5366FF]/35 ring-offset-2' : ''
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-white" />
                      <span>{item.label}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-[46px] w-full items-center gap-3.5 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                      isActive
                        ? 'bg-[#F7F8FC] text-[#5366FF] ring-1 ring-[#E7EAF3]'
                        : 'text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive ? 'text-[#5366FF]' : 'text-[#687386]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-[#E7EAF3] pt-4">
              <button
                type="button"
                onClick={handleOpenSavedInHome}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3.5 text-sm font-medium transition-colors ${
                  savedOnly && activeSection === 'home'
                    ? 'bg-[#805CFF]/10 text-[#805CFF]'
                    : 'text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Bookmark className="h-4 w-4 text-[#805CFF]" />
                  <span>Saved</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-[#687386]">
                  {viewerSocial.savedIds.size}
                </span>
              </button>
            </div>
          </div>

          {/* Account Summary or Sign-In CTA */}
          {firebaseUser ? (
            <button
              type="button"
              onClick={() => handleSelectNav('profile')}
              className="flex items-center gap-3 rounded-2xl border border-[#E7EAF3] bg-[#F7F8FC] p-3 text-left transition-colors hover:border-[#5366FF]/40"
            >
              {publicProfile?.avatarUrl || firebaseUser.photoURL ? (
                <img
                  src={publicProfile?.avatarUrl || firebaseUser.photoURL || ''}
                  alt={publicProfile?.displayName || 'Your avatar'}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientForUid(firebaseUser.uid)} text-xs font-bold text-white`}
                >
                  {computeInitials(
                    publicProfile?.displayName || firebaseUser.displayName || 'You'
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#111827]">
                  {publicProfile?.displayName || firebaseUser.displayName || 'ONEHUB Member'}
                </p>
                <p className="truncate text-[11px] text-[#687386]">
                  @{publicProfile?.handle || 'setup_profile'}
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => promptAuth()}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-[#5366FF]/30 bg-[#F7F8FC] px-4 text-xs font-semibold text-[#5366FF] transition-colors hover:bg-[#FFFFFF]"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In / Sign Up</span>
            </button>
          )}
        </aside>

        {/* Central Content Column */}
        <main className="w-full min-w-0 max-w-2xl flex-1 px-4 pb-24 pt-3 sm:px-6 lg:px-2 lg:pb-12 lg:pt-5">
          {/* Desktop Utility Header */}
          <div className="mb-4 hidden items-center justify-between gap-4 lg:flex">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#687386]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeSection !== 'home') setActiveSection('home');
                }}
                placeholder="Search posts, creators, or #hashtags..."
                aria-label="Search posts, creators, or hashtags"
                className="min-h-[44px] w-full rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] pl-10 pr-10 text-sm text-[#111827] shadow-[0_1px_4px_rgba(17,24,39,0.03)] placeholder:text-[#687386]/80 transition-colors focus:border-[#5366FF] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#687386] hover:text-[#111827]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label={`Open notifications (${unreadNotificationsCount} unread)`}
              className="relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] text-[#687386] shadow-[0_1px_4px_rgba(17,24,39,0.03)] transition-colors hover:border-[#5366FF]/45 hover:text-[#5366FF]"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationsCount > 0 && (
                <span className="elegance-gradient absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold tabular-nums text-white shadow-sm">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

          {/* Routed Section View */}
          {activeSection === 'home' ? (
            <HomeScreen
              currentUserId={firebaseUser?.uid ?? null}
              lowDataMode={lowDataMode}
              stories={hydratedStories}
              posts={hydratedPosts}
              trending={trendingTopics}
              feedTab={feedTab}
              onChangeFeedTab={setFeedTab}
              feedState={feedState}
              feedErrorMessage={feedErrorMessage}
              onRetryFeed={() => void loadInitialFeed()}
              hasMorePosts={hasMorePosts}
              loadingMorePosts={loadingMorePosts}
              onLoadMorePosts={() => void handleLoadMorePosts()}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
              activeHashtag={activeHashtag}
              onSelectHashtag={handleSelectHashtag}
              onOpenExplore={() => handleSelectNav('explore')}
              onOpenCreate={() => handleSelectNav('create')}
              savedOnly={savedOnly}
              onToggleSavedOnly={() => {
                if (!savedOnly && !firebaseUser) {
                  promptAuth('Sign in to filter your private saved posts.');
                  return;
                }
                setSavedOnly((prev) => !prev);
              }}
              onViewStory={handleViewStory}
              onAddStory={handleAddStory}
              onToggleLike={(post) => void handleToggleLike(post)}
              onToggleSave={(post) => void handleToggleSave(post)}
              onToggleFollow={(uid, following) => void handleToggleFollow(uid, following)}
              onLoadComments={handleLoadComments}
              onAddComment={handleAddComment}
              onDeletePost={handleDeletePost}
              onSharePost={handleSharePost}
            />
          ) : activeSection === 'create' ? (
            <CreateScreen
              onPostCreated={handlePostCreated}
              onRequireAuth={promptAuth}
              onShowToast={showToast}
            />
          ) : activeSection === 'profile' ? (
            <ProfileScreen
              viewerSocialState={viewerSocial}
              onRequireAuth={promptAuth}
              onOpenCreate={() => handleSelectNav('create')}
              onToggleLike={(post) => void handleToggleLike(post)}
              onToggleSave={(post) => void handleToggleSave(post)}
              onToggleFollow={(uid, following) => void handleToggleFollow(uid, following)}
              onLoadComments={handleLoadComments}
              onAddComment={handleAddComment}
              onDeletePost={handleDeletePost}
              onSharePost={handleSharePost}
              onSelectHashtag={(tag) => handleSelectHashtag(tag)}
              onShowToast={showToast}
            />
          ) : (
            <UpcomingSectionView
              section={activeSection}
              onReturnHome={() => handleSelectNav('home')}
            />
          )}
        </main>

        {/* Desktop Right Rail */}
        <aside
          aria-label="Trending sidebar"
          className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:py-5 xl:w-[340px]"
        >
          <div className="space-y-4">
            <TrendingPanel
              topics={trendingTopics}
              activeHashtag={activeHashtag}
              onSelectHashtag={handleSelectHashtag}
              onOpenExplore={() => handleSelectNav('explore')}
              variant="rail"
            />
          </div>
        </aside>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (<lg) */}
      <nav aria-label="Mobile navigation" className={bottomNavClass}>
        <div className="mx-auto grid h-14 max-w-2xl grid-cols-5 items-center px-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isCreate = item.id === 'create';

            if (isCreate) {
              return (
                <div key={item.id} className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label="Create"
                    className={`elegance-gradient flex h-11 w-12 items-center justify-center rounded-2xl text-white shadow-[0_6px_16px_rgba(83,102,255,0.32)] transition-transform duration-150 hover:opacity-95 active:scale-95 ${
                      isActive ? 'ring-2 ring-[#5366FF]/35 ring-offset-2' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-150 active:scale-95 ${
                  isActive ? 'text-[#5366FF]' : 'text-[#687386] hover:text-[#111827]'
                }`}
              >
                <Icon
                  className={`h-[21px] w-[21px] ${
                    isActive ? 'text-[#5366FF]' : 'text-[#687386]'
                  }`}
                />
                <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Drawers */}
      <NotificationsDrawer
        open={notificationsOpen}
        isSignedIn={Boolean(firebaseUser)}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={() => void handleMarkAllRead()}
        onMarkOneRead={(id) => void handleMarkOneRead(id)}
        onRequireAuth={() => promptAuth('Sign in to view your notifications.')}
      />

      <AuthModal
        open={authModalOpen}
        reasonMessage={authModalReason}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => showToast('Signed in to ONEHUB')}
      />

      <OnboardingModal
        open={needsOnboarding}
        onCompleted={() => showToast('Welcome to ONEHUB! Your profile is ready.')}
      />

      {/* Non-blocking Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[#E7EAF3] bg-[#111827] px-4 py-2.5 text-xs font-medium text-white shadow-xl lg:bottom-6"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <OneHubAppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
