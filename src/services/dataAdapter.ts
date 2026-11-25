import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  FIREBASE_CONFIG_SUMMARY,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  ONEHUB_TOPICS,
  type CommentItem,
  type NotificationItem,
  type OneHubTopic,
  type PostItem,
  type PublicCreatorProfile,
  type StoryItem,
  type TrendingTopic,
  type UserPrivateProfile,
} from '../types/onehub';

export const IS_DEV_BUILD = Boolean(import.meta.env.DEV);

const AVATAR_GRADIENTS = [
  'from-[#5366FF] to-[#805CFF]',
  'from-[#805CFF] to-[#06B6D4]',
  'from-[#06B6D4] to-[#5366FF]',
  'from-[#5366FF] via-[#805CFF] to-[#06B6D4]',
];

export function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function gradientForUid(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function normalizeHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export function isValidHandleFormat(handle: string): boolean {
  return /^[a-z0-9_]{2,32}$/.test(handle);
}

export function extractHashtagsFromText(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]{1,35}/g) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of matches) {
    const clean = tag.slice(0, 38);
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
      if (result.length >= 10) break;
    }
  }
  return result;
}

export function formatRelativeTimestamp(ts: unknown): string {
  let ms = Date.now();
  if (ts instanceof Timestamp) {
    ms = ts.toMillis();
  } else if (typeof ts === 'number') {
    ms = ts;
  } else if (ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    ms = (ts as { toMillis: () => number }).toMillis();
  }

  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timestampToMs(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  if (ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export const DISCOVERY_TOPICS: TrendingTopic[] = [
  {
    id: 'topic-design',
    hashtag: '#Design',
    category: 'Design',
    volumeLabel: 'Topic',
    summary: 'Visual craft, interfaces, and creative systems.',
  },
  {
    id: 'topic-technology',
    hashtag: '#Technology',
    category: 'Technology',
    volumeLabel: 'Topic',
    summary: 'Builders, tools, mobile apps, and engineering ideas.',
  },
  {
    id: 'topic-photography',
    hashtag: '#Photography',
    category: 'Photography',
    volumeLabel: 'Topic',
    summary: 'Street frames, portraits, and visual moments.',
  },
  {
    id: 'topic-cinema',
    hashtag: '#Cinema',
    category: 'Cinema',
    volumeLabel: 'Topic',
    summary: 'Short films, storytelling, and framing studies.',
  },
  {
    id: 'topic-community',
    hashtag: '#ONEHUB',
    category: 'Community',
    volumeLabel: 'Topic',
    summary: 'Introductions and updates from the ONEHUB community.',
  },
];

export function deriveTrendingFromPosts(posts: PostItem[]): TrendingTopic[] {
  const counts = new Map<string, { hashtag: string; category: string; count: number }>();
  for (const post of posts) {
    for (const tag of post.hashtags) {
      const key = tag.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { hashtag: tag, category: post.topic || 'Community', count: 1 });
      }
    }
  }

  const liveTags = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item) => ({
      id: `live-${item.hashtag.toLowerCase()}`,
      hashtag: item.hashtag,
      category: item.category,
      volumeLabel: `${item.count} ${item.count === 1 ? 'post' : 'posts'}`,
      summary: `Active conversation in ${item.category}.`,
    }));

  if (liveTags.length >= 4) return liveTags;

  const merged = [...liveTags];
  const seen = new Set(merged.map((t) => t.hashtag.toLowerCase()));
  for (const fallback of DISCOVERY_TOPICS) {
    if (!seen.has(fallback.hashtag.toLowerCase())) {
      merged.push(fallback);
    }
  }
  return merged.slice(0, 6);
}

function mapDocToPost(
  docSnap: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData },
  viewerState?: {
    likedIds: Set<string>;
    savedIds: Set<string>;
    followingIds: Set<string>;
  }
): PostItem {
  const data = docSnap.data();
  const authorId = String(data.authorId || '');
  const authorName = String(data.authorName || 'ONEHUB Creator');
  const authorHandle = String(data.authorHandle || 'creator');
  const authorAvatar = String(data.authorAvatar || '');
  const imageUrl = String(data.imageUrl || '');
  const mediaType =
    data.mediaType === 'image' && imageUrl
      ? 'image'
      : 'none';
  const hashtags = Array.isArray(data.hashtags)
    ? data.hashtags.filter((item): item is string => typeof item === 'string')
    : extractHashtagsFromText(String(data.content || ''));

  return {
    id: docSnap.id,
    author: {
      uid: authorId,
      displayName: authorName,
      handle: authorHandle,
      initials: computeInitials(authorName),
      avatarGradient: gradientForUid(authorId || authorHandle),
      avatarUrl: authorAvatar || undefined,
      isFollowed: viewerState ? viewerState.followingIds.has(authorId) : false,
    },
    content: String(data.content || ''),
    topic: String(data.topic || 'Community'),
    hashtags,
    mediaType,
    mediaUrl: imageUrl || undefined,
    mediaAlt: imageUrl ? `Image posted by ${authorName}` : undefined,
    timestampLabel: formatRelativeTimestamp(data.createdAt),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
    isLiked: viewerState ? viewerState.likedIds.has(docSnap.id) : false,
    isSaved: viewerState ? viewerState.savedIds.has(docSnap.id) : false,
    comments: [],
    commentsLoaded: false,
    isPreviewSample: false,
  };
}

