/**
 * チャット機能のユーティリティ関数
 * 日付フォーマット、メッセージ処理、バリデーションなど
 */

import type { ChatRoom, Message, User, UserId } from '../types/chat-types';

/**
 * 日付を相対的な時間表示にフォーマット
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'たった今';
  } else if (minutes < 60) {
    return `${minutes}分前`;
  } else if (hours < 24) {
    return `${hours}時間前`;
  } else if (days < 7) {
    return `${days}日前`;
  } else {
    return date.toLocaleDateString('ja-JP');
  }
}

/**
 * 時刻を HH:MM 形式でフォーマット
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * メッセージの時刻表示を決定
 * 今日なら時刻のみ、それ以外は日付も含む
 */
export function formatMessageTime(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);

  const isToday = now.toDateString() === messageDate.toDateString();

  if (isToday) {
    return formatTime(messageDate);
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isYesterday = yesterday.toDateString() === messageDate.toDateString();

    if (isYesterday) {
      return `昨日 ${formatTime(messageDate)}`;
    } else {
      return `${messageDate.toLocaleDateString('ja-JP')} ${formatTime(messageDate)}`;
    }
  }
}

/**
 * チャットルーム名を生成
 * 1対1チャットの場合は相手の名前、グループチャットの場合は設定された名前
 */
export function getChatRoomDisplayName(room: ChatRoom, currentUser: User): string {
  if (room.type === 'GROUP') {
    return room.name || 'グループチャット';
  } else {
    // 1対1チャットの場合、相手の名前を返す
    // members配列が存在しない場合は、シンプルな名前を返す
    if (!room.members || !Array.isArray(room.members)) {
      return room.name || 'ダイレクトメッセージ';
    }

    // 型を確実に比較するためNumberで変換
    const otherMember = room.members.find(
      (member) => Number(member.userId) !== Number(currentUser.id)
    );

    return otherMember?.user?.name || '不明なユーザー';
  }
}

/**
 * チャットルームのアバター情報を取得
 * 1対1チャットの場合は相手のアバター、グループチャットの場合はグループアイコン
 */
export function getChatRoomAvatar(
  room: ChatRoom,
  currentUser: User
): {
  type: 'user' | 'group';
  name: string;
  email?: string;
} {
  if (room.type === 'GROUP') {
    return {
      type: 'group',
      name: room.name || 'G',
    };
  } else {
    // members配列が存在しない場合のデフォルト値
    if (!room.members || !Array.isArray(room.members)) {
      return {
        type: 'user',
        name: room.name?.charAt(0) || 'D',
        email: undefined,
      };
    }
    // 型を確実に比較するためNumberで変換
    const otherMember = room.members.find(
      (member) => Number(member.userId) !== Number(currentUser.id)
    );
    return {
      type: 'user',
      name: otherMember?.user?.name || '?',
      email: otherMember?.user?.email,
    };
  }
}

/**
 * メッセージ内容をサニタイズ
 * XSS攻撃を防ぐためのHTMLエスケープ
 */
export function sanitizeMessage(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * URLを自動リンク化（簡易版）
 */
export function linkifyUrls(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
  );
}

/**
 * メッセージ内容の表示用処理
 * サニタイズ + URLリンク化
 */
export function formatMessageContent(content: string): string {
  const sanitized = sanitizeMessage(content);
  return linkifyUrls(sanitized);
}

/**
 * メッセージのバリデーション
 */
export function validateMessage(content: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return {
      isValid: false,
      error: 'メッセージを入力してください',
    };
  }

  if (trimmedContent.length > 1000) {
    return {
      isValid: false,
      error: 'メッセージは1000文字以内で入力してください',
    };
  }

  return { isValid: true };
}

/**
 * チャットルーム名のバリデーション
 */
export function validateChatRoomName(name: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return {
      isValid: false,
      error: 'チャットルーム名を入力してください',
    };
  }

  if (trimmedName.length > 50) {
    return {
      isValid: false,
      error: 'チャットルーム名は50文字以内で入力してください',
    };
  }

  return { isValid: true };
}

/**
 * ユーザーのオンライン状態を取得
 */
export function getUserOnlineStatus(
  userId: UserId,
  onlineUsers: Set<UserId>
): {
  isOnline: boolean;
  statusText: string;
  statusColor: string;
} {
  const isOnline = onlineUsers.has(userId);

  return {
    isOnline,
    statusText: isOnline ? 'オンライン' : 'オフライン',
    statusColor: isOnline ? 'bg-green-400' : 'bg-gray-400',
  };
}

/**
 * タイピング状態のテキスト生成
 */
export function getTypingText(typingUsers: Set<UserId>, userMap: Map<UserId, User>): string {
  const typingUserNames = Array.from(typingUsers)
    .map((userId) => userMap.get(userId)?.name || '不明')
    .slice(0, 3); // 最大3人まで表示

  if (typingUserNames.length === 0) {
    return '';
  } else if (typingUserNames.length === 1) {
    return `${typingUserNames[0]}が入力中...`;
  } else if (typingUserNames.length === 2) {
    return `${typingUserNames[0]}と${typingUserNames[1]}が入力中...`;
  } else {
    return `${typingUserNames[0]}他${typingUserNames.length - 1}人が入力中...`;
  }
}

/**
 * 未読メッセージ数をカウント
 */
export function getUnreadCount(messages: Message[], lastReadMessageId?: string): number {
  if (!lastReadMessageId || messages.length === 0) {
    return messages.length;
  }

  const lastReadIndex = messages.findIndex((msg) => msg.id === lastReadMessageId);
  if (lastReadIndex === -1) {
    return messages.length;
  }

  return messages.length - lastReadIndex - 1;
}

/**
 * チャットルームをソート
 * 最後のメッセージの時刻順で降順にソート
 */
export function sortChatRooms(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort((a, b) => {
    const aTime = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0;
    const bTime = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0;
    return bTime - aTime; // 新しい順
  });
}

/**
 * メッセージを日付グループに分類
 */
export function groupMessagesByDate(messages: Message[]): Array<{
  date: string;
  messages: Message[];
}> {
  const groups: { [date: string]: Message[] } = {};

  for (const message of messages) {
    const date = new Date(message.sentAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  }

  return Object.entries(groups).map(([date, messages]) => ({
    date,
    messages,
  }));
}

/**
 * アバター用の色を生成（名前ベース）
 */
export function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * アバター用のイニシャルを取得
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * デバウンス用のユーティリティ
 * タイピング状態の送信に使用
 */
export function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;

  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

/**
 * スロットル用のユーティリティ
 * メッセージ送信のレート制限に使用
 */
export function throttle<T extends (...args: unknown[]) => void>(func: T, limit: number): T {
  let lastFunc: NodeJS.Timeout | null = null;
  let lastRan: number | null = null;

  return ((...args: Parameters<T>) => {
    if (lastRan === null) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(
        () => {
          if (lastRan !== null && Date.now() - lastRan >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan)
      );
    }
  }) as T;
}
