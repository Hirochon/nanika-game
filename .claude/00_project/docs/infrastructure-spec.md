# インフラストラクチャ設定 仕様書

## 概要
アプリケーションの開発環境用インフラストラクチャ設定を管理する。
PostgreSQLデータベースとRedisキャッシュサーバーの設定を提供し、Docker Composeで環境構築を簡素化する。

## 実装済み機能（2025年8月現在）

### ✅ 設定済みサービス

#### 1. PostgreSQL（データベース）
- **バージョン**: 15-alpine
- **設定ファイル**: `docker/postgres/postgresql.conf`
- **用途**: 
  - ユーザーデータの永続化
  - チャットメッセージの保存
  - セッションデータのバックアップ

#### 2. Redis（キャッシュ・セッション）
- **バージョン**: 7-alpine
- **設定ファイル**: `docker/redis/redis.conf`
- **用途**:
  - セッションストア
  - WebSocketアダプター
  - キャッシュストレージ

### 🗑️ 削除済み項目
- Nginx設定（未使用）
- Grafana監視設定（未使用）
- Prometheusメトリクス設定（未使用）
- Dockerエントリーポイントスクリプト（Dockerfileなし）
- ヘルスチェックスクリプト（不要）
- アプリケーションコンテナ設定（Dockerfileなし）

## PostgreSQL設定詳細

### 接続設定
```conf
listen_addresses = '*'
port = 5432
max_connections = 100
```

### メモリ設定
```conf
shared_buffers = 256MB         # 共有メモリバッファ
effective_cache_size = 1GB     # OS+DBキャッシュサイズ
work_mem = 4MB                 # ソート・ハッシュ操作用メモリ
maintenance_work_mem = 64MB    # メンテナンス操作用メモリ
```

### パフォーマンス設定
```conf
random_page_cost = 1.1         # SSD用に最適化
effective_io_concurrency = 200  # 並行I/O操作数
wal_compression = on           # WALログ圧縮
checkpoint_completion_target = 0.9
```

### ログ設定
```conf
log_min_duration_statement = 1000  # 1秒以上のスロークエリを記録
log_connections = on               # 接続ログ
log_disconnections = on            # 切断ログ
log_lock_waits = on               # ロック待機ログ
log_statement = 'mod'             # DDL/DMLログ
```

## Redis設定詳細

### ネットワーク設定
```conf
bind 0.0.0.0
port 6379
timeout 300                    # クライアントタイムアウト（秒）
tcp-keepalive 300             # TCP keep-alive（秒）
tcp-backlog 511               # 接続キューサイズ
```

### メモリ管理
```conf
maxmemory 512mb               # 最大メモリ使用量
maxmemory-policy allkeys-lru  # LRUキャッシュポリシー
maxmemory-samples 5           # LRUサンプリング数
```

### 永続化設定
```conf
appendonly yes                # AOF有効
appendfilename "appendonly.aof"
appendfsync everysec          # 1秒ごとにfsync
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### クライアント管理
```conf
maxclients 1000               # 最大同時接続数
```

## Docker Compose設定

### サービス構成
```yaml
services:
  postgres:  # PostgreSQLデータベース
  redis:     # Redisキャッシュ
```

### ボリューム
```yaml
volumes:
  postgres_data:  # PostgreSQLデータ永続化
  redis_data:     # Redisデータ永続化
```

### ネットワーク
```yaml
networks:
  nanika-network:
    subnet: 172.20.0.0/16
```

### ヘルスチェック
- **PostgreSQL**: `pg_isready`コマンドで接続確認
- **Redis**: `redis-cli ping`コマンドで応答確認

## 環境変数

### 必須環境変数
```bash
# PostgreSQL
POSTGRES_DB=nanika_game
POSTGRES_USER=nanika_user
POSTGRES_PASSWORD=nanika_password

# アプリケーション
DATABASE_URL=postgresql://nanika_user:nanika_password@localhost:5432/nanika_game?schema=public
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

## 起動手順

### 1. サービス起動
```bash
# PostgreSQLとRedisを起動
docker compose up -d postgres redis

# ログ確認
docker compose logs -f

# 状態確認
docker compose ps
```

### 2. データベース初期化
```bash
# マイグレーション実行
npm run db:migrate

# シードデータ投入
npm run db:seed
```

### 3. アプリケーション起動
```bash
# 開発サーバー起動
npm run dev

# バックエンドサーバー起動
npm run start
```

## 管理コマンド

### PostgreSQL操作
```bash
# DBに接続
docker exec -it nanika-game-db psql -U nanika_user -d nanika_game

# バックアップ
docker exec nanika-game-db pg_dump -U nanika_user nanika_game > backup.sql

# リストア
docker exec -i nanika-game-db psql -U nanika_user nanika_game < backup.sql
```

### Redis操作
```bash
# Redisに接続
docker exec -it nanika-game-redis redis-cli

# データ確認
docker exec nanika-game-redis redis-cli KEYS '*'

# データクリア
docker exec nanika-game-redis redis-cli FLUSHALL
```

### Docker管理
```bash
# サービス停止
docker compose down

# ボリューム含めて削除
docker compose down -v

# リビルド
docker compose build --no-cache
```

## パフォーマンスチューニング

### PostgreSQL最適化
1. **インデックス**: 頻繁にクエリされるカラムにインデックス追加
2. **VACUUM**: 定期的なVACUUM実行でディスク領域最適化
3. **統計情報**: `ANALYZE`で統計情報更新

### Redis最適化
1. **キー有効期限**: 適切なTTL設定でメモリ効率化
2. **データ構造**: 用途に応じた最適なデータ構造選択
3. **パイプライン**: 複数コマンドのバッチ実行

## トラブルシューティング

### よくある問題と対処法

#### PostgreSQL接続エラー
```bash
# 接続確認
docker exec nanika-game-db pg_isready

# ログ確認
docker compose logs postgres

# 権限確認
docker exec nanika-game-db psql -U nanika_user -c "\l"
```

#### Redis接続エラー
```bash
# 接続確認
docker exec nanika-game-redis redis-cli ping

# メモリ使用状況
docker exec nanika-game-redis redis-cli INFO memory

# 設定確認
docker exec nanika-game-redis redis-cli CONFIG GET maxmemory
```

#### ディスク容量不足
```bash
# ボリューム使用状況
docker system df

# 不要なデータ削除
docker system prune -a
```

## セキュリティ考慮事項

1. **パスワード管理**: 本番環境では強力なパスワードを使用
2. **ネットワーク分離**: 本番環境では適切なネットワーク分離
3. **バックアップ**: 定期的なバックアップとリストアテスト
4. **アクセス制限**: 必要最小限のポート開放
5. **ログ監視**: 異常なアクセスパターンの検知

## 今後の拡張予定
- PostgreSQLレプリケーション設定
- Redis Sentinel/Clusterモード
- バックアップ自動化
- 監視・アラート設定（Prometheus/Grafana）
- ログ集約（ELKスタック）