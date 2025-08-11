/**
 * Cache Manager - 多層キャッシュ戦略
 * Infrastructure-specialist による包括的キャッシュ管理
 */

import type Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
}

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  tags: string[];
  compressed: boolean;
  size: number;
}

export class CacheManager {
  private redis: Redis;
  private l1Cache: Map<string, CacheEntry<any>> = new Map(); // L1: メモリキャッシュ
  private stats: CacheStats = { hits: 0, misses: 0, hitRate: 0, memoryUsage: 0, keyCount: 0 };

  // 設定
  private readonly L1_MAX_SIZE = 1000; // L1キャッシュの最大エントリ数
  private readonly L1_DEFAULT_TTL = 300; // L1キャッシュのデフォルトTTL（5分）
  private readonly L2_DEFAULT_TTL = 3600; // L2キャッシュのデフォルトTTL（1時間）
  private readonly COMPRESSION_THRESHOLD = 1024; // 圧縮の閾値（1KB）

  constructor(redis: Redis) {
    this.redis = redis;
    this.startMaintenanceTasks();
    this.setupRedisErrorHandling();
  }

  /**
   * キャッシュからデータを取得
   * L1 → L2 の順で確認
   */
  async get<T>(key: string, options: { namespace?: string } = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.namespace);
    const startTime = Date.now();

    try {
      // L1キャッシュから確認
      const l1Result = this.getFromL1<T>(fullKey);
      if (l1Result !== null) {
        this.stats.hits++;
        this.updateStats();
        return l1Result;
      }

      // L2キャッシュ（Redis）から確認
      const l2Result = await this.getFromL2<T>(fullKey);
      if (l2Result !== null) {
        // L1に書き戻し
        await this.setToL1(fullKey, l2Result, { ttl: this.L1_DEFAULT_TTL });
        this.stats.hits++;
        this.updateStats();
        return l2Result;
      }

      this.stats.misses++;
      this.updateStats();
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${fullKey}:`, error);
      this.stats.misses++;
      this.updateStats();
      return null;
    } finally {
      const duration = Date.now() - startTime;
      if (duration > 100) {
        // 100ms以上かかった場合は警告
        console.warn(`Slow cache operation: get ${fullKey} took ${duration}ms`);
      }
    }
  }

  /**
   * キャッシュにデータを設定
   * L1とL2の両方に保存
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const { ttl = this.L2_DEFAULT_TTL, compress = false, namespace, tags = [] } = options;

    const fullKey = this.buildKey(key, namespace);
    const startTime = Date.now();

    try {
      // データサイズの計算
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');
      const shouldCompress = compress || size > this.COMPRESSION_THRESHOLD;

      // L1キャッシュに保存
      await this.setToL1(fullKey, value, { ttl: Math.min(ttl, this.L1_DEFAULT_TTL), tags, size });

      // L2キャッシュに保存
      await this.setToL2(fullKey, value, { ttl, tags, compress: shouldCompress, size });

      // タグインデックスの更新
      if (tags.length > 0) {
        await this.updateTagIndex(tags, fullKey, ttl);
      }
    } catch (error) {
      console.error(`Cache set error for key ${fullKey}:`, error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      if (duration > 200) {
        console.warn(`Slow cache operation: set ${fullKey} took ${duration}ms`);
      }
    }
  }

  /**
   * 複数のキーを一括取得
   */
  async mget<T>(keys: string[], namespace?: string): Promise<Record<string, T | null>> {
    const fullKeys = keys.map((key) => this.buildKey(key, namespace));
    const result: Record<string, T | null> = {};

    try {
      // L1キャッシュから一括取得
      const l1Results: Record<string, T | null> = {};
      const l1MissingKeys: string[] = [];

      for (const fullKey of fullKeys) {
        const l1Value = this.getFromL1<T>(fullKey);
        if (l1Value !== null) {
          l1Results[fullKey] = l1Value;
          this.stats.hits++;
        } else {
          l1MissingKeys.push(fullKey);
        }
      }

      // L2キャッシュから不足分を取得
      if (l1MissingKeys.length > 0) {
        const l2Results = await this.mgetFromL2<T>(l1MissingKeys);

        for (const [fullKey, value] of Object.entries(l2Results)) {
          if (value !== null) {
            // L1に書き戻し
            await this.setToL1(fullKey, value, { ttl: this.L1_DEFAULT_TTL });
            this.stats.hits++;
          } else {
            this.stats.misses++;
          }
        }

        Object.assign(l1Results, l2Results);
      }

      // 元のキー形式に戻す
      for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = l1Results[fullKeys[i]] || null;
      }

      this.updateStats();
      return result;
    } catch (error) {
      console.error('Cache mget error:', error);
      // エラー時は空の結果を返す
      for (const key of keys) {
        result[key] = null;
        this.stats.misses++;
      }
      this.updateStats();
      return result;
    }
  }

  /**
   * 特定のキーを削除
   */
  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);

    try {
      // L1キャッシュから削除
      this.l1Cache.delete(fullKey);

      // L2キャッシュから削除
      await this.redis.del(fullKey);

      // タグインデックスからも削除
      const tagKey = `${fullKey}:tags`;
      const tags = await this.redis.smembers(tagKey);
      if (tags.length > 0) {
        for (const tag of tags) {
          await this.redis.srem(`tag:${tag}`, fullKey);
        }
        await this.redis.del(tagKey);
      }
    } catch (error) {
      console.error(`Cache delete error for key ${fullKey}:`, error);
      throw error;
    }
  }

  /**
   * タグに基づいてキャッシュを無効化
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);

      if (keys.length === 0) return 0;

      // 一括削除
      const pipeline = this.redis.pipeline();

      for (const key of keys) {
        // L1キャッシュから削除
        this.l1Cache.delete(key);

        // L2キャッシュから削除
        pipeline.del(key);
        pipeline.del(`${key}:tags`);
      }

      // タグインデックスも削除
      pipeline.del(tagKey);

      await pipeline.exec();

      console.log(`Invalidated ${keys.length} cache entries for tag: ${tag}`);
      return keys.length;
    } catch (error) {
      console.error(`Cache invalidation error for tag ${tag}:`, error);
      return 0;
    }
  }

  /**
   * パターンに基づいてキャッシュを無効化
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      // L1キャッシュからパターンマッチで削除
      let l1Count = 0;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));

      for (const [key] of this.l1Cache) {
        if (regex.test(key)) {
          this.l1Cache.delete(key);
          l1Count++;
        }
      }

      // L2キャッシュからパターンマッチで削除
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      const totalCount = Math.max(l1Count, keys.length);
      console.log(`Invalidated ${totalCount} cache entries for pattern: ${pattern}`);

      return totalCount;
    } catch (error) {
      console.error(`Cache pattern invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * L1キャッシュ（メモリ）からの取得
   */
  private getFromL1<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);