function mapDocToStory(docSnap: QueryDocumentSnapshot<DocumentData>): StoryItem {
  const data = docSnap.data();
  const authorId = String(data.authorId || '');
  const authorName = String(data.authorName || 'Creator');
  const authorHandle = String(data.authorHandle || 'creator');
  const authorAvatar = String(data.authorAvatar || '');

  return {
    id: docSnap.id,
    authorId,
    authorName,
    authorHandle,
    initials: computeInitials(authorName),
    avatarGradient: gradientForUid(authorId || authorHandle),
    avatarUrl: authorAvatar || undefined,
    caption: String(data.caption || ''),
    imageUrl: String(data.imageUrl || ''),
    timestampLabel: formatRelativeTimestamp(data.createdAt),
    viewed: false,
    isPreviewSample: false,
  };
}

function mapDocToComment(docSnap: QueryDocumentSnapshot<DocumentData>): CommentItem {
  const data = docSnap.data();
  const authorId = String(data.authorId || '');
  const authorName = String(data.authorName || 'Member');
  const authorHandle = String(data.authorHandle || 'member');
  const authorAvatar = String(data.authorAvatar || '');

  return {
    id: docSnap.id,
    postId: String(data.postId || ''),
    authorId,
    authorName,
    authorHandle,
    initials: computeInitials(authorName),
    avatarGradient: gradientForUid(authorId || authorHandle),
    avatarUrl: authorAvatar || undefined,
    text: String(data.text || ''),
    timestampLabel: formatRelativeTimestamp(data.createdAt),
    isPreviewSample: false,
  };
}

function mapDocToNotification(docSnap: QueryDocumentSnapshot<DocumentData>): NotificationItem {
  const data = docSnap.data();
  const actorId = String(data.actorId || '');
  const actorName = String(data.actorName || 'Member');
  const actorHandle = String(data.actorHandle || 'member');
  const type =
    data.type === 'like' || data.type === 'comment' || data.type === 'follow'
      ? data.type
      : 'like';

  return {
    id: docSnap.id,
    actorName,
    actorHandle,
    initials: computeInitials(actorName),
    avatarGradient: gradientForUid(actorId || actorHandle),
    type,
    postId: typeof data.postId === 'string' ? data.postId : undefined,
    message: String(data.message || ''),
    timestampLabel: formatRelativeTimestamp(data.createdAt),
    read: Boolean(data.read),
    isPreviewSample: false,
  };
}

export interface PostsPageResult {
  posts: PostItem[];
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface ViewerSocialState {
  likedIds: Set<string>;
  savedIds: Set<string>;
  followingIds: Set<string>;
}

export interface OneHubDataAdapter {
  readonly mode: 'firebase-live';
  fetchViewerSocialState(uid: string): Promise<ViewerSocialState>;
  fetchPostsPage(params: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    viewerState?: ViewerSocialState;
  }): Promise<PostsPageResult>;
  fetchUserPosts(uid: string, viewerState?: ViewerSocialState): Promise<PostItem[]>;
  fetchSavedPostsForOwner(uid: string, viewerState?: ViewerSocialState): Promise<PostItem[]>;
  subscribeLatestPosts(
    pageSize: number,
    onPosts: (posts: PostItem[], lastCursor: QueryDocumentSnapshot<DocumentData> | null) => void,
    onError: (err: Error) => void
  ): Unsubscribe;
  fetchStories(): Promise<StoryItem[]>;
  createStory(params: {
    author: PublicCreatorProfile;
    caption: string;
    imageUrl: string;
  }): Promise<StoryItem>;
  createPost(params: {
    author: PublicCreatorProfile;
    content: string;
    topic: OneHubTopic;
    hashtags: string[];
    imageUrl: string;
  }): Promise<PostItem>;
  deletePost(postId: string): Promise<void>;
  toggleLike(params: {
    postId: string;
    postAuthorId: string;
    actor: PublicCreatorProfile;
    currentlyLiked: boolean;
    currentLikesCount: number;
  }): Promise<void>;
  fetchComments(postId: string): Promise<CommentItem[]>;
  addComment(params: {
    postId: string;
    postAuthorId: string;
    actor: PublicCreatorProfile;
    text: string;
    currentCommentsCount: number;
  }): Promise<CommentItem>;
  toggleSave(params: {
    postId: string;
    userId: string;
    currentlySaved: boolean;
  }): Promise<void>;
  toggleFollow(params: {
    follower: PublicCreatorProfile;
    targetUid: string;
    currentlyFollowing: boolean;
  }): Promise<void>;
  fetchFollowCounts(uid: string): Promise<{ followers: number; following: number }>;
  subscribeNotifications(
    uid: string,
    onNotifications: (items: NotificationItem[]) => void,
    onError: (err: Error) => void
  ): Unsubscribe;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(unreadIds: string[]): Promise<void>;
  fetchUserPrivate(uid: string): Promise<UserPrivateProfile | null>;
  fetchPublicProfile(uid: string): Promise<PublicCreatorProfile | null>;
  isHandleAvailable(handle: string, currentUid?: string): Promise<boolean>;
  createUserProfile(params: {
    uid: string;
    email: string;
    displayName: string;
    handle: string;
    bio?: string;
    avatarUrl?: string;
    language: string;
    interests: string[];
    onboardingCompleted: boolean;
  }): Promise<{ privateProfile: UserPrivateProfile; publicProfile: PublicCreatorProfile }>;
  updateUserProfile(params: {
    uid: string;
    currentHandle: string;
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string;
    location: string;
    website: string;
    language: string;
    interests: string[];
    isPrivateAccount: boolean;
    lowDataMode: boolean;
    onboardingCompleted: boolean;
  }): Promise<void>;
}

