import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Play,
  Plus,
  X,
} from 'lucide-react';
import { STUDIO_MEDIA_ASSETS } from '../data/previewData';
import type { StoryItem } from '../types/onehub';

interface StoriesBarProps {
  stories: StoryItem[];
  onViewStory: (storyId: string) => void;
  onAddStory: (caption: string, imageUrl: string) => Promise<void>;
}

const STORY_BACKDROPS = [
  { label: 'Glass Observatory', url: STUDIO_MEDIA_ASSETS.auroraObservatory },
  { label: 'Twilight Pavilion', url: STUDIO_MEDIA_ASSETS.twilightPavilion },
  { label: 'Modular Studio', url: STUDIO_MEDIA_ASSETS.modularSynth },
  { label: 'Evening Fjord', url: STUDIO_MEDIA_ASSETS.midnightFjord },
];

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  onViewStory,
  onAddStory,
}) => {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const [selectedBackdrop, setSelectedBackdrop] = useState<string>(
    STORY_BACKDROPS[0].url
  );
  const [submitting, setSubmitting] = useState(false);
  const [imgErrorIds, setImgErrorIds] = useState<Record<string, boolean>>({});

  const activeStory =
    activeStoryIndex !== null ? stories[activeStoryIndex] ?? null : null;

  const unseenCount = stories.filter((s) => !s.viewed).length;

  const openStory = (index: number) => {
    const story = stories[index];
    if (!story) return;
    setActiveStoryIndex(index);
    onViewStory(story.id);
  };

  const handleStepStory = (delta: number) => {
    if (activeStoryIndex === null) return;
    const next = activeStoryIndex + delta;
    if (next < 0 || next >= stories.length) {
      setActiveStoryIndex(null);
      return;
    }
    openStory(next);
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftCaption.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAddStory(trimmed, selectedBackdrop);
      setDraftCaption('');
      setComposerOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="Stories" className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-[#111827]">
            Stories
          </h2>
          {unseenCount > 0 && (
            <span className="text-xs font-medium text-[#5366FF]">
              <span className="font-mono tabular-nums">{unseenCount}</span> new
            </span>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {/* Add Story Card */}
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="group flex w-[68px] shrink-0 snap-start flex-col items-center gap-1.5 text-center focus-visible:rounded-2xl"
          aria-label="Add story"
        >
          <span className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full border border-dashed border-[#5366FF]/50 bg-[#FFFFFF] shadow-[0_2px_8px_rgba(83,102,255,0.08)] transition-all duration-150 group-hover:border-[#5366FF] group-hover:bg-[#F7F8FC] group-active:scale-95">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F8FC] font-[family-name:var(--font-display)] text-xs font-bold text-[#5366FF]">
              You
            </span>
            <span className="elegance-gradient absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-[#FFFFFF]">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
            </span>
          </span>
          <span className="w-full truncate text-[11px] font-semibold text-[#111827]">
            Add Story
          </span>
        </button>

        {/* Creator Story Avatars with Gradient Rings & Clear Story Indicators */}
        {stories.map((story, idx) => (
          <button
            key={story.id}
            type="button"
            onClick={() => openStory(idx)}
            className="group flex w-[68px] shrink-0 snap-start flex-col items-center gap-1.5 text-center focus-visible:rounded-2xl"
            aria-label={`View story from ${story.authorName}${story.viewed ? ' (viewed)' : ' (new story)'}`}
          >
            <span
              className={`relative rounded-full p-[2.5px] transition-transform duration-150 group-active:scale-95 ${
                story.viewed
                  ? 'bg-[#E7EAF3]'
                  : 'bg-gradient-to-tr from-[#5366FF] via-[#805CFF] to-[#06B6D4] shadow-[0_3px_10px_rgba(83,102,255,0.2)]'
              }`}
            >
              <span className="relative block h-[55px] w-[55px] overflow-hidden rounded-full bg-[#FFFFFF] p-[2px]">
                <span
                  className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${story.avatarGradient}`}
                >
                  {story.avatarUrl && !imgErrorIds[`av-${story.id}`] ? (
                    <img
                      src={story.avatarUrl}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrorIds((prev) => ({ ...prev, [`av-${story.id}`]: true }))
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : !imgErrorIds[story.id] && story.imageUrl ? (
                    <>
                      <img
                        src={story.imageUrl}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setImgErrorIds((prev) => ({ ...prev, [story.id]: true }))
                        }
                        className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity transition-transform duration-200 group-hover:scale-110"
                      />
                      <span className="relative z-10 font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(17,24,39,0.35)]">
                        {story.initials}
                      </span>
                    </>
                  ) : (
                    <span className="font-[family-name:var(--font-display)] text-sm font-bold text-white">
                      {story.initials}
                    </span>
                  )}
                </span>
              </span>

              {!story.viewed && (
                <span
                  aria-hidden="true"
                  className="elegance-gradient absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white shadow-sm ring-2 ring-[#FFFFFF]"
                >
                  <Play className="ml-[1px] h-2.5 w-2.5 fill-current" />
                </span>
              )}
            </span>

            <span
              className={`w-full truncate text-[11px] ${
                story.viewed
                  ? 'font-normal text-[#687386]'
                  : 'font-semibold text-[#111827]'
              } group-hover:text-[#5366FF]`}
            >
              {story.authorName.split(' ')[0]}
            </span>
          </button>
        ))}

        {stories.length === 0 && (
          <div className="flex min-h-[60px] items-center px-1 text-xs text-[#687386]">
            No stories yet. Tap Add Story to share a moment.
          </div>
        )}
      </div>

      {/* Interactive Story Viewer Overlay */}
      {activeStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Story by ${activeStory.authorName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/70 p-4 backdrop-blur-md"
          onClick={() => setActiveStoryIndex(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#E7EAF3] bg-[#FFFFFF] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-4 right-4 top-3 z-20 flex gap-1.5">
              {stories.map((s, i) => (
                <div
                  key={s.id}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      i <= (activeStoryIndex ?? 0)
                        ? 'w-full bg-gradient-to-r from-[#5366FF] to-[#06B6D4]'
                        : 'w-0 bg-transparent'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="absolute left-4 right-4 top-7 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${activeStory.avatarGradient} text-xs font-bold text-white ring-2 ring-white/50`}
                >
                  {activeStory.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {activeStory.authorName}
                  </p>
                  <p className="text-xs text-white/80">
                    @{activeStory.authorHandle} · {activeStory.timestampLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStoryIndex(null)}
                aria-label="Close story viewer"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#111827]/55 text-white backdrop-blur-sm transition-colors hover:bg-[#111827]/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-[3/4] w-full bg-[#111827]">
              {!imgErrorIds[activeStory.id] && activeStory.imageUrl ? (
                <img
                  src={activeStory.imageUrl}
                  alt={activeStory.caption}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#5366FF] via-[#805CFF] to-[#06B6D4] p-8 text-center">
                  <ImageIcon className="h-8 w-8 text-white" />
                  <p className="text-sm text-white/90">{activeStory.authorName}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/90 via-[#111827]/15 to-[#111827]/65" />

              <div className="absolute inset-y-0 left-2 flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepStory(-1)}
                  disabled={activeStoryIndex === 0}
                  aria-label="Previous story"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#111827]/50 text-white backdrop-blur-sm transition-opacity hover:bg-[#111827]/75 disabled:opacity-25"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-2 flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepStory(1)}
                  aria-label="Next story"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#111827]/50 text-white backdrop-blur-sm transition-opacity hover:bg-[#111827]/75"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="absolute bottom-5 left-5 right-5 z-20">
                <p className="text-sm leading-relaxed text-white">
                  {activeStory.caption}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Story Sheet */}
      {composerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add story"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setComposerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-[#E7EAF3] bg-[#FFFFFF] p-6 pb-8 shadow-2xl sm:rounded-3xl sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E7EAF3] sm:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">
                  Add Story
                </h3>
                <p className="mt-0.5 text-xs text-[#687386]">
                  Share a quick moment with everyone on ONEHUB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label="Close add story dialog"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStory} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="story-caption"
                  className="mb-1.5 block text-xs font-medium text-[#111827]"
                >
                  Story caption
                </label>
                <textarea
                  id="story-caption"
                  rows={3}
                  maxLength={180}
                  required
                  value={draftCaption}
                  onChange={(e) => setDraftCaption(e.target.value)}
                  placeholder="Share a quick moment or creative note..."
                  className="w-full resize-none rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#687386]/75 focus:border-[#5366FF] focus:bg-[#FFFFFF] focus:outline-none"
                />
                <div className="mt-1 text-right font-mono text-[11px] tabular-nums text-[#687386]">
                  {draftCaption.length}/180
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#111827]">
                  Backdrop
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {STORY_BACKDROPS.map((item) => {
                    const selected = selectedBackdrop === item.url;
                    return (
                      <button
                        key={item.url}
                        type="button"
                        onClick={() => setSelectedBackdrop(item.url)}
                        className={`relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-transform duration-150 active:scale-95 ${
                          selected
                            ? 'border-[#5366FF] ring-2 ring-[#5366FF]/20'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        aria-label={`Select ${item.label}`}
                      >
                        <img
                          src={item.url}
                          alt={item.label}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!draftCaption.trim() || submitting}
                  className="elegance-gradient inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Share Story</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