    if (!entry) return null;

    // 有効期限チェック
    if (Date.now() > entry.expiresAt) {
      this.l1Cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * L1キャッシュ（メモリ）への保存
   */
  private async setToL1<T>(
    key: string,
    value: T,
    options: { ttl: number; tags?: string[]; size?: number }
  ): Promise<void> {
    const { ttl, tags = [], size = 0 } = options;

    // サイズ制限チェック
    if (this.l1Cache.size >= this.L1_MAX_SIZE) {
      this.evictL1Cache();
    }

    const entry: CacheEntry<T> = {
      data: value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
      tags,
      compressed: false,
      size,
    };

    this.l1Cache.set(key, entry);
  }

  /**
   * L2キャッシュ（Redis）からの取得
   */
  private async getFromL2<T>(key: string): Promise<T | null> {
    try {
      const compressed = await this.redis.hget(key, 'compressed');
      const data = await this.redis.hget(key, 'data');

      if (!data) return null;

      let parsed: T;
      if (compressed === 'true') {
        // 実際の実装では圧縮ライブラリを使用
        parsed = JSON.parse(data);
      } else {
        parsed = JSON.parse(data);
      }

      return parsed;
    } catch (error) {
      console.error(`L2 cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * L2キャッシュ（Redis）への保存
   */
  private async setToL2<T>(
    key: string,
    value: T,
    options: { ttl: number; tags: string[]; compress: boolean; size: number }
  ): Promise<void> {
    const { ttl, tags, compress, size } = options;

    try {
      const serialized = JSON.stringify(value);

      if (compress) {
        // 実際の実装では gzip 等で圧縮
        // serialized = await compressData(serialized);
      }

      const pipeline = this.redis.pipeline();

      // データ保存
      pipeline.hset(key, {
        data: serialized,
        compressed: compress.toString(),
        size: size.toString(),
        createdAt: Date.now().toString(),
      });

      pipeline.expire(key, ttl);

      // タグ情報保存
      if (tags.length > 0) {
        pipeline.sadd(`${key}:tags`, ...tags);
        pipeline.expire(`${key}:tags`, ttl);
      }

      await pipeline.exec();
    } catch (error) {
      console.error(`L2 cache set error for ${key}:`, error);
      throw error;
    }
  }

  /**
   * L2キャッシュからの一括取得
   */
  private async mgetFromL2<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};

    try {
      const pipeline = this.redis.pipeline();

      for (const key of keys) {
        pipeline.hget(key, 'data');
        pipeline.hget(key, 'compressed');
      }

      const results = await pipeline.exec();

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const dataResult = results?.[i * 2];
        const compressedResult = results?.[i * 2 + 1];

        if (dataResult?.[1] && typeof dataResult?.[1] === 'string') {
          try {
            const isCompressed = compressedResult?.[1] === 'true';
            const data = dataResult?.[1] as string;

            if (isCompressed) {
              // 実際の実装では解凍処理
              // data = await decompressData(data);
            }

            result[key] = JSON.parse(data);
          } catch (parseError) {
            console.error(`L2 cache parse error for ${key}:`, parseError);
            result[key] = null;
          }
        } else {
          result[key] = null;
        }
      }

      return result;
    } catch (error) {
      console.error('L2 cache mget error:', error);
      // エラー時は全て null を返す
      for (const key of keys) {
        result[key] = null;
      }
      return result;
    }
  }

  /**
   * タグインデックスの更新
   */
  private async updateTagIndex(tags: string[], key: string, ttl: number): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, ttl);
    }

    await pipeline.exec();
  }

  /**
   * L1キャッシュの LRU削除
   */
  private evictL1Cache(): void {
    // 最も古いエントリを削除（LRU）
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.l1Cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
    }
  }

  /**
   * フルキーの構築
   */
  private buildKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${namespace}:${key}`;
    }
    return key;
  }

  /**
   * 統計の更新
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    this.stats.keyCount = this.l1Cache.size;

    // メモリ使用量の概算
    this.stats.memoryUsage = Array.from(this.l1Cache.values()).reduce(
      (total, entry) => total + entry.size,
      0
    );
  }

  /**
   * Redis エラーハンドリング設定
   */
  private setupRedisErrorHandling(): void {
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
      // エラー時は L1キャッシュのみで動作継続
    });

    this.redis.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    this.redis.on('ready', () => {
      console.log('Redis connection ready');
    });
  }

