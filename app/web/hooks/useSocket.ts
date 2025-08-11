/**
 * WebSocket接続とチャット機能のカスタムフック
 * チャット機能のビジネスロジックをReactコンポーネントから分離
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChatStore } from '../stores/chat-store';
import type { ChatRoomId, UserId } from '../types/chat-types';
import { debounce } from '../utils/chat-utils';

/**
 * WebSocket接続管理フック
 */
export function useSocket() {
  const { connectionStatus, connect, disconnect } = useChatStore();

  const connectWithToken = useCallback(
    async (token: string, user?: any) => {
      try {
        await connect(token, user);
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        throw error;
      }
    },
    [connect]
  );

  const disconnectSocket = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return {
    connectionStatus,
    connect: connectWithToken,
    disconnect: disconnectSocket,
    isConnected: connectionStatus === 'CONNECTED',
    isConnecting: connectionStatus === 'CONNECTING',
    hasError: connectionStatus === 'ERROR',
  };
}

/**
 * チャットルーム管理フック
 */
export function useChatRooms() {
  const { chatRooms, activeChatRoom, setActiveRoom, joinRoom, leaveRoom } = useChatStore();

  const selectRoom = useCallback(
    async (roomId: ChatRoomId | null) => {
      try {
        setActiveRoom(roomId);
      } catch (error) {
        console.error('Failed to select room:', error);
        throw error;
      }
    },
    [setActiveRoom]
  );

  const joinChatRoom = useCallback(
    async (roomId: ChatRoomId) => {
      try {
        await joinRoom(roomId);
      } catch (error) {
        console.error('Failed to join room:', error);
        throw error;
      }
    },
    [joinRoom]
  );

  const leaveChatRoom = useCallback(
    async (roomId: ChatRoomId) => {
      try {
        await leaveRoom(roomId);
      } catch (error) {
        console.error('Failed to leave room:', error);
        // エラーが発生してもUI上は退出扱いにする
      }
    },
    [leaveRoom]
  );

  return {
    chatRooms,
    activeChatRoom,
    selectRoom,
    joinRoom: joinChatRoom,
    leaveRoom: leaveChatRoom,
  };
}

/**
 * メッセージ送信フック
 */
export function useMessages(roomId: ChatRoomId | null) {
  const { messages, sendMessage, startTyping, stopTyping, isTyping } = useChatStore();

  const roomMessages = roomId ? messages[roomId] || [] : [];

  // タイピング状態管理
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // stopTypingを直接参照しないように、refを使用
  const stopTypingRef = useRef(stopTyping);
  useEffect(() => {
    stopTypingRef.current = stopTyping;
  }, [stopTyping]);

  const debouncedStopTyping = useMemo(
    () =>
      debounce((roomId: ChatRoomId) => {
        stopTypingRef.current(roomId);
      }, 2000),
    [] // 依存配列を空にして、一度だけ作成
  );

  const handleStartTyping = useCallback(
    (roomId: ChatRoomId) => {
      if (!isTyping) {
        startTyping(roomId);
      }

      // 2秒後に自動的にタイピング停止
      debouncedStopTyping(roomId);
    },
    [startTyping, isTyping, debouncedStopTyping]
  );

  const handleStopTyping = useCallback((roomId: ChatRoomId) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTypingRef.current(roomId);
  }, []);

  const sendMessageToRoom = useCallback(
    async (content: string) => {
      if (!roomId) {
        throw new Error('No room selected');
      }

      try {
        await sendMessage(roomId, content);
        // 送信成功時にタイピング状態をクリア
        handleStopTyping(roomId);
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    [roomId, sendMessage, handleStopTyping]
  );

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages: roomMessages,
    sendMessage: sendMessageToRoom,
    startTyping: () => roomId && handleStartTyping(roomId),
    stopTyping: () => roomId && handleStopTyping(roomId),
    isTyping,
  };
}

/**
 * リアルタイム更新フック
 */
export function useRealtimeUpdates(roomId: ChatRoomId | null) {
  const { onlineUsers, typingUsers } = useChatStore();

  const roomTypingUsers = roomId ? typingUsers[roomId] || new Set() : new Set();

  return {
    onlineUsers,
    typingUsers: roomTypingUsers,
  };
}

/**
 * チャット機能の初期化フック
 * アプリケーション起動時に一度だけ呼び出す
 */
export function useChatInitialization() {
  const { connect, disconnect, connectionStatus } = useChatStore();
  const initializationAttempted = useRef(false);

  const initializeChat = useCallback(
    async (user: { token: string; id?: number; name?: string; email?: string }) => {
      if (initializationAttempted.current) {
        return;
      }

      initializationAttempted.current = true;

      try {
        await connect(user.token, user);
        console.log('Chat system initialized successfully');
      } catch (error) {
        console.error('Failed to initialize chat system:', error);
        initializationAttempted.current = false; // 再試行を許可
        throw error;
      }
    },
    [connect]
  );

  const cleanupChat = useCallback(() => {
    disconnect();
    initializationAttempted.current = false;
  }, [disconnect]);

  // コンポーネントアンマウント時の自動クリーンアップ
  useEffect(() => {
    return () => {
      if (connectionStatus !== 'DISCONNECTED') {
        cleanupChat();
      }
    };
  }, [cleanupChat, connectionStatus]);

  return {
    initializeChat,
    cleanupChat,
    connectionStatus,
    isInitialized: connectionStatus === 'CONNECTED',
  };
}

/**
 * チャットルーム作成フック
 */
export function useChatRoomCreation() {
  const createDirectChat = useCallback(async (targetUserId: UserId): Promise<ChatRoomId> => {
    try {
      // Viteのプロキシ経由で相対パスを使用
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'DIRECT',
          memberIds: [targetUserId],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create direct chat');
      }

      const data = await response.json();
      console.log('[useChatRoomCreation] API response:', data);
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create chat room');
      }

      console.log('[useChatRoomCreation] Returning room ID:', data.data.id);
      return data.data.id;
    } catch (error) {
      console.error('Failed to create direct chat:', error);
      throw error;
    }
  }, []);

  const createGroupChat = useCallback(
    async (name: string, memberIds: UserId[], description?: string): Promise<ChatRoomId> => {
      try {
        // Viteのプロキシ経由で相対パスを使用
        const response = await fetch('/api/chat/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            type: 'GROUP',
            name,
            description,
            memberIds,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create group chat');
        }

        const data = await response.json();
        console.log('[useChatRoomCreation] API response:', data);
        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to create chat room');
        }

        console.log('[useChatRoomCreation] Returning room ID:', data.data.id);
        return data.data.id;
      } catch (error) {
        console.error('Failed to create group chat:', error);
        throw error;
      }
    },
    []
  );

  return {
    createDirectChat,
    createGroupChat,
  };
}

/**
 * ユーザー検索フック（チャットルーム作成時に使用）
 */
export function useUserSearch() {
  const searchUsers = useCallback(async (query: string) => {
    try {
      // Viteのプロキシ経由で相対パスを使用
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to search users');
      }

      return data.data;
    } catch (error) {
      console.error('Failed to search users:', error);
      throw error;
    }
  }, []);

  return {
    searchUsers,
  };
}
