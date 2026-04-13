'use client';

import { useState } from 'react';

const SIZE = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-2xl',
} as const;

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE;
}

export function UserAvatar({ name, avatarUrl, size = 'md' }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ?.split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div
      className={`${SIZE[size]} rounded-full bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center flex-shrink-0 overflow-hidden`}
    >
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-bold text-[#007AFF]">{initials}</span>
      )}
    </div>
  );
}
