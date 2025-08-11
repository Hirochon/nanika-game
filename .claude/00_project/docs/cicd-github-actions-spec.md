# CI/CD・GitHub Actions 仕様書

## 概要
継続的インテグレーション（CI）のためのGitHub Actionsワークフローを提供する。
デプロイメント（CD）関連のコードは削除し、コード品質とセキュリティの自動チェックに特化する。

## 実装済み機能（2025年8月現在）

### ✅ 削除済み項目
- Dockerfileおよびdocker-compose.prod.yml（本番環境用）
- scripts/deploy.sh（デプロイスクリプト）
- 不要なdockerディレクトリ（nginx、grafana、prometheus、scripts）
- CI/CDワークフロー（デプロイメント関連）

### ✅ 実装済みワークフロー

#### 1. テストワークフロー（.github/workflows/test.yml）
- **ユニットテスト**: Node.js 20.x、22.xでの並列実行
- **統合テスト**: PostgreSQL、Redisサービスを使用した統合テスト
- **E2Eテスト**: Playwrightを使用したブラウザテスト
- **カバレッジレポート**: テストカバレッジの自動収集とアップロード

#### 2. リント・型チェックワークフロー（.github/workflows/lint-typecheck.yml）
- **Biome**: フォーマットチェックとリント
- **TypeScript**: 型チェックとstrict mode確認
- **コード品質チェック**: 
  - console.log文の検出
  - TODO/FIXMEコメントの検出
  - 大きなファイルの検出
  - バンドルサイズ分析
- **アクセシビリティチェック**: 基本的なa11y検証

#### 3. セキュリティチェックワークフロー（.github/workflows/security.yml）
- **依存関係監査**: npm auditとbetter-npm-audit
- **シークレットスキャン**: Gitleaksによる機密情報検出
- **CodeQL分析**: 静的コード分析
- **Semgrep**: OWASP Top 10、セキュリティパターン検出
- **脆弱性検出**: SQLインジェクション、XSS脆弱性チェック

## トリガー条件

### プッシュ時
- `main`ブランチへのプッシュ
- `develop`ブランチへのプッシュ

### プルリクエスト時
- `main`ブランチへのPR
- `develop`ブランチへのPR

### スケジュール実行
- セキュリティチェック: 毎日午前2時（UTC）

## 必要な環境変数・シークレット

### GitHub Actions用
- `GITHUB_TOKEN`: 自動的に提供される（CodeQL、アーティファクトアップロード用）

### テスト環境用
- `DATABASE_URL`: PostgreSQL接続文字列
- `REDIS_URL`: Redis接続文字列
- `SESSION_SECRET`: セッション暗号化キー

## ジョブ構成

### test.yml
```yaml
jobs:
  unit-test:       # ユニットテスト（マトリックスビルド）
  integration-test: # 統合テスト（サービスコンテナ使用）
  e2e-test:        # E2Eテスト（Playwright）
```

### lint-typecheck.yml
```yaml
jobs:
  lint:           # Biomeリント・フォーマット
  typecheck:      # TypeScript型チェック
  code-quality:   # コード品質分析
  accessibility:  # アクセシビリティチェック
```

### security.yml
```yaml
jobs:
  dependency-audit:  # 依存関係の脆弱性チェック
  secret-scanning:   # シークレット検出
  code-scanning:     # CodeQL分析
  security-headers:  # セキュリティヘッダーチェック
  sast:             # 静的アプリケーションセキュリティテスト
```

## npmスクリプト

### 追加・更新されたスクリプト
```json
{
  "test:unit": "vitest run --dir app --exclude '**/*.integration.test.ts' --exclude '**/*.e2e.test.ts'",
  "test:integration": "vitest run __tests__/integration --reporter=verbose",
  "test:e2e": "playwright test",
  "format:check": "biome format ."
}
```

## アーティファクト

### 生成されるアーティファクト
- **coverage-report**: テストカバレッジレポート
- **playwright-report**: E2Eテスト失敗時のレポート
- **trivy-results.sarif**: セキュリティスキャン結果（将来実装）

## ベストプラクティス

### 1. 並列実行
- マトリックスビルドで複数Node.jsバージョンをテスト
- 独立したジョブは並列実行で高速化

### 2. キャッシュ戦略
- `actions/setup-node`のキャッシュ機能を使用
- npm依存関係を効率的にキャッシュ

### 3. 条件付き実行
- カバレッジレポートは特定バージョンのみアップロード
- 失敗時のみレポートをアップロード

### 4. セキュリティ
- 最小権限の原則（permissions設定）
- シークレットの安全な管理

## 保守・運用

### 定期メンテナンス
- アクションのバージョン更新（月次）
- 依存関係の更新（週次）
- セキュリティアラートへの対応（随時）

### モニタリング
- ワークフロー実行時間の監視
- 失敗率の追跡
- リソース使用量の最適化

## 今後の拡張予定
- パフォーマンステスト（Lighthouse CI）
- ビジュアルリグレッションテスト
- 依存関係の自動更新（Dependabot）
- ブランチ保護ルールの強化