/**
 * セキュリティミドルウェア
 * CORS、セキュリティヘッダー、CSRF対策等の実装
 */

import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * セキュリティ設定
 */
interface SecurityConfig {
  corsOrigins: string[];
  isDevelopment: boolean;
  contentSecurityPolicy?: boolean;
}

/**
 * CORS設定を作成
 */
export const configureCors = (origins: string[]): RequestHandler => {
  return cors({
    origin: (origin, callback) => {
      const isDevelopment = process.env.NODE_ENV === 'development';

      // originがない場合（同一オリジンリクエスト、Postmanなど）は許可
      if (!origin) {
        return callback(null, true);
      }

      // 開発環境では全てのoriginを許可（localhost:5174などの動的ポートに対応）
      if (isDevelopment) {
        return callback(null, true);
      }

      // 本番環境では許可リストをチェック
      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // セッションクッキーを送信するため
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
    ],
  });
};

/**
 * セキュリティヘッダー設定
 */
export const configureHelmet = (config: SecurityConfig): RequestHandler => {
  const { isDevelopment, contentSecurityPolicy = !isDevelopment } = config;

  return helmet({
    contentSecurityPolicy: contentSecurityPolicy
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'", // Tailwind CSS用
              'https://fonts.googleapis.com',
            ],
            scriptSrc: [
              "'self'",
              ...(isDevelopment ? ["'unsafe-eval'"] : []), // 開発環境のみ
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: [
              "'self'",
              ...(isDevelopment ? ['ws:', 'wss:'] : ['wss:']), // WebSocket
            ],
          },
        }
      : false,
    crossOriginEmbedderPolicy: !isDevelopment,
    hsts: {
      maxAge: 31536000, // 1年
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
};

/**
 * Rate Limitingミドルウェア
 * 簡易的な実装（本格的にはredis-rate-limitなど使用）
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15分
): RequestHandler => {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // 新しいウィンドウまたは初回
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'リクエスト数が上限を超えています',
        },
      });
    }

    record.count++;
    next();
  };
};

/**
 * Content-Type検証
 * APIエンドポイントでJSONのみ受け付ける
 */
export const validateContentType: RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.is('json')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type は application/json である必要があります',
        },
      });
    }
  }
  next();
};

/**
 * Request Size制限
 */
export const limitRequestSize = (limit: string = '1mb'): RequestHandler => {
  return (req, res, next) => {
    const contentLength = req.get('Content-Length');
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const limitInBytes = parseSize(limit);

      if (sizeInBytes > limitInBytes) {
        return res.status(413).json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'リクエストサイズが上限を超えています',
          },
        });
      }
    }
    next();
  };
};

/**
 * サイズ文字列をバイト数に変換
 */
const parseSize = (size: string): number => {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);

  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'b') as keyof typeof units;

  return value * units[unit];
};

/**
 * セキュリティログ記録
 */
export const logSecurityEvents: RequestHandler = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    // セキュリティ関連のステータスコードをログ記録
    if ([401, 403, 429].includes(res.statusCode)) {
      console.warn('Security event:', {
        status: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend.call(this, data);
  };

  next();
};
