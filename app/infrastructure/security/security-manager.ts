/**
 * Security Manager - 包括的セキュリティ対策
 * Infrastructure-specialist によるセキュリティ強化実装
 */

import helmet from 'helmet';
import type Redis from 'ioredis';

export interface SecurityConfig {
  rateLimit: {
    window: number;
    max: number;
    skipSuccessfulRequests?: boolean;
  };
  csrf: {
    secret: string;
    cookieName: string;
    headerName: string;
  };
  xss: {
    allowedTags: string[];
    allowedAttributes: Record<string, string[]>;
  };
  headers: {
    hsts: boolean;
    noSniff: boolean;
    frameOptions: string;
    xssProtection: boolean;
  };
}

export interface SecurityEvent {
  type: 'rate_limit' | 'csrf_violation' | 'xss_attempt' | 'sql_injection' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: any;
  timestamp: Date;
  userId?: number;
}

export class SecurityManager {
  private redis: Redis;
  private config: SecurityConfig;
  private securityEvents: SecurityEvent[] = [];

  constructor(redis: Redis, config: SecurityConfig) {
    this.redis = redis;
    this.config = config;
    this.startSecurityMonitoring();
  }

  /**
   * Helmet設定による基本セキュリティヘッダー
   */
  getHelmetConfig() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },

      // HTTP Strict Transport Security
      hsts: this.config.headers.hsts
        ? {
            maxAge: 31536000, // 1年
            includeSubDomains: true,
            preload: true,
          }
        : false,

      // X-Content-Type-Options
      noSniff: this.config.headers.noSniff,

      // X-Frame-Options
      frameguard: { action: this.config.headers.frameOptions as any },

      // X-XSS-Protection
      xssFilter: this.config.headers.xssProtection,

      // Referrer Policy
      referrerPolicy: { policy: ['no-referrer', 'strict-origin-when-cross-origin'] },

      // Permission Policy
      permittedCrossDomainPolicies: false,
    });
  }

  /**
   * レート制限ミドルウェア
   */
  async checkRateLimit(
    identifier: string,
    action: string = 'default',
    customLimit?: { window: number; max: number }
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const limit = customLimit || this.config.rateLimit;
    const key = `rate_limit:${action}:${identifier}`;

    try {
      const current = await this.redis.get(key);
      const now = Date.now();
      const windowStart = Math.floor(now / (limit.window * 1000)) * (limit.window * 1000);
      const resetTime = windowStart + limit.window * 1000;

      if (!current) {
        // 初回リクエスト
        await this.redis.setex(key, limit.window, '1');
        return {
          allowed: true,
          remaining: limit.max - 1,
          resetTime,
        };
      }

      const count = parseInt(current);

      if (count >= limit.max) {
        // 制限超過
        await this.logSecurityEvent({
          type: 'rate_limit',
          severity: 'medium',
          source: identifier,
          details: { action, count, limit: limit.max },
          timestamp: new Date(),
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }

      // カウンター増加
      await this.redis.incr(key);
      await this.redis.expire(key, limit.window);

      return {
        allowed: true,
        remaining: limit.max - count - 1,
        resetTime,
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // エラー時は通す（fail-open）
      return {
        allowed: true,
        remaining: limit.max,
        resetTime: Date.now() + limit.window * 1000,
      };
    }
  }

  /**
   * CSRF トークン生成
   */
  async generateCSRFToken(sessionId: string): Promise<string> {
    const token = this.generateSecureToken(32);
    const key = `csrf:${sessionId}`;

    // 1時間有効
    await this.redis.setex(key, 3600, token);

    return token;
  }

  /**
   * CSRF トークン検証
   */
  async validateCSRFToken(sessionId: string, token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') {
      await this.logSecurityEvent({
        type: 'csrf_violation',
        severity: 'high',
        source: sessionId,
        details: { reason: 'missing_token' },
        timestamp: new Date(),
      });
      return false;
    }

    const key = `csrf:${sessionId}`;
    const validToken = await this.redis.get(key);

    if (!validToken || validToken !== token) {
      await this.logSecurityEvent({
        type: 'csrf_violation',
        severity: 'high',
        source: sessionId,
        details: { reason: 'invalid_token', provided: token },
        timestamp: new Date(),
      });
      return false;
    }

    return true;
  }

  /**
   * XSS対策 - HTMLサニタイゼーション
   */
  sanitizeHTML(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // 基本的なHTMLエスケープ
    const sanitized = input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // 危険なJavaScriptパターンの検出
    const dangerousPatterns = [
      /javascript:/i,
      /on\w+\s*=/i,
      /<script/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:text\/html/i,
    ];

    let hasXSSAttempt = false;
    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        hasXSSAttempt = true;
        break;
      }
    }

    if (hasXSSAttempt) {
      this.logSecurityEvent({
        type: 'xss_attempt',
        severity: 'high',
        source: 'input_validation',
        details: { input: input.substring(0, 200) },
        timestamp: new Date(),
      });
    }

    return sanitized;
  }

  /**
   * SQLインジェクション対策 - 危険なパターンの検出
   */
  detectSQLInjection(input: string): boolean {
    if (!input || typeof input !== 'string') return false;

    const sqlPatterns = [
      /(\s|^)(select|insert|update|delete|drop|create|alter|exec|execute|union|or|and)\s/i,
      /(\s|^)(script|javascript|vbscript):/i,
      /['";][\s]*((select|insert|update|delete|drop|create|alter|exec|execute|union)\s|(\d+\s*=\s*\d+))/i,
      /(^|\s)(or|and)\s+[\w\s]*\s*=\s*[\w\s]*/i,
      /\s*(union|select).*from/i,
      /\s*drop\s+(table|database)/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        this.logSecurityEvent({
          type: 'sql_injection',
          severity: 'critical',
          source: 'input_validation',
          details: { input: input.substring(0, 200) },
          timestamp: new Date(),
        });
        return true;
      }
    }

    return false;
  }

  /**
   * 入力検証 - 包括的バリデーション
   */
  validateInput(input: any, rules: ValidationRules): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      sanitizedValue: input,
    };

    // 型チェック
    if (rules.type && typeof input !== rules.type) {
      result.isValid = false;
      result.errors.push(`Expected ${rules.type}, got ${typeof input}`);
      return result;
    }

    // 必須チェック
    if (rules.required && (input === null || input === undefined || input === '')) {
      result.isValid = false;
      result.errors.push('Field is required');
      return result;
    }

    // 文字列の場合の詳細検証
    if (typeof input === 'string') {
      // 長さチェック
      if (rules.minLength && input.length < rules.minLength) {
        result.isValid = false;
        result.errors.push(`Minimum length is ${rules.minLength}`);
      }

      if (rules.maxLength && input.length > rules.maxLength) {
        result.isValid = false;
        result.errors.push(`Maximum length is ${rules.maxLength}`);
      }

      // パターンマッチング
      if (rules.pattern && !rules.pattern.test(input)) {
        result.isValid = false;
        result.errors.push('Invalid format');
      }

      // セキュリティチェック
      if (rules.preventXSS) {
        result.sanitizedValue = this.sanitizeHTML(input);
      }

      if (rules.preventSQLInjection && this.detectSQLInjection(input)) {
        result.isValid = false;
        result.errors.push('Potentially dangerous input detected');
      }
    }

    // 数値の場合の範囲チェック
    if (typeof input === 'number') {
      if (rules.min !== undefined && input < rules.min) {
        result.isValid = false;
        result.errors.push(`Minimum value is ${rules.min}`);
      }

      if (rules.max !== undefined && input > rules.max) {
        result.isValid = false;
        result.errors.push(`Maximum value is ${rules.max}`);
      }
    }

    return result;
  }

  /**
   * チャットメッセージ専用バリデーション
   */
  validateChatMessage(content: string): ValidationResult {
    return this.validateInput(content, {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 2000,
      preventXSS: true,
      preventSQLInjection: true,
      pattern: /^[\s\S]*$/, // 任意の文字（改行含む）
    });
  }

  /**
   * ユーザー入力専用バリデーション
   */
  validateUserInput(field: string, value: any): ValidationResult {
    const rules: Record<string, ValidationRules> = {
      email: {
        type: 'string',
        required: true,
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        preventXSS: true,
      },
      name: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50,
        preventXSS: true,
        preventSQLInjection: true,
        pattern: /^[\w\s\-.']+$/,
      },
      password: {
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      },
      chatRoomName: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 100,
        preventXSS: true,
        preventSQLInjection: true,
        pattern: /^[\w\s\-.'!?]+$/,
      },
    };

    const rule = rules[field];
    if (!rule) {
      return {
        isValid: false,
        errors: [`Unknown field: ${field}`],
        sanitizedValue: value,
      };
    }

    return this.validateInput(value, rule);
  }

  /**
   * IPアドレスベースの不審なアクティビティ検出
   */
  async detectSuspiciousActivity(
    ip: string,
    activity: string,
    threshold: { count: number; window: number } = { count: 10, window: 300 }
  ): Promise<boolean> {
    const key = `suspicious:${ip}:${activity}`;

    try {
      const current = await this.redis.get(key);

      if (!current) {
        await this.redis.setex(key, threshold.window, '1');
        return false;
      }

      const count = parseInt(current);
      if (count >= threshold.count) {
        await this.logSecurityEvent({
          type: 'unauthorized_access',
          severity: 'high',
          source: ip,
          details: { activity, count, threshold },
          timestamp: new Date(),
        });
        return true;
      }

      await this.redis.incr(key);
      await this.redis.expire(key, threshold.window);
      return false;
    } catch (error) {
      console.error('Suspicious activity detection error:', error);
      return false;
    }
  }

  /**
   * セッション固定攻撃対策
   */
  async regenerateSession(oldSessionId: string): Promise<string> {
    const newSessionId = this.generateSecureToken(32);

    // 古いセッションデータを新しいセッションに移行
    const oldSessionKey = `session:${oldSessionId}`;
    const newSessionKey = `session:${newSessionId}`;

    const sessionData = await this.redis.get(oldSessionKey);
    if (sessionData) {
      await this.redis.setex(newSessionKey, 3600, sessionData);
      await this.redis.del(oldSessionKey);
    }

    return newSessionId;
  }

  /**
   * セキュアトークン生成
   */
  private generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 時間戳を追加してユニーク性を保証
    return result + Date.now().toString(36);
  }

  /**
   * セキュリティイベントのログ記録
   */
  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // メモリ内履歴に追加
      this.securityEvents.push(event);

      // 最新1000件を保持
      if (this.securityEvents.length > 1000) {
        this.securityEvents.shift();
      }

      // Redisにも記録（24時間保持）
      const eventKey = `security_event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      await this.redis.setex(eventKey, 86400, JSON.stringify(event));

      // クリティカルなイベントは即座にアラート
      if (event.severity === 'critical') {
        console.error('CRITICAL SECURITY EVENT:', event);
        // 実際の実装では外部通知システム（Slack、メール等）に送信
      }

      console.log(`Security event logged: ${event.type} (${event.severity}) from ${event.source}`);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * セキュリティ監視開始
   */
  private startSecurityMonitoring(): void {
    // 定期的なセキュリティイベント分析
    setInterval(async () => {
      await this.analyzeSecurityTrends();
    }, 300000); // 5分毎

    // 異常検出
    setInterval(async () => {
      await this.detectAnomalies();
    }, 60000); // 1分毎
  }

  /**
   * セキュリティトレンド分析
   */
  private async analyzeSecurityTrends(): Promise<void> {
    const recentEvents = this.securityEvents.filter(
      (event) => Date.now() - event.timestamp.getTime() < 300000 // 5分以内
    );

    const eventCounts = recentEvents.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // 異常なパターンの検出
    for (const [eventType, count] of Object.entries(eventCounts)) {
      const threshold = this.getEventThreshold(eventType);

      if (count > threshold) {
        await this.logSecurityEvent({
          type: 'unauthorized_access',
          severity: 'high',
          source: 'security_monitor',
          details: {
            anomaly: 'event_spike',
            eventType,
            count,
            threshold,
            window: '5min',
          },
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * 異常検出
   */
  private async detectAnomalies(): Promise<void> {
    try {
      // Redis から異常な活動パターンを検出
      const patterns = ['rate_limit:*', 'suspicious:*', 'security_event:*'];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);

        // パターン毎の統計分析
        if (keys.length > 100) {
          // 閾値を超えた場合
          console.warn(`Anomaly detected: ${pattern} has ${keys.length} active keys`);
        }
      }
    } catch (error) {
      console.error('Anomaly detection error:', error);
    }
  }

  /**
   * イベントタイプ別の閾値取得
   */
  private getEventThreshold(eventType: string): number {
    const thresholds: Record<string, number> = {
      rate_limit: 20,
      csrf_violation: 5,
      xss_attempt: 3,
      sql_injection: 1,
      unauthorized_access: 10,
    };

    return thresholds[eventType] || 10;
  }

  /**
   * セキュリティレポート生成
   */
  generateSecurityReport(): SecurityReport {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    const dayAgo = new Date(now.getTime() - 86400000);

    const recentEvents = this.securityEvents.filter((event) => event.timestamp >= hourAgo);
    const dailyEvents = this.securityEvents.filter((event) => event.timestamp >= dayAgo);

    const eventsByType = recentEvents.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const eventsBySeverity = recentEvents.reduce(
      (acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      timestamp: now,
      period: {
        recent: '1 hour',
        daily: '24 hours',
      },
      summary: {
        totalEvents: recentEvents.length,
        criticalEvents: eventsBySeverity.critical || 0,
        highSeverityEvents: eventsBySeverity.high || 0,
        mostCommonEvent:
          Object.entries(eventsByType).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
      },
      eventsByType,
      eventsBySeverity,
      dailyTrends: {
        totalEvents: dailyEvents.length,
        averagePerHour: Math.round(dailyEvents.length / 24),
      },
      recommendations: this.generateRecommendations(recentEvents),
    };
  }

  /**
   * セキュリティ推奨事項生成
   */
  private generateRecommendations(events: SecurityEvent[]): string[] {
    const recommendations: string[] = [];

    const eventCounts = events.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    if (eventCounts.rate_limit > 10) {
      recommendations.push('Consider adjusting rate limit thresholds or implementing CAPTCHA');
    }

    if (eventCounts.xss_attempt > 0) {
      recommendations.push('Review input validation and consider implementing stricter CSP');
    }

    if (eventCounts.sql_injection > 0) {
      recommendations.push('URGENT: Review database queries and ensure parameterized queries');
    }

    if (eventCounts.csrf_violation > 5) {
      recommendations.push('Review CSRF token implementation and cookie security');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security status appears normal, continue monitoring');
    }

    return recommendations;
  }

  /**
   * セキュリティ統計取得
   */
  getSecurityStats(): {
    totalEvents: number;
    recentEvents: number;
    eventsByType: Record<string, number>;
    lastUpdate: Date;
  } {
    const recentEvents = this.securityEvents.filter(
      (event) => Date.now() - event.timestamp.getTime() < 3600000
    );

    const eventsByType = this.securityEvents.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalEvents: this.securityEvents.length,
      recentEvents: recentEvents.length,
      eventsByType,
      lastUpdate: new Date(),
    };
  }
}

// 型定義
export interface ValidationRules {
  type?: 'string' | 'number' | 'boolean' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  preventXSS?: boolean;
  preventSQLInjection?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue: any;
}

export interface SecurityReport {
  timestamp: Date;
  period: {
    recent: string;
    daily: string;
  };
  summary: {
    totalEvents: number;
    criticalEvents: number;
    highSeverityEvents: number;
    mostCommonEvent: string;
  };
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  dailyTrends: {
    totalEvents: number;
    averagePerHour: number;
  };
  recommendations: string[];
}