  /**
   * メンテナンスタスクの開始
   */
  private startMaintenanceTasks(): void {
    // L1キャッシュの定期クリーンアップ
    setInterval(() => {
      let cleanedCount = 0;
      const now = Date.now();

      for (const [key, entry] of this.l1Cache) {
        if (now > entry.expiresAt) {
          this.l1Cache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`L1 cache cleanup: removed ${cleanedCount} expired entries`);
      }
    }, 60000); // 1分毎

    // 統計情報の定期出力
    setInterval(() => {
      console.log('Cache Statistics:', {
        hitRate: `${(this.stats.hitRate * 100).toFixed(1)}%`,
        totalRequests: this.stats.hits + this.stats.misses,
        l1CacheSize: this.l1Cache.size,
        memoryUsage: `${Math.round(this.stats.memoryUsage / 1024)}KB`,
      });
    }, 300000); // 5分毎
  }

  /**
   * キャッシュ統計の取得
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * キャッシュのウォームアップ
   */
  async warmup(
    keys: Array<{ key: string; loader: () => Promise<any>; ttl?: number }>
  ): Promise<void> {
    console.log(`Starting cache warmup for ${keys.length} keys...`);

    const startTime = Date.now();
    let successCount = 0;

    for (const { key, loader, ttl = this.L2_DEFAULT_TTL } of keys) {
      try {
        const value = await loader();
        await this.set(key, value, { ttl });
        successCount++;
      } catch (error) {
        console.error(`Warmup error for key ${key}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Cache warmup completed: ${successCount}/${keys.length} keys in ${duration}ms`);
  }

  /**
   * キャッシュの完全クリア
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      // 特定の名前空間のみクリア
      await this.invalidateByPattern(`${namespace}:*`);
    } else {
      // 全てクリア
      this.l1Cache.clear();
      await this.redis.flushdb();
    }

    this.stats = { hits: 0, misses: 0, hitRate: 0, memoryUsage: 0, keyCount: 0 };
    console.log(`Cache cleared${namespace ? ` for namespace: ${namespace}` : ''}`);
  }
}
