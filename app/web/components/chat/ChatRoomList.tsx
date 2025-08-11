/**
 * チャットルーム一覧コンポーネント
 * チャットルーム一覧の表示と選択機能
 */

import { useChatRooms, useRealtimeUpdates } from '../../hooks/useSocket';
import type { ChatRoom, ChatRoomId, User } from '../../types/chat-types';
import {
  formatRelativeTime,
  getChatRoomAvatar,
  getChatRoomDisplayName,
  sortChatRooms,
} from '../../utils/chat-utils';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

export interface ChatRoomListProps {
  currentUser: User;
  className?: string;
  onRoomSelect?: (roomId: ChatRoomId) => void;
}

export function ChatRoomList({ currentUser, className, onRoomSelect }: ChatRoomListProps) {
  const { chatRooms, activeChatRoom, selectRoom } = useChatRooms();
  const { onlineUsers } = useRealtimeUpdates(null);

  const sortedRooms = sortChatRooms(chatRooms);

  const handleRoomClick = async (roomId: ChatRoomId) => {
    try {
      await selectRoom(roomId);
      onRoomSelect?.(roomId);
    } catch (error) {
      console.error('Failed to select room:', error);
    }
  };

  if (chatRooms.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">チャットルームがありません</p>
          <p className="text-gray-400 text-xs mt-1">新しいチャットを開始してみましょう</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">チャット</h2>
        <p className="text-sm text-gray-500">{chatRooms.length}個のルーム</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {sortedRooms.map((room) => (
            <ChatRoomItem
              key={room.id}
              room={room}
              currentUser={currentUser}
              isActive={room.id === activeChatRoom}
              onlineUsers={onlineUsers}
              onClick={() => handleRoomClick(room.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ChatRoomItemProps {
  room: ChatRoom;
  currentUser: User;
  isActive: boolean;
  onlineUsers: Set<number>;
  onClick: () => void;
}

function ChatRoomItem({ room, currentUser, isActive, onlineUsers, onClick }: ChatRoomItemProps) {
  const displayName = getChatRoomDisplayName(room, currentUser);
  const avatarInfo = getChatRoomAvatar(room, currentUser);
  const unreadCount = room.unreadCount || 0;

  // 1対1チャットの場合、相手のオンライン状態を確認
  const otherMember =
    room.type === 'DIRECT' && room.members
      ? room.members.find((member) => member.userId !== currentUser.id)
      : null;
  const isOnline = otherMember ? onlineUsers.has(otherMember.userId) : undefined;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-colors duration-200',
        'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        isActive && 'bg-indigo-50 border-indigo-200'
      )}
    >
      <div className="flex items-center space-x-3">
        {/* アバター */}
        <div className="flex-shrink-0">
          <Avatar name={avatarInfo.name} size="md" online={isOnline} />
        </div>

        {/* チャット情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3
              className={cn(
                'text-sm font-medium truncate',
                isActive ? 'text-indigo-900' : 'text-gray-900'
              )}
            >
              {displayName}
            </h3>

            {room.lastMessage && (
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {formatRelativeTime(new Date(room.lastMessage.sentAt))}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600 truncate">
              {room.lastMessage ? (
                <span>
                  {room.lastMessage.senderId === currentUser.id && '自分: '}
                  {room.lastMessage.content}
                </span>
              ) : (
                <span className="text-gray-400 italic">メッセージはありません</span>
              )}
            </p>

            {unreadCount > 0 && (
              <Badge variant="error" size="sm" className="ml-2 flex-shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>

          {/* グループチャットの場合はメンバー数を表示 */}
          {room.type === 'GROUP' && (
            <div className="flex items-center mt-1">
              <svg
                className="w-3 h-3 text-gray-400 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
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
              <span className="text-xs text-gray-500">
                {room.memberCount || room.members?.length || 0}人
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
