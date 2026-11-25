import React from 'react';
import { AlertTriangle, Compass, RefreshCw } from 'lucide-react';

export const FeedLoadingState: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Loading feed" className="space-y-4">
      {[0, 1].map((idx) => (
        <div
          key={idx}
          className="elegance-card rounded-2xl p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-xl bg-[#E7EAF3]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 animate-pulse rounded bg-[#E7EAF3]" />
              <div className="h-3 w-48 animate-pulse rounded bg-[#F7F8FC]" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-full animate-pulse rounded bg-[#F7F8FC]" />
            <div className="h-3.5 w-5/6 animate-pulse rounded bg-[#F7F8FC]" />
          </div>
          <div className="mt-4 h-52 w-full animate-pulse rounded-xl bg-[#F7F8FC]" />
        </div>
      ))}
    </div>
  );
};

interface FeedEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const FeedEmptyState: React.FC<FeedEmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="elegance-card flex flex-col items-center rounded-2xl px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F8FC] text-[#5366FF] ring-1 ring-[#E7EAF3]">
        <Compass className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#111827]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#687386]">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="elegance-gradient mt-5 min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

interface FeedErrorStateProps {
  message: string;
  onRetry: () => void;
}

export const FeedErrorState: React.FC<FeedErrorStateProps> = ({
  message,
  onRetry,
}) => {
  return (
    <div
      role="alert"
      className="elegance-card flex flex-col items-center rounded-2xl border-rose-200 px-6 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#111827]">
        Unable to load the feed
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#687386]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="elegance-gradient mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:scale-95"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Try again</span>
      </button>
    </div>
  );
};
