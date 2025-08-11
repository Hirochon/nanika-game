/**
 * 認証ミドルウェア
 * Express + React Router統合用の認証システム
 */

import type { NextFunction, Request, Response } from 'express';

// セッション情報を拡張
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
    isAuthenticated?: boolean;
    createdAt?: Date;
    expiresAt?: Date;
  }
}

// Request型拡張
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * セッションベース認証ミドルウェア
 * セッションから認証情報を確認し、リクエストにユーザー情報を付加
 */
export const authenticateSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // セッションから認証情報を確認
    if (!req.session || !req.session.isAuthenticated || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: '認証が必要です',
        },
      });
    }

    // セッション期限チェック
    if (req.session.expiresAt && new Date() > req.session.expiresAt) {
      // 期限切れセッションをクリア
      req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
      });

      return res.status(419).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_TIMEOUT',
          message: 'セッションの有効期限が切れています',
        },
      });
    }

    // ユーザー情報をリクエストに追加
    req.user = {
      id: req.session.userId,
      email: req.session.email || '',
    };

    // セッション更新（アクティビティ延長）
    req.session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: '認証処理中にエラーが発生しました',
      },
    });
  }
};

/**
 * オプション認証ミドルウェア
 * 認証されていなくてもエラーにならず、認証情報があれば付加
 */
export const optionalAuthentication = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (req.session?.isAuthenticated && req.session?.userId) {
      // セッション期限チェック（期限切れでもエラーにしない）
      if (!req.session.expiresAt || new Date() <= req.session.expiresAt) {
        req.user = {
          id: req.session.userId,
          email: req.session.email || '',
        };

        // セッション更新
        req.session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    // エラーがあってもリクエストを継続
    next();
  }
};

/**
 * ログイン処理ヘルパー
 * セッションに認証情報を設定
 */
export const loginUser = (req: Request, userId: string, email: string) => {
  if (!req.session) {
    throw new Error('Session not initialized');
  }

  req.session.userId = userId;
  req.session.email = email;
  req.session.isAuthenticated = true;
  req.session.createdAt = new Date();
  req.session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後

  return req.session;
};

/**
 * ログアウト処理ヘルパー
 * セッションを破棄
 */
export const logoutUser = (req: Request): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.destroy((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * WebSocket認証ハンドシェイクミドルウェア
 * WebSocket接続時の認証確認用
 */
export const authenticateWebSocket = async (socket: any, next: any) => {
  try {
    // クッキーからセッション情報を取得
    const sessionId = socket.handshake.headers.cookie
      ?.split('; ')
      .find((c: string) => c.startsWith('connect.sid='))
      ?.split('=')[1];

    if (!sessionId) {
      return next(new Error('WEBSOCKET_AUTH_FAILED: セッションが見つかりません'));
    }

    // TODO: セッションストアからセッション情報を取得
    // const sessionService = container.resolve<SessionService>('SessionService');
    // const session = await sessionService.getSession(sessionId);

    // 暫定的に socket にセッション情報を設定
    // 実際の実装では Redis などから取得
    // socket.userId = session?.userId;
    // socket.email = session?.email;

    next();
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    next(new Error('WEBSOCKET_AUTH_FAILED: 認証に失敗しました'));
  }
};

// 型エクスポート
export type { AuthenticatedRequest };
