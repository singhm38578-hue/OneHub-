import React from 'react';
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus, X } from 'lucide-react';
import type { NotificationItem } from '../types/onehub';

interface NotificationsDrawerProps {
  open: boolean;
  isSignedIn: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
  onRequireAuth: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  isSignedIn,
  notifications,
  onClose,
  onMarkAllRead,
  onMarkOneRead,
  onRequireAuth,
}) => {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="h-3.5 w-3.5 text-[#5366FF]" />;
      case 'comment':
        return <MessageCircle className="h-3.5 w-3.5 text-[#805CFF]" />;
      case 'follow':
        return <UserPlus className="h-3.5 w-3.5 text-[#06B6D4]" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      className="fixed inset-0 z-50 flex items-end justify-end bg-[#111827]/35 backdrop-blur-sm sm:items-stretch"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82dvh] w-full flex-col rounded-t-3xl border-t border-[#E7EAF3] bg-[#FFFFFF] shadow-2xl sm:max-h-none sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[#E7EAF3] sm:hidden" />

        <div className="flex items-center justify-between border-b border-[#E7EAF3] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Notifications</h2>
            <p className="text-xs text-[#687386]">
              <span className="font-mono tabular-nums">{unreadCount}</span> unread
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[#5366FF] hover:bg-[#F7F8FC]"
              >
                <CheckCheck className="h-4 w-4" />
                <span>Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#687386] hover:bg-[#F7F8FC] hover:text-[#111827]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 pb-8">
          {!isSignedIn ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Bell className="h-7 w-7 text-[#5366FF]" />
              <p className="mt-3 text-sm font-semibold text-[#111827]">
                Sign in to see your notifications
              </p>
              <p className="mt-1 max-w-xs text-xs text-[#687386]">
                Get real-time updates when someone likes, comments on your posts, or follows you.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequireAuth();
                }}
                className="elegance-gradient mt-4 min-h-[42px] rounded-xl px-5 text-xs font-semibold text-white shadow-sm"
              >
                Sign In
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Bell className="h-7 w-7 text-[#687386]" />
              <p className="mt-3 text-sm font-medium text-[#111827]">
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-xs text-[#687386]">
                New likes, comments, and followers will appear here in real time.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E7EAF3]">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onMarkOneRead(item.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-[#F7F8FC] ${
                      item.read ? 'opacity-75 hover:opacity-100' : 'bg-[#F7F8FC]/65'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.avatarGradient} text-xs font-bold text-white shadow-sm`}
                    >
                      {item.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-[#111827]">
                        <span className="font-semibold text-[#111827]">
                          {item.actorName}
                        </span>{' '}
                        {item.message}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#687386]">
                        {renderIcon(item.type)}
                        <span>@{item.actorHandle}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.timestampLabel}</span>
                        {!item.read && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#5366FF]">New</span>
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
