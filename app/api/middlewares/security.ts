/**
 * セキュリティミドルウェア
 * CORS、セキュリティヘッダー、CSRF対策等の実装
 */

import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

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
              "'strict-dynamic'", // より安全なスクリプト実行
              ...(isDevelopment ? ["'unsafe-eval'"] : []), // 開発環境のみ
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: [
              "'self'",
              ...(isDevelopment ? ['ws:', 'wss:', 'http:', 'https:'] : ['wss:', 'https:']), // WebSocket
            ],
            objectSrc: ["'none'"], // オブジェクト埋め込みを無効化
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"], // フレーム埋め込みを無効化
            frameAncestors: ["'none'"], // 他サイトからのフレーム埋め込みを無効化
            baseUri: ["'self'"], // base URIを自サイトのみに制限
            formAction: ["'self'"], // フォーム送信先を自サイトのみに制限
            upgradeInsecureRequests: [], // HTTPSにアップグレード
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
    // 追加のセキュリティヘッダー
    hidePoweredBy: true, // X-Powered-By ヘッダーを隠す
    ieNoOpen: true, // IE8のファイル実行を防止
    dnsPrefetchControl: { allow: false }, // DNS prefetchを無効化
    permittedCrossDomainPolicies: false, // クロスドメインポリシーを無効化
  });
};

/**
 * Rate Limitingミドルウェア
 * 簡易的な実装（本格的にはredis-rate-limitなど使用）
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (
  maxRequests: number = 10, // テスト用に厳しい制限
  windowMs: number = 60 * 1000 // 1分間
): RequestHandler => {
  return (req, res, next) => {
    // IPアドレスとUser-Agentの組み合わせでキーを作成（より厳密）
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const key = `${ip}:${userAgent.substring(0, 100)}`; // User-Agentは100文字まで
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
      // レート制限ヘッダーを追加
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000).toString(),
      });

      console.warn(`Rate limit exceeded for ${key}`, {
        count: record.count,
        limit: maxRequests,
        resetTime: new Date(record.resetTime).toISOString(),
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'リクエスト数が上限を超えています',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
      });
    }

    record.count++;
    
    // レート制限ヘッダーを追加
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - record.count).toString(),
      'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000).toString(),
    });

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
 * XSS保護ミドルウェア - HTMLサニタイゼーション
 */
export const sanitizeInput: RequestHandler = (req, res, next) => {
  try {
    // リクエストボディのHTMLコンテンツをサニタイズ
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // クエリパラメータもサニタイズ
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'SANITIZATION_ERROR',
        message: '入力データの処理中にエラーが発生しました',
      },
    });
  }
};

/**
 * XSS検証ミドルウェア - 危険なパターンを早期に検出してブロック
 */
export const validateXSS: RequestHandler = (req, res, next) => {
  try {
    // XSSパターンの包括的なリスト
    const xssPatterns = [
      // JavaScriptスキーム（様々なバリエーション）
      /javascript:/i,
      /java\s*script:/i,
      /javascript%3A/i,
      /j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i,
      
      // VBScriptとデータURI
      /vbscript:/i,
      /data:text\/html/i,
      /data:.*base64/i,
      
      // HTMLタグインジェクション
      /<script[^>]*>/i,
      /<\/script>/i,
      /<iframe[^>]*>/i,
      /<\/iframe>/i,
      /<img[^>]*onerror/i,
      /<svg[^>]*onload/i,
      /<body[^>]*onload/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
      /<applet[^>]*>/i,
      
      // イベントハンドラ
      /on(load|error|click|mouse|key|focus|blur|change|submit|reset|select|drag|drop|copy|cut|paste|abort|canplay|canplaythrough|contextmenu|dblclick|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|durationchange|emptied|ended|input|invalid|loadeddata|loadedmetadata|loadstart|message|mousedown|mouseenter|mouseleave|mousemove|mouseout|mouseover|mouseup|mousewheel|pause|play|playing|progress|ratechange|readystatechange|scroll|seeked|seeking|stalled|suspend|timeupdate|toggle|volumechange|waiting|wheel|auxclick|beforeinput|compositionend|compositionstart|compositionupdate|focusin|focusout|fullscreenchange|fullscreenerror|gotpointercapture|lostpointercapture|pointercancel|pointerdown|pointerenter|pointerleave|pointermove|pointerout|pointerover|pointerup|touchcancel|touchend|touchmove|touchstart|transitioncancel|transitionend|transitionrun|transitionstart)\s*=/i,
      
      // その他の危険なパターン
      /expression\s*\(/i,
      /import\s+/i,
      /document\s*\./i,
      /window\s*\./i,
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /Function\s*\(/i,
    ];

    const checkForXSS = (value: any): boolean => {
      if (typeof value === 'string') {
        // デコードして検査（URLエンコードを回避する試みを防ぐ）
        const decoded = decodeURIComponent(value).toLowerCase();
        
        for (const pattern of xssPatterns) {
          if (pattern.test(value) || pattern.test(decoded)) {
            console.warn(`XSS pattern detected: ${pattern.source} in value: ${value.substring(0, 100)}`);
            return true;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const val of Object.values(value)) {
          if (checkForXSS(val)) {
            return true;
          }
        }
      }
      return false;
    };

    // リクエストボディをチェック
    if (req.body && checkForXSS(req.body)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'XSS_DETECTED',
          message: '不正なスクリプトが検出されました',
        },
      });
    }

    // クエリパラメータをチェック
    if (req.query && checkForXSS(req.query)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'XSS_DETECTED',
          message: '不正なクエリパラメータが検出されました',
        },
      });
    }

    // URLパラメータをチェック
    if (req.params && checkForXSS(req.params)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'XSS_DETECTED',
          message: '不正なURLパラメータが検出されました',
        },
      });
    }

    next();
  } catch (error) {
    console.error('XSS validation error:', error);
    next();
  }
};

