/**
 * セッション管理ミドルウェア
 * Redis を使用したセッションストレージの設定
 */

import RedisStore from 'connect-redis';
import type { RequestHandler } from 'express';
import session from 'express-session';
import Redis from 'ioredis';

/**
 * セッション設定
 */
interface SessionConfig {
  secret: string;
  redisUrl?: string;
  secure?: boolean;
  maxAge?: number;
}

/**
 * Redis クライアントを作成
 */
const createRedisClient = (redisUrl?: string): Redis | null => {
  if (!redisUrl) {
    console.warn('Redis URL not provided, using in-memory session store');
    return null;
  }

  try {
    const redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected for session storage');
    });

    return redis;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    return null;
  }
};

/**
 * セッションミドルウェアを設定
 */
export const configureSession = (config: SessionConfig): RequestHandler => {
  const {
    secret,
    redisUrl,
    secure = process.env.NODE_ENV === 'production',
    maxAge = 24 * 60 * 60 * 1000, // 24時間
  } = config;

  // Redis セッションストア設定
  const redis = createRedisClient(redisUrl);
  const store = redis ? new RedisStore({ client: redis }) : undefined;

  // セッション設定
  const sessionConfig: session.SessionOptions = {
    store,
    secret,
    resave: false,
    saveUninitialized: false,
    name: 'nanika.session.id',
    cookie: {
      secure,
      httpOnly: true,
      maxAge,
      sameSite: secure ? 'strict' : 'lax', // CSRF対策
    },
    rolling: true, // セッション期限の自動延長
  };

  if (!store) {
    console.warn('Using in-memory session store (not recommended for production)');
  }

  return session(sessionConfig);
};

/**
 * セッション健全性チェックミドルウェア
 * セッションの整合性を確認し、不正なセッションを破棄
 */
export const validateSession: RequestHandler = (req, res, next) => {
  try {
    // セッション存在チェック
    if (!req.session) {
      console.warn('Session not initialized');
      return next();
    }

    // 認証セッションの整合性チェック
    if (req.session.isAuthenticated) {
      // 必須フィールドチェック
      if (!req.session.userId || !req.session.createdAt) {
        console.warn('Invalid authenticated session, destroying');
        req.session.destroy((err) => {
          if (err) console.error('Session destroy error:', err);
        });
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: '無効なセッションです',
          },
        });
      }

      // セッション期限チェック
      if (req.session.expiresAt && new Date() > req.session.expiresAt) {
        req.session.destroy((err) => {
          if (err) console.error('Session destroy error:', err);
        });
        return res.status(419).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'セッションの有効期限が切れています',
          },
        });
      }
    }

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    next();
  }
};

/**
 * セッション統計情報を取得
 */
export const getSessionStats = async (redisUrl?: string) => {
  const redis = createRedisClient(redisUrl);
  if (!redis) {
    return { store: 'memory', activeSessions: 'unknown' };
  }

  try {
    const keys = await redis.keys('sess:*');
    return {
      store: 'redis',
      activeSessions: keys.length,
      redisConnected: redis.status === 'ready',
    };
  } catch (error) {
    console.error('Failed to get session stats:', error);
    return { store: 'redis', activeSessions: 'error', error: error.message };
  }
};
