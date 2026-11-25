import React from 'react';

interface OneHubLogoProps {
  compact?: boolean;
  className?: string;
}

export const OneHubLogo: React.FC<OneHubLogoProps> = ({
  compact = false,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="onehub-elegance-ring" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5366FF" />
            <stop offset="100%" stopColor="#805CFF" />
          </linearGradient>
          <linearGradient id="onehub-elegance-core" x1="11" y1="10" x2="25" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5366FF" />
            <stop offset="100%" stopColor="#805CFF" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="32"
          height="32"
          rx="10"
          fill="#F7F8FC"
          stroke="#E7EAF3"
          strokeWidth="1.5"
        />
        <path
          d="M18 8.5C12.753 8.5 8.5 12.753 8.5 18C8.5 23.247 12.753 27.5 18 27.5C23.247 27.5 27.5 23.247 27.5 18"
          stroke="url(#onehub-elegance-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M18 12.8L23.2 18L18 23.2L12.8 18L18 12.8Z"
          fill="url(#onehub-elegance-core)"
        />
        <circle cx="25.8" cy="10.2" r="2.3" fill="#06B6D4" />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[#111827]">
        ONEHUB
      </span>
    </span>
  );
};
