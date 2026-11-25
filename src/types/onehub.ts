export type NavSection = 'home' | 'explore' | 'create' | 'shorts' | 'profile';

export type FeedTab = 'for-you' | 'following';

export type FeedViewState = 'ready' | 'loading' | 'empty' | 'error';

export type MediaType = 'none' | 'image' | 'video-preview';

export const ONEHUB_TOPICS = [
  'Design',
  'Technology',
  'Photography',
  'Audio',
  'Cinema',
  'Ideas',
  'Community',
  'Lifestyle',
] as const;

export type OneHubTopic = (typeof ONEHUB_TOPICS)[number];

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

export const ONEHUB_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
];

export interface UserPrivateProfile {
  uid: string;
  email: string;
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
  role: 'member';
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PublicCreatorProfile {
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  location: string;
  website: string;
  language: string;
  interests: string[];
  isPublic: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CreatorIdentity {
  uid: string;
  displayName: string;
  handle: string;
  initials: string;
  avatarGradient: string;
  avatarUrl?: string;
  roleLabel?: string;
  isFollowed: boolean;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  initials: string;
  avatarGradient: string;
  avatarUrl?: string;
  caption: string;
  imageUrl: string;
  timestampLabel: string;
  viewed: boolean;
  isPreviewSample: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  authorId?: string;
  authorName: string;
  authorHandle: string;
  initials: string;
  avatarGradient: string;
  avatarUrl?: string;
  text: string;
  timestampLabel: string;
  isPreviewSample: boolean;
}

export interface PostItem {
  id: string;
  author: CreatorIdentity;
  content: string;
  topic: string;
  hashtags: string[];
  mediaType: MediaType;
  mediaUrl?: string;
  mediaAlt?: string;
  videoDurationLabel?: string;
  timestampLabel: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  comments: CommentItem[];
  commentsLoaded?: boolean;
  isPreviewSample: boolean;
}

export interface TrendingTopic {
  id: string;
  hashtag: string;
  category: string;
  volumeLabel: string;
  summary: string;
}

export interface NotificationItem {
  id: string;
  actorName: string;
  actorHandle: string;
  initials: string;
  avatarGradient: string;
  type: 'like' | 'comment' | 'follow';
  postId?: string;
  message: string;
  timestampLabel: string;
  read: boolean;
  isPreviewSample: boolean;
}
