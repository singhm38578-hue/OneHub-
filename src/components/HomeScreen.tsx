import React from 'react';
import { Bookmark, Loader2, X } from 'lucide-react';
import type {
  FeedTab,
  FeedViewState,
  PostItem,
  StoryItem,
  TrendingTopic,
} from '../types/onehub';
import { FeedEmptyState, FeedErrorState, FeedLoadingState } from './FeedStates';
import { PostCard } from './PostCard';
import { StoriesBar } from './StoriesBar';
import { TrendingPanel } from './TrendingPanel';

interface HomeScreenProps {
  currentUserId?: string | null;
  lowDataMode?: boolean;
  stories: StoryItem[];
  posts: PostItem[];
  trending: TrendingTopic[];
  feedTab: FeedTab;
  onChangeFeedTab: (tab: FeedTab) => void;
  feedState: FeedViewState;
  feedErrorMessage?: string | null;
  onRetryFeed: () => void;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;
  onLoadMorePosts: () => void;
  searchQuery: string;
  onClearSearch: () => void;
  activeHashtag: string | null;
  onSelectHashtag: (hashtag: string | null) => void;
  onOpenExplore: () => void;
  onOpenCreate: () => void;
  savedOnly: boolean;
  onToggleSavedOnly: () => void;
  onViewStory: (storyId: string) => void;
  onAddStory: (caption: string, imageUrl: string) => Promise<void>;
  onToggleLike: (post: PostItem) => void;
  onToggleSave: (post: PostItem) => void;
  onToggleFollow: (creatorUid: string, currentlyFollowing: boolean) => void;
  onLoadComments: (postId: string) => Promise<void>;
  onAddComment: (post: PostItem, text: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onSharePost: (post: PostItem) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUserId,
  lowDataMode = false,
  stories,
  posts,
  trending,
  feedTab,
  onChangeFeedTab,
  feedState,
  feedErrorMessage,
  onRetryFeed,
  hasMorePosts,
  loadingMorePosts,
  onLoadMorePosts,
  searchQuery,
  onClearSearch,
  activeHashtag,
  onSelectHashtag,
  onOpenExplore,
  onOpenCreate,
  savedOnly,
  onToggleSavedOnly,
  onViewStory,
  onAddStory,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onLoadComments,
  onAddComment,
  onDeletePost,
  onSharePost,
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPosts = posts.filter((post) => {
    if (feedTab === 'following' && !post.author.isFollowed) {
      return false;
    }
    if (savedOnly && !post.isSaved) {
      return false;
    }
    if (
      activeHashtag &&
      !post.hashtags.some(
        (tag) => tag.toLowerCase() === activeHashtag.toLowerCase()
      )
    ) {
      return false;
    }
    if (normalizedQuery) {
      const haystack = `${post.author.displayName} ${post.author.handle} ${post.topic} ${post.content}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });

  const hasActiveFilters = Boolean(normalizedQuery || activeHashtag || savedOnly);

  const resetFilters = () => {
    onClearSearch();
    onSelectHashtag(null);
    if (savedOnly) onToggleSavedOnly();
    if (feedTab === 'following') onChangeFeedTab('for-you');
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Compact Horizontal Stories Strip */}
      <StoriesBar
        stories={stories}
        onViewStory={onViewStory}
        onAddStory={onAddStory}
      />

      {/* Compact Mobile Trending Chips with Explore Navigation */}
      <TrendingPanel
        topics={trending}
        activeHashtag={activeHashtag}
        onSelectHashtag={onSelectHashtag}
        onOpenExplore={onOpenExplore}
        variant="strip"
      />

      {/* Feed Tabs + Saved Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7EAF3] pb-2.5">
        <div
          role="tablist"
          aria-label="Feed view"
          className="inline-flex items-center rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] p-1 shadow-[0_1px_4px_rgba(17,24,39,0.03)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={feedTab === 'for-you'}
            onClick={() => onChangeFeedTab('for-you')}
            className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all duration-150 sm:px-4 sm:text-sm ${
              feedTab === 'for-you'
                ? 'elegance-gradient text-white shadow-sm'
                : 'text-[#687386] hover:text-[#111827]'
            }`}
          >
            For You
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={feedTab === 'following'}
            onClick={() => onChangeFeedTab('following')}
            className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all duration-150 sm:px-4 sm:text-sm ${
              feedTab === 'following'
                ? 'elegance-gradient text-white shadow-sm'
                : 'text-[#687386] hover:text-[#111827]'
            }`}
          >
            Following
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleSavedOnly}
          aria-pressed={savedOnly}
          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium whitespace-nowrap transition-all ${
            savedOnly
              ? 'bg-[#805CFF] text-white shadow-sm'
              : 'border border-[#E7EAF3] bg-[#FFFFFF] text-[#687386] hover:border-[#805CFF]/40 hover:text-[#111827]'
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${savedOnly ? 'fill-current' : ''}`} />
          <span>Saved</span>
        </button>
      </div>

      {/* Active Search / Hashtag Filter Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#5366FF]/25 bg-[#FFFFFF] px-3.5 py-2 text-xs text-[#111827] shadow-[0_2px_8px_rgba(83,102,255,0.06)]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-[#5366FF]">Active filter</span>
            {activeHashtag && <span>Topic {activeHashtag}</span>}
            {normalizedQuery && <span>Search “{searchQuery.trim()}”</span>}
            {savedOnly && <span>Saved posts only</span>}
            <span className="text-[#687386]">
              · <span className="font-mono tabular-nums">{filteredPosts.length}</span> shown
            </span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-[36px] items-center gap-1 font-medium text-[#5366FF] hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* Feed Content */}
      {feedState === 'loading' ? (
        <FeedLoadingState />
      ) : feedState === 'error' ? (
        <FeedErrorState
          message={
            feedErrorMessage ||
            'Could not load posts from Cloud Firestore right now. Check your connection or security rules.'
          }
          onRetry={onRetryFeed}
        />
      ) : filteredPosts.length === 0 ? (
        <FeedEmptyState
          title={
            savedOnly
              ? 'No saved posts yet'
              : feedTab === 'following'
              ? 'No posts from followed creators'
              : posts.length === 0
              ? 'Be the first to post on ONEHUB'
              : 'No matching posts'
          }
          description={
            savedOnly
              ? 'Tap the bookmark icon on any post to keep it in your private saved collection.'
              : feedTab === 'following'
              ? 'Follow creators from the For You tab to populate your Following stream.'
              : posts.length === 0
              ? 'Your live Firestore feed is ready. Tap Create below to publish the first post.'
              : 'Try clearing your search query or selecting a different hashtag.'
          }
          actionLabel={posts.length === 0 ? 'Create your first post' : 'View For You feed'}
          onAction={posts.length === 0 ? onOpenCreate : resetFilters}
        />
      ) : (
        <div className="space-y-3.5 sm:space-y-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              lowDataMode={lowDataMode}
              onToggleLike={() => onToggleLike(post)}
              onToggleSave={() => onToggleSave(post)}
              onToggleFollow={() => onToggleFollow(post.author.uid, post.author.isFollowed)}
              onLoadComments={onLoadComments}
              onAddComment={(text) => onAddComment(post, text)}
              onDeletePost={
                currentUserId && post.author.uid === currentUserId
                  ? onDeletePost
                  : undefined
              }
              onShare={onSharePost}
              onSelectHashtag={(tag) => onSelectHashtag(tag)}
            />
          ))}

          {/* Pagination Control */}
          {hasMorePosts && !hasActiveFilters && feedTab === 'for-you' && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                disabled={loadingMorePosts}
                onClick={onLoadMorePosts}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E7EAF3] bg-[#FFFFFF] px-5 text-xs font-semibold text-[#111827] shadow-sm transition-colors hover:border-[#5366FF]/45 hover:text-[#5366FF] disabled:opacity-55"
              >
                {loadingMorePosts && <Loader2 className="h-4 w-4 animate-spin text-[#5366FF]" />}
                <span>{loadingMorePosts ? 'Loading more...' : 'Load more posts'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