/**
 * オブジェクト内の文字列を再帰的にサニタイズ
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // 危険なスクリプトスキームとHTMLタグを除去（より厳密なパターン）
    // URLエンコードされたjavascript:も検出
    const dangerousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      /<iframe/i,
      /<script/i,
      /<svg/i,
      /<img.*onerror/i,
      /<body.*onload/i,
      /javascript%3A/i,  // URLエンコードされたjavascript:
      /java\s*script:/i,  // スペースを含むjavascript:
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(obj)) {
        console.warn('Blocked dangerous content:', obj.substring(0, 50));
        throw new Error('DANGEROUS_CONTENT_DETECTED');
      }
    }

    // Null文字とUnicode制御文字を除去
    let sanitized = obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // HTMLタグと危険なスクリプトを除去
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [], // HTMLタグを一切許可しない
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // テキストコンテンツは保持
    });

    return sanitized;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // キー名もサニタイズ（SQLインジェクション対策）
      const sanitizedKey = DOMPurify.sanitize(key, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * SQL インジェクション対策 - 危険なパターンの検出
 */
export const validateSqlInjection: RequestHandler = (req, res, next) => {
  try {
    const suspiciousPatterns = [
      // SQL キーワード
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|OR|AND)\b/gi,
      // SQLコメント（より厳密）
      /(--+|\#+|\/\*|\*\/)/g,
      // SQL文字列エスケープと引用符（より厳密）
      /('.*?'|".*?"|\\'|\\")/g,
      // SQLファンクション
      /\b(CONCAT|SUBSTRING|ASCII|CHAR|LENGTH|ADMIN|VERSION|COUNT|MAX|MIN)\s*\(/gi,
      // 特定のSQLインジェクションパターン
      /('|\")?\s*(OR|AND)\s*('|\")?[0-9]+\s*=\s*[0-9]+/gi,
      // admin with quotes and comments
      /admin['\s]*['\"]?\s*(--|#)/gi,
      // Single quotes followed by SQL keywords
      /'[^']*\s*(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE)/gi,
      // Numbers with SQL operators
      /\d+['\s]*\s*(AND|OR)\s+/gi,
    ];

    const checkForSqlInjection = (value: any, path: string = ''): boolean => {
      if (typeof value === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value)) {
            console.warn(`Potential SQL injection detected at ${path}:`, value);
            return true;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          if (checkForSqlInjection(val, `${path}.${key}`)) {
            return true;
          }
        }
      }
      return false;
    };

    // リクエストボディをチェック
    if (req.body && checkForSqlInjection(req.body, 'body')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POTENTIAL_SQL_INJECTION',
          message: '不正な入力が検出されました',
        },
      });
    }

    // クエリパラメータをチェック
    if (req.query && checkForSqlInjection(req.query, 'query')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POTENTIAL_SQL_INJECTION',
          message: '不正なクエリパラメータが検出されました',
        },
      });
    }

    next();
  } catch (error) {
    console.error('SQL injection validation error:', error);
    next();
  }
};

/**
 * 入力バリデーションスキーマ
 */
export const commonSchemas = {
  // チャット関連
  chatMessage: z.object({
    content: z.string().min(1).max(2000),
    roomId: z.string().uuid(),
  }),

  chatRoom: z.object({
    name: z.string().min(1).max(100).optional(),
    type: z.enum(['DIRECT', 'GROUP']),
    description: z.string().max(500).optional(),
    memberIds: z.array(z.number().int().positive()),
  }),

  // ユーザー関連
  userLogin: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(100),
  }),

  userSearch: z.object({
    q: z.string()
      .min(1, "検索クエリは必須です")
      .max(100, "検索クエリは100文字以内で入力してください")
      .refine(val => val.trim().length > 0, "空の検索クエリは無効です")
      .refine(val => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(val), "制御文字は使用できません")
      .transform(val => val.trim()),
  }),
};

/**
 * Zodバリデーションミドルウェア
 */
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validationTarget = req.method === 'GET' ? req.query : req.body;
      const result = schema.safeParse(validationTarget);

      if (!result.success) {
        const errors = (result.error?.errors || []).map((err) => ({
          field: err.path?.join('.') || 'unknown',
          message: err.message || 'Validation failed',
        }));

        if (errors.length === 0) {
          errors.push({ field: 'unknown', message: 'Validation failed' });
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '入力データが無効です',
            details: errors,
          },
        });
      }

      // バリデーション済みデータを上書き
      if (req.method === 'GET') {
        req.query = result.data;
      } else {
        req.body = result.data;
      }

      next();
    } catch (error) {
      console.error('Schema validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_SYSTEM_ERROR',
          message: 'バリデーションシステムエラーが発生しました',
        },
      });
    }
  };
};

/**
 * セキュリティログ記録
 */
export const logSecurityEvents: RequestHandler = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    // セキュリティ関連のステータスコードをログ記録
    if ([400, 401, 403, 429].includes(res.statusCode)) {
      console.warn('Security event:', {
        status: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        body: req.method !== 'GET' ? '[REDACTED]' : undefined,
        query: req.method === 'GET' ? '[REDACTED]' : undefined,
      });
    }

    return originalSend.call(this, data);
  };

  next();
};
