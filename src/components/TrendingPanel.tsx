import React from 'react';
import { ArrowRight, ArrowUpRight, Compass, Hash } from 'lucide-react';
import type { TrendingTopic } from '../types/onehub';

interface TrendingPanelProps {
  topics: TrendingTopic[];
  activeHashtag: string | null;
  onSelectHashtag: (hashtag: string | null) => void;
  onOpenExplore: () => void;
  variant: 'rail' | 'strip';
}

export const TrendingPanel: React.FC<TrendingPanelProps> = ({
  topics,
  activeHashtag,
  onSelectHashtag,
  onOpenExplore,
  variant,
}) => {
  const handleToggle = (hashtag: string) => {
    onSelectHashtag(activeHashtag === hashtag ? null : hashtag);
  };

  if (variant === 'strip') {
    return (
      <section aria-label="Trending topics" className="w-full lg:hidden">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-[#111827]">
            Trending
          </h2>
          <div className="flex items-center gap-3">
            {activeHashtag && (
              <button
                type="button"
                onClick={() => onSelectHashtag(null)}
                className="text-xs font-medium text-[#687386] hover:text-[#111827]"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onOpenExplore}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#5366FF] hover:text-[#805CFF]"
            >
              <span>Explore</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
          {topics.map((topic) => {
            const isSelected = activeHashtag === topic.hashtag;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleToggle(topic.hashtag)}
                className={`inline-flex min-h-[38px] shrink-0 snap-start items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? 'elegance-gradient text-white shadow-[0_2px_10px_rgba(83,102,255,0.25)]'
                    : 'border border-[#E7EAF3] bg-[#FFFFFF] text-[#111827] shadow-[0_1px_4px_rgba(17,24,39,0.03)] hover:border-[#5366FF]/45 hover:text-[#5366FF]'
                }`}
              >
                <Hash
                  className={`h-3 w-3 shrink-0 ${
                    isSelected ? 'text-white/90' : 'text-[#805CFF]'
                  }`}
                />
                <span>{topic.hashtag.replace(/^#/, '')}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenExplore}
            className="inline-flex min-h-[38px] shrink-0 snap-start items-center gap-1.5 rounded-xl border border-[#5366FF]/25 bg-[#F7F8FC] px-3 py-1.5 text-xs font-semibold text-[#5366FF] whitespace-nowrap transition-colors hover:border-[#5366FF]/55 hover:bg-[#FFFFFF]"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Explore all</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Trending topics"
      className="elegance-card rounded-2xl p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-[#111827]">Trending Topics</h2>
        {activeHashtag && (
          <button
            type="button"
            onClick={() => onSelectHashtag(null)}
            className="text-xs font-medium text-[#5366FF] hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-[#687386]">
        Click any hashtag to filter the live feed
      </p>

      <div className="mt-3.5 divide-y divide-[#E7EAF3]">
        {topics.map((topic) => {
          const isSelected = activeHashtag === topic.hashtag;
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => handleToggle(topic.hashtag)}
              className={`group flex w-full items-start justify-between gap-3 py-2.5 text-left transition-colors duration-150 first:pt-1 last:pb-1 ${
                isSelected ? 'text-[#5366FF]' : 'text-[#111827] hover:text-[#5366FF]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 shrink-0 text-[#805CFF]" />
                  <span className="truncate text-sm font-semibold">
                    {topic.hashtag.replace(/^#/, '')}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#687386]">
                  {topic.category}
                  {topic.volumeLabel && topic.volumeLabel !== 'Topic' && (
                    <>
                      {' '}
                      · <span className="font-mono tabular-nums">{topic.volumeLabel}</span>
                    </>
                  )}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#687386]">
                  {topic.summary}
                </p>
              </div>
              <ArrowUpRight
                className={`mt-0.5 h-4 w-4 shrink-0 transition-transform duration-150 ${
                  isSelected
                    ? 'text-[#5366FF]'
                    : 'text-[#687386] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#5366FF]'
                }`}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenExplore}
        className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#E7EAF3] bg-[#F7F8FC] px-3.5 text-xs font-semibold text-[#5366FF] transition-colors hover:border-[#5366FF]/40 hover:bg-[#FFFFFF]"
      >
        <span>Open Explore</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
};
