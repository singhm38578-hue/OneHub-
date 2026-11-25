import React from 'react';
import { ArrowLeft, Compass, Film } from 'lucide-react';
import type { NavSection } from '../types/onehub';

interface UpcomingSectionViewProps {
  section: Extract<NavSection, 'explore' | 'shorts'>;
  onReturnHome: () => void;
}

const SECTION_META: Record<
  Extract<NavSection, 'explore' | 'shorts'>,
  {
    title: string;
    phaseNote: string;
    description: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  explore: {
    title: 'Explore',
    phaseNote: 'Scheduled for Phase 2',
    description:
      'Unified creator search, topic discovery grids, and Communities will launch in Phase 2. Use the top search bar or Trending hashtags on Home to filter live posts right now.',
    icon: Compass,
  },
  shorts: {
    title: 'Shorts & Videos',
    phaseNote: 'Scheduled for Video Phase',
    description:
      'Vertical Shorts and long-form Watch playback with adaptive low-data streaming are planned for a dedicated media phase.',
    icon: Film,
  },
};

export const UpcomingSectionView: React.FC<UpcomingSectionViewProps> = ({
  section,
  onReturnHome,
}) => {
  const meta = SECTION_META[section];
  const Icon = meta.icon;

  return (
    <section className="space-y-6">
      <div className="elegance-card rounded-2xl p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F8FC] text-[#5366FF] ring-1 ring-[#E7EAF3]">
          <Icon className="h-6 w-6" />
        </div>

        <p className="mt-5 text-xs font-medium text-[#805CFF]">{meta.phaseNote}</p>
        <h1 className="mt-1.5 text-2xl font-bold text-[#111827]">{meta.title}</h1>
        <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-[#687386]">
          {meta.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onReturnHome}
            className="elegance-gradient inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </section>
  );
};
