/**
 * チャット機能の状態管理ストア（Zustand）
 * リアルタイムチャット機能の状態とアクションを統合管理
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { socketClient } from '../services/socket-client';
import type {
  ChatRoomId,
  ChatState,
  Message,
  MessageId,
  SocketConnectionStatus,
  SocketError,
  User,
} from '../types/chat-types';

/**
 * チャット状態管理ストア
 */
export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    // 初期状態
    connectionStatus: 'DISCONNECTED' as SocketConnectionStatus,
    socket: null,
    currentUser: null,
    chatRooms: [],
    messages: {},
    onlineUsers: new Set(),
    typingUsers: {},
    activeChatRoom: null,
    isTyping: false,

    // WebSocket接続（ユーザー情報も含む）
    connect: async (token: string, user?: User) => {
      console.log('[ChatStore] Connect called with token:', token, 'and user:', user);
      set({ connectionStatus: 'CONNECTING' as SocketConnectionStatus });

      try {
        console.log('[ChatStore] Attempting socket connection...');
        await socketClient.connect(token);

        console.log('[ChatStore] Socket connected, setting up listeners...');
        // WebSocketイベントリスナーを設定
        setupSocketListeners();

        // ユーザー情報を設定（提供された場合）
        const currentUser = user || null;

        set({
          connectionStatus: 'CONNECTED' as SocketConnectionStatus,
          socket: socketClient.getSocket(),
          currentUser,
        });
        console.log('[ChatStore] Connection status set to CONNECTED with user:', currentUser);

        // チャットルーム一覧を取得
        console.log('[ChatStore] Loading chat rooms...');
        await loadChatRooms();
        console.log('[ChatStore] Chat rooms loaded');
      } catch (error) {
        console.error('[ChatStore] WebSocket connection failed:', error);
        set({ connectionStatus: 'ERROR' as SocketConnectionStatus });
        throw error;
      }
    },

    // WebSocket切断
    disconnect: () => {
      socketClient.disconnect();
      set({
        connectionStatus: 'DISCONNECTED' as SocketConnectionStatus,
        socket: null,
        chatRooms: [],
        messages: {},
        onlineUsers: new Set(),
        typingUsers: {},
        activeChatRoom: null,
        isTyping: false,
      });
    },

    // メッセージ送信
    sendMessage: async (roomId: ChatRoomId, content: string) => {
      const { currentUser, connectionStatus } = get();

      // 接続状態の詳細なチェック
      if (connectionStatus !== 'CONNECTED') {
        console.error('[ChatStore] Cannot send message: not connected. Status:', connectionStatus);
        throw new Error(`チャットに接続されていません (状態: ${connectionStatus})`);
      }

      if (!socketClient.isConnected()) {
        console.error('[ChatStore] Socket client reports not connected');
        throw new Error('WebSocket接続が確立されていません');
      }

      if (!currentUser) {
        console.error('[ChatStore] Cannot send message: user not found');
        throw new Error('ユーザー情報が設定されていません');
      }

      // 入力バリデーション
      if (!content.trim()) {
        throw new Error('Message content cannot be empty');
      }

      if (content.length > 1000) {
        throw new Error('Message too long');
      }

      try {
        // 楽観的更新: UI側で即座にメッセージを表示
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}` as MessageId,
          chatRoomId: roomId,
          senderId: currentUser.id,
          content: content.trim(),
          messageType: 'TEXT',
          sentAt: new Date(),
          isDeleted: false,
          sender: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
          },
        };

        // メッセージをローカル状態に追加
        const { messages } = get();
        const roomMessages = messages[roomId] || [];
        set({
          messages: {
            ...messages,
            [roomId]: [...roomMessages, optimisticMessage],
          },
        });

        // WebSocketでサーバーに送信（ユーザー情報も含める）
        socketClient.emit('message:send', {
          roomId,
          content: content.trim(),
          user: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
          },
        });

        // タイピング状態をクリア
        get().stopTyping(roomId);
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },

    // チャットルーム参加
    joinRoom: async (roomId: ChatRoomId) => {
      console.log(`[ChatStore] Joining room: ${roomId}`);

      if (!socketClient.isConnected()) {
        console.error('[ChatStore] Cannot join room: WebSocket not connected');
        throw new Error('Not connected to WebSocket');
      }

      try {
        console.log(`[ChatStore] Emitting room:join for ${roomId}`);
        socketClient.emit('room:join', roomId);

        // メッセージ履歴を取得
        console.log(`[ChatStore] Loading message history for ${roomId}`);
        await loadMessages(roomId);
        console.log(`[ChatStore] Successfully joined room ${roomId}`);
      } catch (error) {
        console.error('[ChatStore] Failed to join room:', error);
        throw error;
      }
    },

    // チャットルーム退出
    leaveRoom: async (roomId: ChatRoomId) => {
      if (!socketClient.isConnected()) {
        return; // 接続がない場合はスキップ
      }

      try {
        socketClient.emit('room:leave', roomId);

        // アクティブルームをクリア
        const { activeChatRoom } = get();
        if (activeChatRoom === roomId) {
          set({ activeChatRoom: null });
        }
      } catch (error) {
        console.error('Failed to leave room:', error);
      }
    },

    // アクティブチャットルーム設定
    setActiveRoom: (roomId: ChatRoomId | null) => {
      const { activeChatRoom } = get();

      // 前のルームから退出
      if (activeChatRoom && activeChatRoom !== roomId) {
        get().leaveRoom(activeChatRoom);
      }

      // 新しいルームに参加
      if (roomId && roomId !== activeChatRoom) {
        get().joinRoom(roomId);
      }

      set({ activeChatRoom: roomId });
    },

    // タイピング開始
    startTyping: (roomId: ChatRoomId) => {
      if (!socketClient.isConnected()) return;

      // 既にtrueの場合は更新しない
      const { isTyping } = get();
      if (isTyping) return;

      set({ isTyping: true });
      socketClient.emit('typing:start', roomId);
    },

    // タイピング停止
    stopTyping: (roomId: ChatRoomId) => {
      if (!socketClient.isConnected()) return;

      // 既にfalseの場合は更新しない
      const { isTyping } = get();
      if (!isTyping) return;

      set({ isTyping: false });
      socketClient.emit('typing:stop', roomId);
    },

    // メッセージ既読マーク
    markAsRead: (roomId: ChatRoomId, messageId: MessageId) => {
      // 実装予定: 既読機能はPhase2で追加
      console.log('Mark as read:', roomId, messageId);
    },
  }))
);

/**
 * WebSocketイベントリスナーの設定
 */
function setupSocketListeners() {
  console.log('[setupSocketListeners] Setting up socket event listeners...');
  const { getState, setState } = useChatStore;

  // 新しいメッセージ受信
  socketClient.on('message:new', (message: Message) => {
    const state = getState();
    const roomMessages = state.messages[message.chatRoomId] || [];

    // 重複チェック（楽観的更新との衝突を防ぐ）
    const existingMessage = roomMessages.find(
      (m) =>
        m.id === message.id || (m.content === message.content && m.senderId === message.senderId)
    );

    if (!existingMessage) {
      setState({
        messages: {
          ...state.messages,
          [message.chatRoomId]: [...roomMessages, message],
        },
      });
    }

    // チャットルーム一覧の最終メッセージを更新
    const updatedRooms = state.chatRooms.map((room) =>
      room.id === message.chatRoomId ? { ...room, lastMessage: message } : room
    );
    setState({ chatRooms: updatedRooms });
  });

  // ルーム参加通知
  socketClient.on('room:joined', ({ roomId, member }) => {
    console.log('User joined room:', roomId, member);
    // 必要に応じてメンバー一覧を更新
  });

  // ルーム退出通知
  socketClient.on('room:left', ({ roomId, userId }) => {
    console.log('User left room:', roomId, userId);
    // 必要に応じてメンバー一覧を更新
  });

  // タイピング状態更新
  socketClient.on('user:typing', ({ roomId, userId, isTyping }) => {
    const state = getState();
    const roomTypingUsers = state.typingUsers[roomId] || new Set();

    if (isTyping) {
      roomTypingUsers.add(userId);
    } else {
      roomTypingUsers.delete(userId);
    }

    setState({
      typingUsers: {
        ...state.typingUsers,
        [roomId]: roomTypingUsers,
      },
    });
  });

  // オンライン状態更新
  socketClient.on('user:online', ({ userId, isOnline }) => {
    const state = getState();
    const newOnlineUsers = new Set(state.onlineUsers);

    if (isOnline) {
      newOnlineUsers.add(userId);
    } else {
      newOnlineUsers.delete(userId);
    }

    setState({ onlineUsers: newOnlineUsers });
  });

  // エラーハンドリング
  socketClient.on('error', (error: SocketError) => {
    console.error('WebSocket error:', error);

    // 認証エラーの場合は再接続を停止
    if (error.code === 'AUTH_FAILED') {
      setState({ connectionStatus: 'ERROR' as SocketConnectionStatus });
    }

    // その他のエラーは再接続を試行
    if (error.code !== 'AUTH_FAILED') {
      setState({ connectionStatus: 'RECONNECTING' as SocketConnectionStatus });
    }
  });
}

/**
 * チャットルーム一覧を取得
 */
async function loadChatRooms(): Promise<void> {
  console.log('[loadChatRooms] Starting...');
  try {
    // Viteのプロキシ経由で相対パスを使用
    console.log('[loadChatRooms] Fetching from /api/chat/rooms (via proxy)');
    const response = await fetch('/api/chat/rooms', {
      method: 'GET',
      credentials: 'include',
    });

    console.log('[loadChatRooms] Response status:', response.status);
    if (!response.ok) {
      console.error('[loadChatRooms] Response not OK:', response.status);
      throw new Error('Failed to load chat rooms');
    }

    const data = await response.json();
    console.log('[loadChatRooms] Response data:', data);

    if (data.success) {
      console.log('[loadChatRooms] Setting chat rooms:', data.data);
      useChatStore.setState({ chatRooms: data.data });
    } else {
      console.error('[loadChatRooms] Response success is false:', data);
    }
  } catch (error) {
    console.error('[loadChatRooms] Failed to load chat rooms:', error);
  }
}

/**
 * メッセージ履歴を取得
 */
async function loadMessages(roomId: ChatRoomId, limit: number = 50): Promise<void> {
  console.log(`[loadMessages] Loading messages for room: ${roomId}, limit: ${limit}`);

  try {
    // Viteのプロキシ経由で相対パスを使用
    const response = await fetch(`/api/chat/rooms/${roomId}/messages?limit=${limit}`, {
      method: 'GET',
      credentials: 'include',
    });

    console.log(`[loadMessages] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[loadMessages] Error response: ${response.status} ${response.statusText}`,
        errorText
      );
      throw new Error(`Failed to load messages: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[loadMessages] Response data:', data);

    if (data.success) {
      const state = useChatStore.getState();
      console.log(`[loadMessages] Setting ${data.data.length} messages for room ${roomId}`);
      useChatStore.setState({
        messages: {
          ...state.messages,
          [roomId]: data.data,
        },
      });
    } else {
      console.error('[loadMessages] Response success is false:', data);
    }
  } catch (error) {
    console.error('[loadMessages] Failed to load messages:', error);
    // エラーを再スローしない（joinRoomがエラーハンドリングしていないため）
  }
}

/**
 * チャット関連の状態セレクター（パフォーマンス最適化）
 */
export const useChatRooms = () => useChatStore((state) => state.chatRooms);
export const useMessages = (roomId: ChatRoomId | null) =>
  useChatStore((state) => (roomId ? state.messages[roomId] || [] : []));
export const useConnectionStatus = () => useChatStore((state) => state.connectionStatus);
export const useActiveChatRoom = () => useChatStore((state) => state.activeChatRoom);
export const useTypingUsers = (roomId: ChatRoomId | null) =>
  useChatStore((state) => (roomId ? state.typingUsers[roomId] || new Set() : new Set()));
export const useOnlineUsers = () => useChatStore((state) => state.onlineUsers);
