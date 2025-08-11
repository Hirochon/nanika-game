/**
 * アバターコンポーネント
 * ユーザーアイコン表示とフォールバック機能
 */

import { getAvatarColor, getInitials } from '../../utils/chat-utils';
import { cn } from '../../utils/cn';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

const avatarSizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const onlineIndicatorSizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

export function Avatar({ name, src, size = 'md', className, online }: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-medium text-white',
          avatarSizes[size],
          !src && colorClass,
          className
        )}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {online !== undefined && (
        <div
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            onlineIndicatorSizes[size],
            online ? 'bg-green-400' : 'bg-gray-400'
          )}
          title={online ? 'オンライン' : 'オフライン'}
        />
      )}
    </div>
  );
}