function sanitizeUrl(url?: string): string {
  const trimmed = (url || '').trim().slice(0, 512);
  if (!trimmed) return '';
  if (trimmed.startsWith('https://')) return trimmed;
  if (/^\/src\/assets\/images\/[a-zA-Z0-9_\-]+\.jpg$/.test(trimmed)) return trimmed;
  return '';
}

function sanitizeTopic(topic: string): OneHubTopic {
  return (ONEHUB_TOPICS as readonly string[]).includes(topic)
    ? (topic as OneHubTopic)
    : 'Community';
}

function isMissingIndexError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'failed-precondition' ||
    msg.includes('requires an index') ||
    msg.includes('FAILED_PRECONDITION')
  );
}

function sortDocsByCreatedAt(
  docs: QueryDocumentSnapshot<DocumentData>[],
  direction: 'asc' | 'desc' = 'desc'
): QueryDocumentSnapshot<DocumentData>[] {
  return [...docs].sort((a, b) => {
    const diff = timestampToMs(a.data().createdAt) - timestampToMs(b.data().createdAt);
    return direction === 'asc' ? diff : -diff;
  });
}

export class OneHubFirebaseAdapter implements OneHubDataAdapter {
  readonly mode = 'firebase-live' as const;

  async fetchViewerSocialState(uid: string): Promise<ViewerSocialState> {
    const likedIds = new Set<string>();
    const savedIds = new Set<string>();
    const followingIds = new Set<string>();

    const [likesSnap, savesSnap, followsSnap] = await Promise.all([
      getDocs(query(collection(db, 'likes'), where('userId', '==', uid))).catch((error) =>
        handleFirestoreError(error, OperationType.LIST, 'likes')
      ),
      getDocs(query(collection(db, 'savedPosts'), where('userId', '==', uid))).catch((error) =>
        handleFirestoreError(error, OperationType.LIST, 'savedPosts')
      ),
      getDocs(query(collection(db, 'follows'), where('followerId', '==', uid))).catch((error) =>
        handleFirestoreError(error, OperationType.LIST, 'follows')
      ),
    ]);

    likesSnap.forEach((docSnap) => {
      const postId = docSnap.data().postId;
      if (typeof postId === 'string') likedIds.add(postId);
    });
    savesSnap.forEach((docSnap) => {
      const postId = docSnap.data().postId;
      if (typeof postId === 'string') savedIds.add(postId);
    });
    followsSnap.forEach((docSnap) => {
      const followingId = docSnap.data().followingId;
      if (typeof followingId === 'string') followingIds.add(followingId);
    });

    return { likedIds, savedIds, followingIds };
  }

