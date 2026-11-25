import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Send,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import type { PostItem } from '../types/onehub';

interface PostCardProps {
  post: PostItem;
  currentUserId?: string | null;
  lowDataMode?: boolean;
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onToggleFollow: (creatorUid: string) => void;
  onLoadComments?: (postId: string) => Promise<void>;
  onAddComment: (text: string) => Promise<void> | void;
  onDeletePost?: (postId: string) => Promise<void> | void;
  onShare: (post: PostItem) => void;
  onSelectHashtag: (hashtag: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  lowDataMode = false,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onLoadComments,
  onAddComment,
  onDeletePost,
  onShare,
  onSelectHashtag,
}) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [mediaFailed, setMediaFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [revealMediaInLowData, setRevealMediaInLowData] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [previewProgress, setPreviewProgress] = useState(28);

  const isOwnPost = Boolean(currentUserId && post.author.uid === currentUserId);

  useEffect(() => {
    if (!isPlayingPreview) return;
    const interval = window.setInterval(() => {
      setPreviewProgress((prev) => (prev >= 100 ? 0 : prev + 2));
    }, 220);
    return () => window.clearInterval(interval);
  }, [isPlayingPreview]);

  const handleToggleComments = async () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && !post.commentsLoaded && onLoadComments) {
      setLoadingComments(true);
      try {
        await onLoadComments(post.id);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = commentText.trim();
    if (!cleaned || submittingComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(cleaned);
      setCommentText('');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeletePost || deleting) return;
    setDeleting(true);
    try {
      await onDeletePost(post.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const renderRichText = (text: string) => {
    const tokens = text.split(/(#[a-zA-Z0-9_]+)/g);
    return tokens.map((token, idx) => {
      if (token.startsWith('#')) {
        return (
          <button
            key={`${token}-${idx}`}
            type="button"
            onClick={() => onSelectHashtag(token)}
            className="font-medium text-[#5366FF] underline-offset-4 hover:text-[#805CFF] hover:underline"
          >
            {token}
          </button>
        );
      }
      return <React.Fragment key={idx}>{token}</React.Fragment>;
    });
  };

  return (
    <article className="elegance-card overflow-hidden rounded-2xl p-4 sm:p-5">
      {/* Author Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {post.author.avatarUrl && !avatarFailed ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#E7EAF3]"
            />
          ) : (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${post.author.avatarGradient} font-[family-name:var(--font-display)] text-sm font-bold text-white shadow-sm`}
              aria-hidden="true"
            >
              {post.author.initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold text-[#111827]">
                {post.author.displayName}
              </h3>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[#687386]">
              <span className="truncate">@{post.author.handle}</span>
              <span aria-hidden="true">·</span>
              <span>{post.timestampLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#805CFF]">{post.topic}</span>
            </p>
          </div>
        </div>

        {isOwnPost ? (
          onDeletePost && (
            confirmDelete ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                  className="min-h-[36px] rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[36px] rounded-xl border border-[#E7EAF3] px-2.5 text-xs font-medium text-[#687386] hover:text-[#111827]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete post"
                className="flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-xl text-[#687386] transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )
          )
        ) : (
          <button
            type="button"
            onClick={() => onToggleFollow(post.author.uid)}
            className={`min-h-[38px] shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 ${
              post.author.isFollowed
                ? 'border border-[#E7EAF3] bg-[#F7F8FC] text-[#111827] hover:border-[#5366FF]/40 hover:text-[#5366FF]'
                : 'elegance-gradient text-white shadow-sm hover:opacity-95'
            }`}
          >
            {post.author.isFollowed ? 'Following' : 'Follow'}
          </button>
        )}
      </header>

      {/* Post Copy */}
      <p className="mt-3.5 whitespace-pre-wrap text-[15px] leading-relaxed text-[#111827]">
        {renderRichText(post.content)}
      </p>

      {/* Media Stage */}
      {post.mediaType !== 'none' && post.mediaUrl && (
        <div className="relative mt-4 overflow-hidden rounded-xl border border-[#E7EAF3] bg-[#F7F8FC]">
          {lowDataMode && !revealMediaInLowData ? (
            <button
              type="button"
              onClick={() => setRevealMediaInLowData(true)}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-[#F7F8FC] p-6 text-center transition-colors hover:bg-[#FFFFFF]"
            >
              <Wifi className="h-6 w-6 text-[#06B6D4]" />
              <span className="text-xs font-semibold text-[#111827]">
                Low-Data Mode · Tap to load photo
              </span>
              <span className="text-[11px] text-[#687386]">
                Saves mobile data until you choose to view media
              </span>
            </button>
          ) : !mediaFailed ? (
            <img
              src={post.mediaUrl}
              alt={post.mediaAlt || `Visual attachment by ${post.author.displayName}`}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setMediaFailed(true)}
              className={`max-h-[420px] w-full object-cover transition-transform duration-300 ${
                isPlayingPreview ? 'scale-[1.03]' : 'scale-100'
              }`}
            />
          ) : (
            <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F7F8FC] via-[#FFFFFF] to-[#E7EAF3]/60 p-6 text-center">
              <ImageIcon className="h-7 w-7 text-[#5366FF]" />
              <p className="text-xs font-medium text-[#687386]">
                {post.mediaAlt || 'Image unavailable'}
              </p>
            </div>
          )}

          {post.mediaType === 'video-preview' && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111827]/80 via-transparent to-[#111827]/25" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlayingPreview((p) => !p)}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FFFFFF]/95 px-3.5 text-xs font-semibold text-[#111827] shadow-sm backdrop-blur-md transition-transform duration-150 hover:bg-[#FFFFFF] active:scale-95"
                    aria-label={isPlayingPreview ? 'Pause video' : 'Play video'}
                  >
                    {isPlayingPreview ? (
                      <Pause className="h-4 w-4 text-[#5366FF]" />
                    ) : (
                      <Play className="h-4 w-4 fill-[#5366FF] text-[#5366FF]" />
                    )}
                    <span>{isPlayingPreview ? 'Pause' : 'Play'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-white/95">
                      {post.videoDurationLabel || '0:30'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMuted((m) => !m)}
                      aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#111827]/65 text-white backdrop-blur-md hover:bg-[#111827]/85"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-[#06B6D4]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5366FF] via-[#805CFF] to-[#06B6D4] transition-[width] duration-200"
                    style={{ width: `${previewProgress}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Bar */}
      <footer className="mt-4 flex items-center justify-between border-t border-[#E7EAF3] pt-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onToggleLike(post.id)}
            aria-pressed={post.isLiked}
            aria-label={post.isLiked ? 'Unlike post' : 'Like post'}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
              post.isLiked
                ? 'text-[#5366FF]'
                : 'text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]'
            }`}
          >
            <Heart
              className={`h-[19px] w-[19px] transition-transform duration-150 ${
                post.isLiked ? 'scale-110 fill-[#5366FF] text-[#5366FF]' : ''
              }`}
            />
            <span className="font-mono text-xs tabular-nums">
              {post.likesCount.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleToggleComments()}
            aria-expanded={commentsOpen}
            aria-label="Toggle comments"
            className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition-colors duration-150 ${
              commentsOpen
                ? 'text-[#805CFF]'
                : 'text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]'
            }`}
          >
            <MessageCircle className="h-[19px] w-[19px]" />
            <span className="font-mono text-xs tabular-nums">
              {post.commentsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onShare(post)}
            aria-label="Share post"
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-[#687386] transition-colors duration-150 hover:bg-[#F7F8FC] hover:text-[#111827] active:scale-95"
          >
            <Share2 className="h-[18px] w-[18px]" />
            <span className="hidden text-xs sm:inline">Share</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleSave(post.id)}
          aria-pressed={post.isSaved}
          aria-label={post.isSaved ? 'Remove from saved posts' : 'Save post'}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
            post.isSaved
              ? 'text-[#805CFF]'
              : 'text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]'
          }`}
        >
          <Bookmark
            className={`h-[19px] w-[19px] ${
              post.isSaved ? 'fill-[#805CFF] text-[#805CFF]' : ''
            }`}
          />
          <span className="hidden sm:inline">{post.isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </footer>

      {/* Expandable Inline Comments Drawer */}
      {commentsOpen && (
        <div className="mt-3 border-t border-[#E7EAF3] pt-3.5">
          {loadingComments ? (
            <div className="flex items-center gap-2 py-2 text-xs text-[#687386]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5366FF]" />
              <span>Loading comments...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {post.comments.length === 0 ? (
                <p className="text-xs text-[#687386]">
                  No comments yet. Start the conversation below.
                </p>
              ) : (
                post.comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    {comment.avatarUrl ? (
                      <img
                        src={comment.avatarUrl}
                        alt={comment.authorName}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${comment.avatarGradient} text-[10px] font-bold text-white`}
                      >
                        {comment.initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#687386]">
                        <span className="font-semibold text-[#111827]">
                          {comment.authorName}
                        </span>{' '}
                        · @{comment.authorHandle} · {comment.timestampLabel}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-[#111827]">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <form onSubmit={handleSubmitComment} className="mt-3.5 flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={400}
              placeholder="Write a comment..."
              aria-label="Write a comment"
              className="min-h-[44px] flex-1 rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] placeholder:text-[#687386]/75 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              aria-label="Post comment"
              className="elegance-gradient flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submittingComment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </article>
  );
};
