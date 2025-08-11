/**
 * チャットルームコンポーネント
 * メッセージ一覧とヘッダーを統合したチャットルーム表示
 */

import { useChatRooms, useRealtimeUpdates } from '../../hooks/useSocket';
import type { ChatRoomId, User } from '../../types/chat-types';
import {
  getChatRoomAvatar,
  getChatRoomDisplayName,
  getUserOnlineStatus,
} from '../../utils/chat-utils';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { MessageForm } from './MessageForm';
import { MessageList } from './MessageList';

export interface ChatRoomProps {
  roomId: ChatRoomId | null;
  currentUser: User;
  className?: string;
  onBackClick?: () => void; // モバイル用
}

export function ChatRoom({ roomId, currentUser, className, onBackClick }: ChatRoomProps) {
  const { chatRooms } = useChatRooms();
  const { onlineUsers } = useRealtimeUpdates(roomId);

  const currentRoom = roomId ? chatRooms.find((room) => room.id === roomId) : null;

  if (!roomId || !currentRoom) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-gray-50', className)}>
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
          <p className="text-gray-500">左側のリストからチャットルームを選択してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      <ChatRoomHeader
        room={currentRoom}
        currentUser={currentUser}
        onlineUsers={onlineUsers}
        onBackClick={onBackClick}
      />

      <MessageList roomId={roomId} currentUser={currentUser} className="flex-1" />

      <MessageForm
        roomId={roomId}
        onMessageSent={() => {
          // メッセージ送信後の処理（必要に応じて）
        }}
      />
    </div>
  );
}

interface ChatRoomHeaderProps {
  room: any; // ChatRoom型
  currentUser: User;
  onlineUsers: Set<number>;
  onBackClick?: () => void;
}

function ChatRoomHeader({ room, currentUser, onlineUsers, onBackClick }: ChatRoomHeaderProps) {
  const displayName = getChatRoomDisplayName(room, currentUser);
  const avatarInfo = getChatRoomAvatar(room, currentUser);

  // 1対1チャットの場合の相手ユーザー情報
  const otherMember =
    room.type === 'DIRECT' && room.members
      ? room.members.find((member: any) => Number(member.userId) !== Number(currentUser.id))
      : null;

  const onlineStatus = otherMember
    ? getUserOnlineStatus(Number(otherMember.userId), onlineUsers)
    : null;

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex items-center space-x-3">
        {/* モバイル用戻るボタン */}
        {onBackClick && (
          <button
            onClick={onBackClick}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="戻る"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* アバター */}
        <Avatar name={avatarInfo.name} size="md" online={onlineStatus?.isOnline} />

        {/* チャット情報 */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h1>

          <div className="flex items-center space-x-2 text-sm text-gray-500">
            {room.type === 'DIRECT' && onlineStatus && (
              <div className="flex items-center space-x-1">
                <div className={cn('w-2 h-2 rounded-full', onlineStatus.statusColor)} />
                <span>{onlineStatus.statusText}</span>
              </div>
            )}

            {room.type === 'GROUP' && (
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.196-2.196M15 6a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 20h9M19 8v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h2l2-2h4l2 2h2a2 2 0 012 2z"
                  />
                </svg>
                <span>{room.memberCount || room.members?.length || 0}人のメンバー</span>
                {room.description && (
                  <>
                    <span>•</span>
                    <span className="truncate">{room.description}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center space-x-2">
        {/* 通話ボタン（将来実装） */}
        {room.type === 'DIRECT' && (
          <button
            disabled
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="通話機能（準備中）"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </button>
        )}

        {/* 設定ボタン */}
        <button
          disabled
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="チャット設定（準備中）"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