  async fetchPostsPage(params: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    viewerState?: ViewerSocialState;
  }): Promise<PostsPageResult> {
    const pageSize = params.pageSize ?? 12;
    const baseConstraints = [
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1),
    ];

    const q = params.cursor
      ? query(
          collection(db, 'posts'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          startAfter(params.cursor),
          limit(pageSize + 1)
        )
      : query(collection(db, 'posts'), ...baseConstraints);

    try {
      const snap = await getDocs(q);
      const hasMore = snap.docs.length > pageSize;
      const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
      const posts = docs.map((d) => mapDocToPost(d, params.viewerState));
      const lastCursor = docs.length > 0 ? docs[docs.length - 1] : null;
      return { posts, lastCursor, hasMore };
    } catch (error) {
      if (isMissingIndexError(error) && !params.cursor) {
        try {
          const fallbackSnap = await getDocs(
            query(
              collection(db, 'posts'),
              where('visibility', '==', 'public'),
              limit(pageSize)
            )
          );
          const sorted = sortDocsByCreatedAt(fallbackSnap.docs, 'desc');
          return {
            posts: sorted.map((d) => mapDocToPost(d, params.viewerState)),
            lastCursor: sorted.length > 0 ? sorted[sorted.length - 1] : null,
            hasMore: false,
          };
        } catch (fallbackErr) {
          handleFirestoreError(fallbackErr, OperationType.LIST, 'posts');
        }
      }
      handleFirestoreError(error, OperationType.LIST, 'posts');
    }
  }

  async fetchUserPosts(uid: string, viewerState?: ViewerSocialState): Promise<PostItem[]> {
    const q = query(
      collection(db, 'posts'),
      where('authorId', '==', uid),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    try {
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapDocToPost(d, viewerState));
    } catch (error) {
      if (isMissingIndexError(error)) {
        try {
          const fallbackSnap = await getDocs(
            query(
              collection(db, 'posts'),
              where('visibility', '==', 'public'),
              limit(60)
            )
          );
          const mine = sortDocsByCreatedAt(
            fallbackSnap.docs.filter((d) => d.data().authorId === uid),
            'desc'
          );
          return mine.map((d) => mapDocToPost(d, viewerState));
        } catch (fallbackErr) {
          handleFirestoreError(fallbackErr, OperationType.LIST, `posts?authorId=${uid}`);
        }
      }
      handleFirestoreError(error, OperationType.LIST, `posts?authorId=${uid}`);
    }
  }

  async fetchSavedPostsForOwner(uid: string, viewerState?: ViewerSocialState): Promise<PostItem[]> {
    const q = query(
      collection(db, 'savedPosts'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    let savedDocs: QueryDocumentSnapshot<DocumentData>[] = [];
    try {
      const savedSnap = await getDocs(q);
      savedDocs = savedSnap.docs;
    } catch (error) {
      if (isMissingIndexError(error)) {
        try {
          const fallbackSnap = await getDocs(
            query(collection(db, 'savedPosts'), where('userId', '==', uid), limit(40))
          );
          savedDocs = sortDocsByCreatedAt(fallbackSnap.docs, 'desc');
        } catch (fallbackErr) {
          handleFirestoreError(fallbackErr, OperationType.LIST, 'savedPosts');
        }
      } else {
        handleFirestoreError(error, OperationType.LIST, 'savedPosts');
      }
    }

    if (savedDocs.length === 0) return [];

    const postIds = savedDocs
      .map((d) => String(d.data().postId || ''))
      .filter(Boolean);

    const postSnaps = await Promise.all(
      postIds.map((pid) => getDoc(doc(db, 'posts', pid)).catch(() => null))
    );

    const results: PostItem[] = [];
    for (const snap of postSnaps) {
      if (snap && snap.exists()) {
        const item = mapDocToPost(snap, viewerState);
        item.isSaved = true;
        results.push(item);
      }
    }
    return results;
  }

  subscribeLatestPosts(
    pageSize: number,
    onPosts: (posts: PostItem[], lastCursor: QueryDocumentSnapshot<DocumentData> | null) => void,
    onError: (err: Error) => void
  ): Unsubscribe {
    let activeUnsub: Unsubscribe | null = null;
    let cancelled = false;

    const indexedQuery = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    activeUnsub = onSnapshot(
      indexedQuery,
      (snap) => {
        const posts = snap.docs.map((d) => mapDocToPost(d));
        const lastCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        onPosts(posts, lastCursor);
      },
      (error) => {
        if (isMissingIndexError(error) && !cancelled) {
          const fallbackQuery = query(
            collection(db, 'posts'),
            where('visibility', '==', 'public'),
            limit(pageSize)
          );
          activeUnsub = onSnapshot(
            fallbackQuery,
            (snap) => {
              const sorted = sortDocsByCreatedAt(snap.docs, 'desc');
              const posts = sorted.map((d) => mapDocToPost(d));
              onPosts(posts, null);
            },
            (fallbackErr) => {
              try {
                handleFirestoreError(fallbackErr, OperationType.LIST, 'posts');
              } catch (wrapped) {
                onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
              }
            }
          );
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'posts');
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      cancelled = true;
      activeUnsub?.();
    };
  }

  async fetchStories(): Promise<StoryItem[]> {
    const q = query(
      collection(db, 'stories'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    try {
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapDocToStory(d));
    } catch (error) {
      if (isMissingIndexError(error)) {
        try {
          const fallbackSnap = await getDocs(
            query(
              collection(db, 'stories'),
              where('visibility', '==', 'public'),
              limit(20)
            )
          );
          return sortDocsByCreatedAt(fallbackSnap.docs, 'desc').map((d) =>
            mapDocToStory(d)
          );
        } catch (fallbackErr) {
          handleFirestoreError(fallbackErr, OperationType.LIST, 'stories');
        }
      }
      handleFirestoreError(error, OperationType.LIST, 'stories');
    }
  }

  async createStory(params: {
    author: PublicCreatorProfile;
    caption: string;
    imageUrl: string;
  }): Promise<StoryItem> {
    const storyRef = doc(collection(db, 'stories'));
    const cleanCaption = params.caption.trim().slice(0, 180);
    const cleanImageUrl = sanitizeUrl(params.imageUrl);
    if (!cleanCaption) {
      throw new Error('Story caption cannot be empty.');
    }

    const payload = {
      authorId: params.author.uid,
      authorName: params.author.displayName.trim().slice(0, 60),
      authorHandle: params.author.handle,
      authorAvatar: sanitizeUrl(params.author.avatarUrl),
      caption: cleanCaption,
      imageUrl: cleanImageUrl,
      accentTheme: 'aurora' as const,
      visibility: 'public' as const,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(storyRef, payload);
      return {
        id: storyRef.id,
        authorId: payload.authorId,
        authorName: payload.authorName,
        authorHandle: payload.authorHandle,
        initials: computeInitials(payload.authorName),
        avatarGradient: gradientForUid(payload.authorId),
        avatarUrl: payload.authorAvatar || undefined,
        caption: payload.caption,
        imageUrl: payload.imageUrl,
        timestampLabel: 'Just now',
        viewed: false,
        isPreviewSample: false,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `stories/${storyRef.id}`);
    }
  }

  async createPost(params: {
    author: PublicCreatorProfile;
    content: string;
    topic: OneHubTopic;
    hashtags: string[];
    imageUrl: string;
  }): Promise<PostItem> {
    const postRef = doc(collection(db, 'posts'));
    const cleanContent = params.content.trim().slice(0, 1000);
    if (!cleanContent) {
      throw new Error('Post caption cannot be empty.');
    }

    const cleanImageUrl = sanitizeUrl(params.imageUrl);
    const cleanHashtags = Array.from(
      new Set([
        ...params.hashtags,
        ...extractHashtagsFromText(cleanContent),
      ])
    )
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`).replace(/[^#a-zA-Z0-9_]/g, '').slice(0, 38))
      .filter((tag) => tag.length > 1)
      .slice(0, 10);

    const mediaType: 'image' | 'none' = cleanImageUrl ? 'image' : 'none';
    const topic = sanitizeTopic(params.topic);

    const payload = {
      authorId: params.author.uid,
      authorName: params.author.displayName.trim().slice(0, 60),
      authorHandle: params.author.handle,
      authorAvatar: sanitizeUrl(params.author.avatarUrl),
      content: cleanContent,
      topic,
      hashtags: cleanHashtags,
      mediaType,
      imageUrl: cleanImageUrl,
      visibility: 'public' as const,
      likesCount: 0,
      commentsCount: 0,
      lastCommentId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(postRef, payload);
      return {
        id: postRef.id,
        author: {
          uid: payload.authorId,
          displayName: payload.authorName,
          handle: payload.authorHandle,
          initials: computeInitials(payload.authorName),
          avatarGradient: gradientForUid(payload.authorId),
          avatarUrl: payload.authorAvatar || undefined,
          isFollowed: false,
        },
        content: payload.content,
        topic: payload.topic,
        hashtags: payload.hashtags,
        mediaType: payload.mediaType,
        mediaUrl: payload.imageUrl || undefined,
        mediaAlt: payload.imageUrl ? `Image posted by ${payload.authorName}` : undefined,
        timestampLabel: 'Just now',
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
        isSaved: false,
        comments: [],
        commentsLoaded: true,
        isPreviewSample: false,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postRef.id}`);
    }
  }

  async deletePost(postId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  }

  async toggleLike(params: {
    postId: string;
    postAuthorId: string;
    actor: PublicCreatorProfile;
    currentlyLiked: boolean;
    currentLikesCount: number;
  }): Promise<void> {
    const likeId = `${params.postId}_${params.actor.uid}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', params.postId);

    const batch = writeBatch(db);
    if (params.currentlyLiked) {
      batch.delete(likeRef);
      batch.update(postRef, {
        likesCount: Math.max(0, params.currentLikesCount - 1),
      });
    } else {
      batch.set(likeRef, {
        postId: params.postId,
        userId: params.actor.uid,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, {
        likesCount: params.currentLikesCount + 1,
      });

      if (params.postAuthorId && params.postAuthorId !== params.actor.uid) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          recipientId: params.postAuthorId,
          actorId: params.actor.uid,
          actorName: params.actor.displayName.slice(0, 60),
          actorHandle: params.actor.handle,
          type: 'like',
          postId: params.postId,
          message: 'liked your post.',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `likes/${likeId}`);
    }
  }

  async fetchComments(postId: string): Promise<CommentItem[]> {
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    try {
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapDocToComment(d));
    } catch (error) {
      if (isMissingIndexError(error)) {
        try {
          const fallbackSnap = await getDocs(
            query(
              collection(db, 'comments'),
              where('visibility', '==', 'public'),
              limit(80)
            )
          );
          const matching = sortDocsByCreatedAt(
            fallbackSnap.docs.filter((d) => d.data().postId === postId),
            'asc'
          );
          return matching.map((d) => mapDocToComment(d));
        } catch (fallbackErr) {
          handleFirestoreError(fallbackErr, OperationType.LIST, `comments?postId=${postId}`);
        }
      }
      handleFirestoreError(error, OperationType.LIST, `comments?postId=${postId}`);
    }
  }

  async addComment(params: {
    postId: string;
    postAuthorId: string;
    actor: PublicCreatorProfile;
    text: string;
    currentCommentsCount: number;
  }): Promise<CommentItem> {
    const cleanText = params.text.trim().slice(0, 400);
    if (!cleanText) {
      throw new Error('Comment cannot be empty.');
    }

    const commentRef = doc(collection(db, 'comments'));
    const postRef = doc(db, 'posts', params.postId);

    const batch = writeBatch(db);
    batch.set(commentRef, {
      postId: params.postId,
      authorId: params.actor.uid,
      authorName: params.actor.displayName.trim().slice(0, 60),
      authorHandle: params.actor.handle,
      authorAvatar: sanitizeUrl(params.actor.avatarUrl),
      text: cleanText,
      visibility: 'public',
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, {
      commentsCount: params.currentCommentsCount + 1,
      lastCommentId: commentRef.id,
    });

    if (params.postAuthorId && params.postAuthorId !== params.actor.uid) {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: params.postAuthorId,
        actorId: params.actor.uid,
        actorName: params.actor.displayName.slice(0, 60),
        actorHandle: params.actor.handle,
        type: 'comment',
        postId: params.postId,
        message: `commented: "${cleanText.slice(0, 120)}"`,
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      return {
        id: commentRef.id,
        postId: params.postId,
        authorId: params.actor.uid,
        authorName: params.actor.displayName,
        authorHandle: params.actor.handle,
        initials: computeInitials(params.actor.displayName),
        avatarGradient: gradientForUid(params.actor.uid),
        avatarUrl: params.actor.avatarUrl || undefined,
        text: cleanText,
        timestampLabel: 'Just now',
        isPreviewSample: false,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `comments/${commentRef.id}`);
    }
  }

  async toggleSave(params: {
    postId: string;
    userId: string;
    currentlySaved: boolean;
  }): Promise<void> {
    const savedId = `${params.userId}_${params.postId}`;
    const savedRef = doc(db, 'savedPosts', savedId);
    try {
      if (params.currentlySaved) {
        await deleteDoc(savedRef);
      } else {
        await setDoc(savedRef, {
          userId: params.userId,
          postId: params.postId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        params.currentlySaved ? OperationType.DELETE : OperationType.CREATE,
        `savedPosts/${savedId}`
      );
    }
  }

  async toggleFollow(params: {
    follower: PublicCreatorProfile;
    targetUid: string;
    currentlyFollowing: boolean;
  }): Promise<void> {
    if (params.follower.uid === params.targetUid) {
      throw new Error('You cannot follow your own account.');
    }
    const followId = `${params.follower.uid}_${params.targetUid}`;
    const followRef = doc(db, 'follows', followId);

    const batch = writeBatch(db);
    if (params.currentlyFollowing) {
      batch.delete(followRef);
    } else {
      batch.set(followRef, {
        followerId: params.follower.uid,
        followingId: params.targetUid,
        createdAt: serverTimestamp(),
      });
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: params.targetUid,
        actorId: params.follower.uid,
        actorName: params.follower.displayName.slice(0, 60),
        actorHandle: params.follower.handle,
        type: 'follow',
        postId: '',
        message: 'started following you.',
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `follows/${followId}`);
    }
  }

  async fetchFollowCounts(uid: string): Promise<{ followers: number; following: number }> {
    try {
      const [followersSnap, followingSnap] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followingId', '==', uid))),
        getDocs(query(collection(db, 'follows'), where('followerId', '==', uid))),
      ]);
      return {
        followers: followersSnap.size,
        following: followingSnap.size,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'follows');
    }
  }

  subscribeNotifications(
    uid: string,
    onNotifications: (items: NotificationItem[]) => void,
    onError: (err: Error) => void
  ): Unsubscribe {
    let activeUnsub: Unsubscribe | null = null;
    let cancelled = false;

    const indexedQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    activeUnsub = onSnapshot(
      indexedQuery,
      (snap) => {
        onNotifications(snap.docs.map((d) => mapDocToNotification(d)));
      },
      (error) => {
        if (isMissingIndexError(error) && !cancelled) {
          const fallbackQuery = query(
            collection(db, 'notifications'),
            where('recipientId', '==', uid),
            limit(30)
          );
          activeUnsub = onSnapshot(
            fallbackQuery,
            (snap) => {
              onNotifications(
                sortDocsByCreatedAt(snap.docs, 'desc').map((d) =>
                  mapDocToNotification(d)
                )
              );
            },
            (fallbackErr) => {
              try {
                handleFirestoreError(fallbackErr, OperationType.LIST, 'notifications');
              } catch (wrapped) {
                onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
              }
            }
          );
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'notifications');
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      cancelled = true;
      activeUnsub?.();
    };
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  }

  async markAllNotificationsRead(unreadIds: string[]): Promise<void> {
    if (unreadIds.length === 0) return;
    const batch = writeBatch(db);
    for (const id of unreadIds) {
      batch.update(doc(db, 'notifications', id), { read: true });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  }

  async fetchUserPrivate(uid: string): Promise<UserPrivateProfile | null> {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        uid: String(d.uid || uid),
        email: String(d.email || ''),
        displayName: String(d.displayName || 'ONEHUB Member'),
        handle: String(d.handle || ''),
        bio: String(d.bio || ''),
        avatarUrl: String(d.avatarUrl || ''),
        location: String(d.location || ''),
        website: String(d.website || ''),
        language: String(d.language || 'en'),
        interests: Array.isArray(d.interests)
          ? d.interests.filter((x): x is string => typeof x === 'string')
          : [],
        isPrivateAccount: Boolean(d.isPrivateAccount),
        lowDataMode: Boolean(d.lowDataMode),
        onboardingCompleted: Boolean(d.onboardingCompleted),
        role: 'member',
        createdAtMs: timestampToMs(d.createdAt),
        updatedAtMs: timestampToMs(d.updatedAt),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  }

  async fetchPublicProfile(uid: string): Promise<PublicCreatorProfile | null> {
    try {
      const snap = await getDoc(doc(db, 'publicProfiles', uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        uid: String(d.uid || uid),
        displayName: String(d.displayName || 'ONEHUB Member'),
        handle: String(d.handle || ''),
        bio: String(d.bio || ''),
        avatarUrl: String(d.avatarUrl || ''),
        location: String(d.location || ''),
        website: String(d.website || ''),
        language: String(d.language || 'en'),
        interests: Array.isArray(d.interests)
          ? d.interests.filter((x): x is string => typeof x === 'string')
          : [],
        isPublic: d.isPublic !== false,
        createdAtMs: timestampToMs(d.createdAt),
        updatedAtMs: timestampToMs(d.updatedAt),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `publicProfiles/${uid}`);
    }
  }

  async isHandleAvailable(handle: string, currentUid?: string): Promise<boolean> {
    const clean = normalizeHandle(handle);
    if (!isValidHandleFormat(clean)) return false;
    try {
      const snap = await getDoc(doc(db, 'handles', clean));
      if (!snap.exists()) return true;
      return Boolean(currentUid && snap.data().uid === currentUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `handles/${clean}`);
    }
  }

  async createUserProfile(params: {
    uid: string;
    email: string;
    displayName: string;
    handle: string;
    bio?: string;
    avatarUrl?: string;
    language: string;
    interests: string[];
    onboardingCompleted: boolean;
  }): Promise<{ privateProfile: UserPrivateProfile; publicProfile: PublicCreatorProfile }> {
    const cleanHandle = normalizeHandle(params.handle);
    if (!isValidHandleFormat(cleanHandle)) {
      throw new Error('Username must be 2–32 characters using lowercase letters, numbers, or underscores.');
    }

    const available = await this.isHandleAvailable(cleanHandle, params.uid);
    if (!available) {
      throw new Error(`@${cleanHandle} is already taken. Please try another username.`);
    }

    const cleanName = params.displayName.trim().slice(0, 60) || 'ONEHUB Member';
    const cleanBio = (params.bio || '').trim().slice(0, 240);
    const cleanAvatar = sanitizeUrl(params.avatarUrl);
    const cleanLanguage = (params.language || 'en').slice(0, 16);
    const cleanInterests = params.interests.map((x) => x.slice(0, 40)).slice(0, 10);

    const batch = writeBatch(db);
    batch.set(doc(db, 'handles', cleanHandle), {
      handle: cleanHandle,
      uid: params.uid,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', params.uid), {
      uid: params.uid,
      email: params.email.trim().slice(0, 160),
      displayName: cleanName,
      handle: cleanHandle,
      bio: cleanBio,
      avatarUrl: cleanAvatar,
      location: '',
      website: '',
      language: cleanLanguage,
      interests: cleanInterests,
      isPrivateAccount: false,
      lowDataMode: false,
      onboardingCompleted: params.onboardingCompleted,
      role: 'member',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'publicProfiles', params.uid), {
      uid: params.uid,
      displayName: cleanName,
      handle: cleanHandle,
      bio: cleanBio,
      avatarUrl: cleanAvatar,
      location: '',
      website: '',
      language: cleanLanguage,
      interests: cleanInterests,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      const now = Date.now();
      return {
        privateProfile: {
          uid: params.uid,
          email: params.email.trim().slice(0, 160),
          displayName: cleanName,
          handle: cleanHandle,
          bio: cleanBio,
          avatarUrl: cleanAvatar,
          location: '',
          website: '',
          language: cleanLanguage,
          interests: cleanInterests,
          isPrivateAccount: false,
          lowDataMode: false,
          onboardingCompleted: params.onboardingCompleted,
          role: 'member',
          createdAtMs: now,
          updatedAtMs: now,
        },
        publicProfile: {
          uid: params.uid,
          displayName: cleanName,
          handle: cleanHandle,
          bio: cleanBio,
          avatarUrl: cleanAvatar,
          location: '',
          website: '',
          language: cleanLanguage,
          interests: cleanInterests,
          isPublic: true,
          createdAtMs: now,
          updatedAtMs: now,
        },
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${params.uid}`);
    }
  }

  async updateUserProfile(params: {
    uid: string;
    currentHandle: string;
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string;
    location: string;
    website: string;
    language: string;
    interests: string[];
    isPrivateAccount: boolean;
    lowDataMode: boolean;
    onboardingCompleted: boolean;
  }): Promise<void> {
    const cleanHandle = normalizeHandle(params.handle);
    if (!isValidHandleFormat(cleanHandle)) {
      throw new Error('Username must be 2–32 characters using lowercase letters, numbers, or underscores.');
    }

    const handleChanged = cleanHandle !== params.currentHandle;
    if (handleChanged) {
      const available = await this.isHandleAvailable(cleanHandle, params.uid);
      if (!available) {
        throw new Error(`@${cleanHandle} is already taken. Please choose another username.`);
      }
    }

    const cleanName = params.displayName.trim().slice(0, 60);
    if (!cleanName) {
      throw new Error('Display name is required.');
    }
    const cleanBio = params.bio.trim().slice(0, 240);
    const cleanAvatar = sanitizeUrl(params.avatarUrl);
    const cleanLocation = params.location.trim().slice(0, 80);
    const cleanWebsite = sanitizeUrl(params.website);
    const cleanLanguage = (params.language || 'en').slice(0, 16);
    const cleanInterests = params.interests.map((x) => x.slice(0, 40)).slice(0, 10);

    const batch = writeBatch(db);
    if (handleChanged) {
      if (params.currentHandle && isValidHandleFormat(params.currentHandle)) {
        batch.delete(doc(db, 'handles', params.currentHandle));
      }
      batch.set(doc(db, 'handles', cleanHandle), {
        handle: cleanHandle,
        uid: params.uid,
        createdAt: serverTimestamp(),
      });
    }

    batch.update(doc(db, 'users', params.uid), {
      displayName: cleanName,
      handle: cleanHandle,
      bio: cleanBio,
      avatarUrl: cleanAvatar,
      location: cleanLocation,
      website: cleanWebsite,
      language: cleanLanguage,
      interests: cleanInterests,
      isPrivateAccount: params.isPrivateAccount,
      lowDataMode: params.lowDataMode,
      onboardingCompleted: params.onboardingCompleted,
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'publicProfiles', params.uid), {
      displayName: cleanName,
      handle: cleanHandle,
      bio: cleanBio,
      avatarUrl: cleanAvatar,
      location: cleanLocation,
      website: cleanWebsite,
      language: cleanLanguage,
      interests: cleanInterests,
      isPublic: !params.isPrivateAccount,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${params.uid}`);
    }
  }
}

export const activeDataAdapter: OneHubDataAdapter = new OneHubFirebaseAdapter();

export const FIREBASE_ARCHITECTURE_STATUS = {
  connected: FIREBASE_CONFIG_SUMMARY.hasValidConfig,
  projectId: FIREBASE_CONFIG_SUMMARY.projectId,
  firestoreDatabaseId: FIREBASE_CONFIG_SUMMARY.firestoreDatabaseId,
  storageBucketConfigured: FIREBASE_CONFIG_SUMMARY.hasStorageBucket,
  blueprintFile: 'firebase-blueprint.json',
  indexesFile: 'firestore.indexes.json',
  securityRulesFile: 'firestore.rules',
  storageRulesFile: 'storage.rules',
} as const;
