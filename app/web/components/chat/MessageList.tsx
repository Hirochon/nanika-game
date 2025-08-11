/**
 * メッセージ一覧表示コンポーネント
 * チャットメッセージの表示とスクロール管理
 */

import { useEffect, useMemo, useRef } from 'react';
import { useMessages, useRealtimeUpdates } from '../../hooks/useSocket';
import type { ChatRoomId, Message, User, UserId } from '../../types/chat-types';
import {
  formatMessageContent,
  formatMessageTime,
  getTypingText,
  groupMessagesByDate,
} from '../../utils/chat-utils';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';

export interface MessageListProps {
  roomId: ChatRoomId | null;
  currentUser: User;
  className?: string;
}

export function MessageList({ roomId, currentUser, className }: MessageListProps) {
  const { messages } = useMessages(roomId);
  const { typingUsers, onlineUsers } = useRealtimeUpdates(roomId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // メッセージを日付でグループ化
  const messageGroups = useMemo(() => {
    return groupMessagesByDate(messages);
  }, [messages]);

  // ユーザーマップを作成（タイピング表示用）
  const userMap = useMemo(() => {
    const map = new Map<UserId, User>();
    messages.forEach((message) => {
      map.set(message.senderId, message.sender);
    });
    return map;
  }, [messages]);

  // タイピングテキストを生成
  const typingText = getTypingText(typingUsers, userMap);

  // 新しいメッセージが追加された時に自動スクロール
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // ルーム変更時に最下部までスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  if (!roomId) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">チャットを選択してください</h3>
          <p className="text-gray-500">
            左側のリストからチャットルームを選択してメッセージを表示できます
          </p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">まだメッセージがありません</p>
          <p className="text-gray-400 text-sm">最初のメッセージを送信して会話を始めましょう</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* 日付区切り */}
            <div className="flex justify-center mb-4">
              <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                {formatDateSeparator(group.date)}
              </span>
            </div>

            {/* メッセージリスト */}
            <div className="space-y-3">
              {group.messages.map((message, messageIndex) => {
                const prevMessage = messageIndex > 0 ? group.messages[messageIndex - 1] : null;
                const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;

                // 型変換を確実に行う（UserIdがnumber型なので）
                const isOwn = Number(message.senderId) === Number(currentUser.id);

                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    isOnline={onlineUsers.has(message.senderId)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* タイピングインジケータ */}
        {typingText && (
          <div className="flex items-center space-x-2 text-sm text-gray-500 italic">
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
            <span>{typingText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  isOnline: boolean;
}

function MessageItem({ message, isOwn, showAvatar, isOnline }: MessageItemProps) {
  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex space-x-2 max-w-xs lg:max-w-md',
          isOwn && 'flex-row-reverse space-x-reverse'
        )}
      >
        {/* アバター */}
        <div className={cn('flex-shrink-0', !showAvatar && 'invisible')}>
          {!isOwn && <Avatar name={message.sender.name} size="sm" online={isOnline} />}
        </div>

        {/* メッセージバブル */}
        <div className="flex flex-col">
          {showAvatar && !isOwn && (
            <span className="text-xs font-medium text-gray-700 mb-1">{message.sender.name}</span>
          )}

          <div
            className={cn(
              'relative px-4 py-2 rounded-lg break-words',
              isOwn
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-gray-200 text-gray-900 rounded-bl-sm'
            )}
          >
            <div
              className="text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: formatMessageContent(message.content),
              }}
            />

            {/* メッセージの時刻 */}
            <div className={cn('text-xs mt-1', isOwn ? 'text-indigo-200' : 'text-gray-500')}>
              {formatMessageTime(new Date(message.sentAt))}
              {message.editedAt && <span className="ml-1">(編集済み)</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 日付区切りのフォーマット
 */
function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return '今日';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return '昨日';
  } else {
    return date.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }
}
