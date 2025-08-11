/**
 * Socket.ioクライアント設定とWebSocket接続管理
 * アーキテクチャ設計書に基づくリアルタイム通信実装
 */

import { io, type Socket } from 'socket.io-client';
import type { SocketConnectionStatus, SocketError, SocketEvents } from '../types/chat-types';

// Socket.io接続設定
const SOCKET_CONFIG = {
  // 自動再接続設定
  autoConnect: false, // 手動で接続を制御
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,

  // タイムアウト設定
  timeout: 20000,

  // ハートビート設定
  pingTimeout: 60000,
  pingInterval: 25000,

  // トランスポート設定（GitHub CodespacesではWebSocketプロキシが不安定なため、pollingを優先）
  transports: ['polling'], // GitHub Codespacesではpollingのみ使用

  // その他の設定
  forceNew: false,
  multiplex: true,
};

/**
 * Socket.ioクライアントクラス
 * WebSocket接続の管理、認証、エラーハンドリングを担当
 */
export class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<keyof SocketEvents, Function[]> = new Map();

  /**
   * Socket.ioサーバーに接続
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[SocketClient] Connecting with token:', token);

      try {
        // 既存の接続があれば切断
        if (this.socket) {
          console.log('[SocketClient] Disconnecting existing socket');
          this.disconnect();
        }

        const serverUrl = this.getServerUrl();
        console.log('[SocketClient] Creating socket connection to:', serverUrl);

        // 新しいSocket.io接続を作成
        this.socket = io(serverUrl, {
          ...SOCKET_CONFIG,
          auth: {
            token, // JWT認証トークン
          },
          query: {
            timestamp: Date.now(), // キャッシュ回避
          },
        });

        // 接続成功イベント
        this.socket.on('connect', () => {
          console.log('[SocketClient] Successfully connected! Socket ID:', this.socket?.id);
          this.setupEventListeners();
          resolve();
        });

        // 接続エラーイベント
        this.socket.on('connect_error', (error) => {
          console.error('[SocketClient] Connection error:', error.message, error);
          this.handleError('AUTH_FAILED', 'Connection failed', error);
          reject(error);
        });

        // 切断イベント
        this.socket.on('disconnect', (reason) => {
          console.log('Socket.io disconnected:', reason);
          this.notifyListeners('error', {
            code: 'DISCONNECTED' as any,
            message: `Connection lost: ${reason}`,
            timestamp: new Date(),
          });
        });

        // 再接続試行イベント
        this.socket.on('reconnect_attempt', (attempt) => {
          console.log(`Socket.io reconnection attempt ${attempt}`);
        });

        // 再接続成功イベント
        this.socket.on('reconnect', () => {
          console.log('Socket.io reconnected');
          this.setupEventListeners(); // リスナーを再設定
        });

        // 再接続失敗イベント
        this.socket.on('reconnect_failed', () => {
          console.error('Socket.io reconnection failed');
          this.handleError('AUTH_FAILED', 'Reconnection failed', null);
        });

        // 認証エラーイベント
        this.socket.on('unauthorized', (error) => {
          console.error('Socket.io unauthorized:', error);
          this.handleError('AUTH_FAILED', 'Authentication failed', error);
          reject(error);
        });

        // 手動で接続開始
        this.socket.connect();
      } catch (error) {
        console.error('Socket.io connection setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Socket.io接続を切断
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /**
   * Socket.ioイベントリスナーを追加
   */
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    // Socket.ioにリスナーを登録
    if (this.socket) {
      this.socket.on(event as string, callback);
    }
  }

  /**
   * Socket.ioイベントリスナーを削除
   */
  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]): void {
    if (callback) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      if (this.socket) {
        this.socket.off(event as string, callback);
      }
    } else {
      // 全てのリスナーを削除
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event as string);
      }
    }
  }

  /**
   * Socket.ioイベントを送信
   */
  emit<K extends keyof SocketEvents>(event: K, data?: Parameters<SocketEvents[K]>[0]): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket.io not connected, cannot emit event:', event);
      return;
    }

    try {
      if (data) {
        this.socket.emit(event as string, data);
      } else {
        this.socket.emit(event as string);
      }
    } catch (error) {
      console.error('Socket.io emit error:', error);
      this.handleError('AUTH_FAILED', 'Failed to send event', error);
    }
  }

  /**
   * 接続状態を取得
   */
  getConnectionStatus(): SocketConnectionStatus {
    if (!this.socket) {
      return 'DISCONNECTED' as SocketConnectionStatus;
    }

    if (this.socket.connected) {
      return 'CONNECTED' as SocketConnectionStatus;
    }

    if (this.socket.connecting) {
      return 'CONNECTING' as SocketConnectionStatus;
    }

    return 'DISCONNECTED' as SocketConnectionStatus;
  }

  /**
   * 接続状態をチェック
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Socket.ioインスタンスを取得（デバッグ用）
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * WebSocketサーバーのURLを取得
   */
  private getServerUrl(): string {
    // GitHub CodespacesやVite開発環境では、プロキシ経由で同じオリジンを使用
    // Viteが /socket.io を http://localhost:3000 にプロキシする
    const serverUrl =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    console.log('[SocketClient] Using WebSocket server URL (via proxy):', serverUrl);
    return serverUrl;
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // 保存されたリスナーを再登録
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const callback of callbacks) {
        this.socket.on(event as string, callback);
      }
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(code: SocketError['code'], message: string, details?: any): void {
    const error: SocketError = {
      code,
      message,
      details,
      timestamp: new Date(),
    };

    console.error('Socket.io error:', error);
    this.notifyListeners('error', error);
  }

  /**
   * リスナーに通知
   */
  private notifyListeners<K extends keyof SocketEvents>(
    event: K,
    data: Parameters<SocketEvents[K]>[0]
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  }
}

// シングルトンインスタンス
export const socketClient = new SocketClient();
