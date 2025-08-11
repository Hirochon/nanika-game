/**
 * チャットレイアウトコンポーネント
 * レスポンシブ対応のチャットUI統合レイアウト
 */

import { useEffect, useState } from 'react';
import { useChatRooms, useSocket } from '../../hooks/useSocket';
import type { ChatRoomId, User } from '../../types/chat-types';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { ChatRoom } from './ChatRoom';
import { ChatRoomList } from './ChatRoomList';
import { UserSelectModal } from './UserSelectModal';

export interface ChatLayoutProps {
  user: User;
  className?: string;
  initialRoomId?: string;
}

export function ChatLayout({ user, className, initialRoomId }: ChatLayoutProps) {
  console.log('[ChatLayout] Rendering with user:', user);

  const [showUserModal, setShowUserModal] = useState(false);
  const [modalMode, setModalMode] = useState<'direct' | 'group'>('direct');
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const { connectionStatus, connect, isConnected } = useSocket();
  const { activeChatRoom, selectRoom } = useChatRooms();

  console.log('[ChatLayout] Connection status:', connectionStatus);
  console.log('[ChatLayout] Is connected:', isConnected);

  // モバイル表示の検出
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      if (mobile && activeChatRoom) {
        setShowSidebar(false); // モバイルでチャット選択時はサイドバーを隠す
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [activeChatRoom]);

  // WebSocket接続初期化（ユーザー情報を含む）
  useEffect(() => {
    console.log('[ChatLayout] WebSocket effect triggered, isConnected:', isConnected);

    if (!isConnected && user) {
      // 仮のトークン（実際は認証システムから取得）
      const token = 'user-session-token';
      console.log('[ChatLayout] Attempting to connect with token:', token, 'and user:', user);

      // ユーザー情報を渡して接続
      connect(token, user).catch((error) => {
        console.error('[ChatLayout] Connection error:', error);
      });
    }
  }, [isConnected, connect, user]);

  // 初期ルームIDが指定された場合の自動選択
  useEffect(() => {
    if (initialRoomId && isConnected && activeChatRoom !== initialRoomId) {
      console.log('[ChatLayout] Selecting initial room:', initialRoomId);
      selectRoom(initialRoomId);
      if (isMobile) {
        setShowSidebar(false);
      }
    }
  }, [initialRoomId, isConnected, activeChatRoom, selectRoom, isMobile]);

  const handleRoomSelect = (_roomId: ChatRoomId) => {
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const handleBackToList = () => {
    setShowSidebar(true);
    selectRoom(null);
  };

  const handleNewDirectChat = () => {
    setModalMode('direct');
    setShowUserModal(true);
  };

  const handleNewGroupChat = () => {
    setModalMode('group');
    setShowUserModal(true);
  };

  const handleRoomCreated = async (roomId: string) => {
    await selectRoom(roomId);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  // 接続状態の表示
  if (connectionStatus === 'CONNECTING') {
    console.log('[ChatLayout] Showing connecting state');
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">チャットに接続中...</p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'ERROR') {
    console.log('[ChatLayout] Showing error state');
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-gray-900 font-medium mb-2">接続エラー</p>
          <p className="text-gray-600 mb-4">チャットサーバーに接続できませんでした</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full bg-gray-100', className)}>
      {/* サイドバー（チャットルーム一覧） */}
      <div
        className={cn(
          'flex flex-col bg-white border-r border-gray-200',
          isMobile ? (showSidebar ? 'fixed inset-0 z-40' : 'hidden') : 'w-80'
        )}
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div
                className={cn('w-3 h-3 rounded-full', isConnected ? 'bg-green-400' : 'bg-red-400')}
              />
              <h1 className="text-xl font-semibold text-gray-900">チャット</h1>
            </div>

            {isMobile && (
              <button
                onClick={handleBackToList}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* 新規チャットボタン */}
          <div className="flex space-x-2">
            <Button variant="primary" size="sm" onClick={handleNewDirectChat} className="flex-1">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              新しいチャット
            </Button>
            <Button variant="secondary" size="sm" onClick={handleNewGroupChat} className="flex-1">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.196-2.196M15 6a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
              </svg>
              グループ
            </Button>
          </div>
        </div>

        {/* チャットルーム一覧 */}
        <ChatRoomList currentUser={user} onRoomSelect={handleRoomSelect} className="flex-1" />
      </div>

      {/* メイン（チャットエリア） */}
      <div className={cn('flex-1 flex flex-col', isMobile && showSidebar && 'hidden')}>
        {activeChatRoom ? (
          <ChatRoom
            roomId={activeChatRoom}
            currentUser={user}
            onBackClick={isMobile ? handleBackToList : undefined}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="text-gray-400 mb-6">
                <svg
                  className="mx-auto h-20 w-20"
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
              <h3 className="text-xl font-medium text-gray-900 mb-4">チャットを始めましょう</h3>
              <p className="text-gray-500 mb-6">
                新しいチャットを開始するか、既存のチャットルームを選択してください
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" onClick={handleNewDirectChat}>
                  新しいチャット
                </Button>
                <Button variant="secondary" onClick={handleNewGroupChat}>
                  グループ作成
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* モバイル用オーバーレイ */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={handleBackToList} />
      )}

      {/* ユーザー選択モーダル */}
      <UserSelectModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        currentUser={user}
        mode={modalMode}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
}
