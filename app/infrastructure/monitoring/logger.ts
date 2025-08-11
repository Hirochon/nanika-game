/**
 * Advanced Logging System
 * Infrastructure-specialist による包括的ログシステム
 */

import type Redis from 'ioredis';
import winston from 'winston';

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  service: string;
  userId?: number;
  sessionId?: string;
  requestId?: string;
  metadata?: any;
  performance?: {
    duration: number;
    memory: number;
    cpu?: number;
  };
}

export interface LoggerConfig {
  level: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRedis: boolean;
  filePath?: string;
  maxFileSize?: string;
  maxFiles?: number;
  redisKey?: string;
}

export class Logger {
  private winston: winston.Logger;
  private redis: Redis;
  private config: LoggerConfig;
  private performanceMetrics: Map<string, number> = new Map();

  constructor(redis: Redis, config: LoggerConfig) {
    this.redis = redis;
    this.config = config;
    this.setupWinston();
    this.startPerformanceMonitoring();
  }

  /**
   * Winston ロガーのセットアップ
   */
  private setupWinston(): void {
    const transports: winston.transport[] = [];

    // コンソール出力
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ level, message, timestamp, service, userId, requestId }) => {
              let logLine = `${timestamp} [${level}] ${service}: ${message}`;
              if (userId) logLine += ` (user:${userId})`;
              if (requestId) logLine += ` (req:${requestId})`;
              return logLine;
            })
          ),
        })
      );
    }

    // ファイル出力
    if (this.config.enableFile && this.config.filePath) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath,
          maxsize: this.parseSize(this.config.maxFileSize || '10MB'),
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
      );

      // エラー専用ファイル
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath.replace('.log', '.error.log'),
          level: 'error',
          maxsize: this.parseSize(this.config.maxFileSize || '10MB'),
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
      );
    }

    this.winston = winston.createLogger({
      level: this.config.level,
      transports,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      // 例外とrejectionの処理
      exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
      rejectionHandlers: [new winston.transports.File({ filename: 'logs/rejections.log' })],
    });
  }

  /**
   * 情報ログ
   */
  info(
    message: string,
    metadata?: any,
    context?: {
      service?: string;
      userId?: number;
      sessionId?: string;
      requestId?: string;
    }
  ): void {
    this.log('info', message, metadata, context);
  }

  /**
   * 警告ログ
   */
  warn(
    message: string,
    metadata?: any,
    context?: {
      service?: string;
      userId?: number;
      sessionId?: string;
      requestId?: string;
    }
  ): void {
    this.log('warn', message, metadata, context);
  }

  /**
   * エラーログ
   */
  error(
    message: string,
    error?: Error | any,
    context?: {
      service?: string;
      userId?: number;
      sessionId?: string;
      requestId?: string;
    }
  ): void {
    let metadata = error;

    if (error instanceof Error) {
      metadata = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...error,
      };
    }

    this.log('error', message, metadata, context);
  }

  /**
   * デバッグログ
   */
  debug(
    message: string,
    metadata?: any,
    context?: {
      service?: string;
      userId?: number;
      sessionId?: string;
      requestId?: string;
    }
  ): void {
    this.log('debug', message, metadata, context);
  }

  /**
   * パフォーマンスログ
   */
  performance(
    operation: string,
    duration: number,
    context?: {
      service?: string;
      userId?: number;
      sessionId?: string;
      requestId?: string;
      additionalMetrics?: any;
    }
  ): void {
    const memoryUsage = process.memoryUsage();

    const performanceData = {
      operation,
      duration: Math.round(duration * 100) / 100, // 小数点2桁
      memory: {
        rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100, // MB
        heapUsed: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotal: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
      ...context?.additionalMetrics,
    };

    // パフォーマンスメトリクスの更新
    this.updatePerformanceMetrics(operation, duration);

    // ログ出力
    this.log('info', `Performance: ${operation}`, performanceData, {
      service: 'performance',
      ...context,
    });

    // Redis にパフォーマンス履歴を保存
    if (this.config.enableRedis) {
      this.savePerformanceMetric(performanceData).catch((err) => {
        console.error('Failed to save performance metric:', err);
      });
    }
  }

  /**
   * セキュリティログ
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: any,
    context?: {
      userId?: number;
      sessionId?: string;
      ip?: string;
      userAgent?: string;
    }
  ): void {
    const securityData = {
      event,
      severity,
      details,
      ip: context?.ip,
      userAgent: context?.userAgent,
      timestamp: new Date().toISOString(),
    };

    // セキュリティイベントは常にWARNレベル以上
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';

    this.log(logLevel, `Security Event: ${event}`, securityData, {
      service: 'security',
      userId: context?.userId,
      sessionId: context?.sessionId,
    });

    // Redis にセキュリティイベントを保存
    if (this.config.enableRedis) {
      this.saveSecurityEvent(securityData).catch((err) => {
        console.error('Failed to save security event:', err);
      });
    }
  }

  /**
   * WebSocketログ
   */
  websocket(
    event: 'connect' | 'disconnect' | 'message' | 'error' | 'authenticate',
    socketId: string,
    details?: any,
    context?: {
      userId?: number;
      roomId?: string;
      duration?: number;
    }
  ): void {
    const websocketData = {
      event,
      socketId: `${socketId.substring(0, 8)}...`, // プライバシー考慮で部分マスク
      userId: context?.userId,
      roomId: context?.roomId,
      duration: context?.duration,
      details,
      timestamp: new Date().toISOString(),
    };

    this.log('info', `WebSocket ${event}`, websocketData, {
      service: 'websocket',
      userId: context?.userId,
    });
  }

  /**
   * データベースログ
   */
  database(
    operation: 'select' | 'insert' | 'update' | 'delete' | 'transaction',
    table: string,
    duration: number,
    rowsAffected?: number,
    context?: {
      userId?: number;
      sessionId?: string;
      requestId?: string;
    }
  ): void {
    const dbData = {
      operation,
      table,
      duration: Math.round(duration * 100) / 100,
      rowsAffected,
      timestamp: new Date().toISOString(),
    };

    // スロークエリの警告
    const logLevel = duration > 1000 ? 'warn' : 'debug';
    const message =
      duration > 1000
        ? `Slow Database Query: ${operation} on ${table}`
        : `Database Query: ${operation} on ${table}`;

    this.log(logLevel, message, dbData, {
      service: 'database',
      ...context,
    });
  }

  /**
   * APIアクセスログ
   */
  api(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: {
      userId?: number;
      sessionId?: string;
      requestId?: string;
      ip?: string;
      userAgent?: string;
    }
  ): void {
    const apiData = {
      method,
      path,
      statusCode,
      duration: Math.round(duration * 100) / 100,
      ip: context?.ip,
      userAgent: context?.userAgent?.substring(0, 100), // 長いUser-Agentを短縮
      timestamp: new Date().toISOString(),
    };

    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `API ${method} ${path} - ${statusCode}`;

    this.log(logLevel, message, apiData, {
      service: 'api',
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
    });
  }

  /**
   * 基本ログ関数
   */
  private log(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    metadata?: any,
    context?: {
      service?: string;
      userId?: number;
      sessionId?: string;
      requestId?: string;
    }
  ): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      service: context?.service || 'app',
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
      metadata,
    };

    // Winston への出力
    this.winston.log(level, message, logEntry);

    // Redis への保存（非同期、エラーは無視）
    if (this.config.enableRedis) {
      this.saveLogToRedis(logEntry).catch(() => {
        // Redis エラーは無視（ログ出力が止まらないように）
      });
    }
  }

  /**
   * Redis にログを保存
   */
  private async saveLogToRedis(logEntry: LogEntry): Promise<void> {
    const key = this.config.redisKey || 'logs';
    const logData = JSON.stringify(logEntry);

    // リストに追加（最新を先頭に）
    await this.redis.lpush(key, logData);

    // 最大1000件まで保持
    await this.redis.ltrim(key, 0, 999);

    // 24時間で期限切れ
    await this.redis.expire(key, 86400);
  }

  /**
   * パフォーマンスメトリクスを Redis に保存
   */
  private async savePerformanceMetric(metric: any): Promise<void> {
    const key = 'performance_metrics';
    const timestamp = Date.now();

    // 時系列データとして保存
    await this.redis.zadd(key, timestamp, JSON.stringify(metric));

    // 1週間分のデータを保持
    const weekAgo = timestamp - 7 * 24 * 60 * 60 * 1000;
    await this.redis.zremrangebyscore(key, '-inf', weekAgo);
  }

  /**
   * セキュリティイベントを Redis に保存
   */
  private async saveSecurityEvent(event: any): Promise<void> {
    const key = 'security_events';
    const timestamp = Date.now();

    // 時系列データとして保存
    await this.redis.zadd(key, timestamp, JSON.stringify(event));

    // 30日分のデータを保持
    const monthAgo = timestamp - 30 * 24 * 60 * 60 * 1000;
    await this.redis.zremrangebyscore(key, '-inf', monthAgo);
  }

  /**
   * パフォーマンスメトリクスの更新
   */
  private updatePerformanceMetrics(operation: string, duration: number): void {
    const currentAvg = this.performanceMetrics.get(operation) || 0;
    const count = this.performanceMetrics.get(`${operation}_count`) || 0;

    const newAvg = (currentAvg * count + duration) / (count + 1);

    this.performanceMetrics.set(operation, newAvg);
    this.performanceMetrics.set(`${operation}_count`, count + 1);
  }

  /**
   * パフォーマンス監視の開始
   */
  private startPerformanceMonitoring(): void {
    // 5分毎にパフォーマンス統計を出力
    setInterval(() => {
      const stats = this.getPerformanceStats();
      this.info('Performance Statistics', stats, { service: 'monitor' });
    }, 300000);

    // プロセス監視
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      this.debug(
        'System Resources',
        {
          memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          uptime: process.uptime(),
        },
        { service: 'system' }
      );
    }, 60000);
  }

  /**
   * パフォーマンス統計の取得
   */
  getPerformanceStats(): any {
    const stats: any = {};

    for (const [key, value] of this.performanceMetrics) {
      if (!key.endsWith('_count')) {
        const count = this.performanceMetrics.get(`${key}_count`) || 0;
        stats[key] = {
          averageDuration: Math.round(value * 100) / 100,
          totalCount: count,
        };
      }
    }

    return stats;
  }

  /**
   * Recent logs retrieval from Redis
   */
  async getRecentLogs(
    limit: number = 100,
    level?: 'error' | 'warn' | 'info' | 'debug'
  ): Promise<LogEntry[]> {
    try {
      const key = this.config.redisKey || 'logs';
      const logs = await this.redis.lrange(key, 0, limit - 1);

      const parsedLogs = logs
        .map((log) => JSON.parse(log))
        .filter((log) => !level || log.level === level);

      return parsedLogs;
    } catch (error) {
      console.error('Failed to retrieve logs from Redis:', error);
      return [];
    }
  }

  /**
   * ファイルサイズのパース
   */
  private parseSize(size: string): number {
    const units: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };

    const match = size.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
    if (!match) return 10 * 1024 * 1024; // デフォルト 10MB

    const [, number, unit] = match;
    return parseFloat(number) * (units[unit.toUpperCase()] || 1);
  }

  /**
   * ログレベルの動的変更
   */
  setLogLevel(level: 'error' | 'warn' | 'info' | 'debug'): void {
    this.winston.level = level;
    this.config.level = level;
    this.info(`Log level changed to: ${level}`, {}, { service: 'logger' });
  }

  /**
   * ログシステムの終了処理
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.end(() => {
        console.log('Logger shutdown completed');
        resolve();
      });
    });
  }
}
