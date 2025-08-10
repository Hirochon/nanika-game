# CI/CD設計

## 目的と概要

このドキュメントは、Nanika GameプロジェクトのCI/CD（継続的インテグレーション・継続的デプロイメント）パイプライン設計について詳述します。GitHub Actionsを活用した自動化されたテスト・ビルド・デプロイメントプロセスにより、高品質なソフトウェアの迅速で信頼性の高いリリースサイクルを実現します。

## 現在の実装状況

- **基本開発環境**: GitHub Codespaces、Docker環境の構築完了
- **テストスイート**: Vitest、React Testing Library による単体・統合テスト環境
- **品質チェック**: Biome（フォーマット・リント）、TypeScript型チェックの設定完了
- **データベース**: Prisma、PostgreSQL による開発環境データベース
- **ビルドシステム**: React Router v7、Vite による高速ビルド環境

## CI/CD戦略概要

### パイプライン全体フロー

```mermaid
graph TD
    A[開発者がPush] --> B[CI Pipeline開始]
    B --> C[並列実行]
    
    C --> D[Code Quality]
    C --> E[Security Scan]
    C --> F[Unit Tests]
    C --> G[Integration Tests]
    
    D --> H{品質ゲート}
    E --> H
    F --> H
    G --> H
    
    H -->|Pass| I[Build Application]
    H -->|Fail| J[Pipeline停止<br/>通知送信]
    
    I --> K[E2E Tests]
    K --> L{E2Eテスト}
    
    L -->|Pass| M[Deploy to Staging]
    L -->|Fail| J
    
    M --> N[Staging Tests]
    N --> O{ステージングテスト}
    
    O -->|Pass| P{Branch?}
    O -->|Fail| J
    
    P -->|main| Q[Deploy to Production]
    P -->|develop| R[Keep in Staging]
    P -->|feature| S[Deploy to Preview]
    
    Q --> T[Production Health Check]
    T --> U[Deployment Complete]
```

### デプロイメント環境

```mermaid
graph LR
    A[Feature Branch] --> B[Preview Environment<br/>feature-xyz.preview.nanika-game.com]
    C[Develop Branch] --> D[Staging Environment<br/>staging.nanika-game.com]
    E[Main Branch] --> F[Production Environment<br/>nanika-game.com]
    
    style B fill:#e1f5fe
    style D fill:#fff3e0
    style F fill:#e8f5e8
```

## GitHub Actions ワークフロー設計

### 1. CI Pipeline（継続的インテグレーション）

```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  code-quality:
    name: Code Quality Checks
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type check
        run: npm run typecheck

      - name: Format check
        run: npm run format -- --check

      - name: Lint check
        run: npm run lint

      - name: Check for unused dependencies
        run: npx depcheck

  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Audit npm packages
        run: npm audit --audit-level moderate

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage --reporter=junit
        env:
          VITEST_JUNIT_OUTPUT_FILE: ./test-results/unit-tests.xml

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: unit-test-results
          path: test-results/

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          file: ./coverage/lcov.info
          flags: unit

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd \"redis-cli ping\"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_db

      - name: Run integration tests
        run: npm run test:integration -- --coverage --reporter=junit
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          VITEST_JUNIT_OUTPUT_FILE: ./test-results/integration-tests.xml

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: integration-test-results
          path: test-results/

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [code-quality, security-scan, unit-tests, integration-tests]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            build/
            public/
          retention-days: 7

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: build
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: e2e_user
          POSTGRES_PASSWORD: e2e_password
          POSTGRES_DB: e2e_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: Setup E2E database
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL: postgresql://e2e_user:e2e_password@localhost:5432/e2e_db

      - name: Start application server
        run: |
          npm run preview &
          npx wait-on http://localhost:3000 --timeout 60000
        env:
          DATABASE_URL: postgresql://e2e_user:e2e_password@localhost:5432/e2e_db
          PORT: 3000

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000

      - name: Upload E2E test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-test-results
          path: |
            playwright-report/
            test-results/

  quality-gate:
    name: Quality Gate
    runs-on: ubuntu-latest
    needs: [code-quality, security-scan, unit-tests, integration-tests, e2e-tests]
    if: always()
    steps:
      - name: Check job statuses
        run: |
          if [[ \"${{ needs.code-quality.result }}\" != \"success\" ]]; then
            echo \"Code quality checks failed\"
            exit 1
          fi
          if [[ \"${{ needs.security-scan.result }}\" != \"success\" ]]; then
            echo \"Security scan failed\"
            exit 1
          fi
          if [[ \"${{ needs.unit-tests.result }}\" != \"success\" ]]; then
            echo \"Unit tests failed\"
            exit 1
          fi
          if [[ \"${{ needs.integration-tests.result }}\" != \"success\" ]]; then
            echo \"Integration tests failed\"
            exit 1
          fi
          if [[ \"${{ needs.e2e-tests.result }}\" != \"success\" ]]; then
            echo \"E2E tests failed\"
            exit 1
          fi
          echo \"All quality checks passed!\"
```

### 2. CD Pipeline（継続的デプロイメント）

```yaml
# .github/workflows/cd.yml
name: Continuous Deployment

on:
  push:
    branches: [main, develop]
  workflow_run:
    workflows: [\"Continuous Integration\"]
    types: [completed]
    branches: [main, develop]

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop' && github.event.workflow_run.conclusion == 'success'
    environment:
      name: staging
      url: https://staging.nanika-game.com
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for staging
        run: npm run build
        env:
          NODE_ENV: staging
          VITE_API_URL: ${{ secrets.STAGING_API_URL }}

      - name: Deploy to staging server
        uses: shimataro/ssh-key-action@v2
        with:
          key: ${{ secrets.STAGING_SSH_KEY }}
          known_hosts: ${{ secrets.STAGING_KNOWN_HOSTS }}

      - name: Deploy application
        run: |
          rsync -avz --delete ./build/ ${{ secrets.STAGING_USER }}@${{ secrets.STAGING_HOST }}:/var/www/staging/
          ssh ${{ secrets.STAGING_USER }}@${{ secrets.STAGING_HOST }} 'sudo systemctl restart nanika-game-staging'

      - name: Run health check
        run: |
          sleep 30
          curl -f https://staging.nanika-game.com/api/health || exit 1

      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event.workflow_run.conclusion == 'success'
    environment:
      name: production
      url: https://nanika-game.com
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for production
        run: npm run build
        env:
          NODE_ENV: production
          VITE_API_URL: ${{ secrets.PRODUCTION_API_URL }}

      # Blue-Green Deployment
      - name: Deploy to Blue environment
        run: |
          # Deploy to blue environment first
          rsync -avz --delete ./build/ ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }}:/var/www/blue/
          
      - name: Health check Blue environment
        run: |
          # Start blue environment
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} 'sudo systemctl start nanika-game-blue'
          sleep 30
          
          # Health check
          curl -f http://blue.internal.nanika-game.com/api/health || exit 1

      - name: Run production smoke tests
        run: npm run test:smoke -- --env=blue

      - name: Switch traffic to Blue (Go Live)
        run: |
          # Switch load balancer to blue
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} 'sudo nginx -s reload -c /etc/nginx/blue.conf'
          
          # Stop green environment
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} 'sudo systemctl stop nanika-game-green'

      - name: Final health check
        run: |
          sleep 60
          curl -f https://nanika-game.com/api/health || exit 1

      - name: Notify deployment success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: '🚀 Production deployment successful!'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

  deploy-preview:
    name: Deploy Preview Environment
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    environment:
      name: preview-${{ github.event.number }}
      url: https://pr-${{ github.event.number }}.preview.nanika-game.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for preview
        run: npm run build
        env:
          NODE_ENV: preview
          VITE_API_URL: https://pr-${{ github.event.number }}.preview.nanika-game.com/api

      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Comment PR with preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🔍 Preview deployment ready!\\n\\n**URL**: https://pr-${{ github.event.number }}.preview.nanika-game.com\\n\\nThis preview will be automatically updated when you push new changes.`
            })
```

### 3. 依存関係管理とセキュリティ

```yaml
# .github/workflows/dependency-update.yml
name: Dependency Management

on:
  schedule:
    - cron: '0 9 * * 1' # 毎週月曜日 9:00 UTC
  workflow_dispatch:

jobs:
  dependency-review:
    name: Dependency Review
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Check for outdated dependencies
        run: npm outdated --json > outdated-deps.json || true

      - name: Security audit
        run: |
          npm audit --json > audit-results.json || true
          if [ -s audit-results.json ]; then
            echo \"Security vulnerabilities found!\"
            npm audit
            exit 1
          fi

      - name: Create dependency update PR
        if: success()
        uses: peter-evans/create-pull-request@v5
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'chore: update dependencies'
          title: '🔄 Weekly dependency updates'
          body: |
            ## Weekly Dependency Updates
            
            This PR contains automatic dependency updates.
            
            ### Changes
            - Updated npm packages to latest versions
            - Fixed security vulnerabilities (if any)
            
            ### Testing
            - [ ] CI/CD pipeline passes
            - [ ] Manual testing completed
            - [ ] Security scan passes
          branch: chore/weekly-dependency-updates
```

## 品質ゲート設定

### 1. コードカバレッジ要件

```yaml
# .github/workflows/coverage-check.yml
name: Coverage Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  coverage-check:
    name: Check Coverage Requirements
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Check coverage thresholds
        run: |
          # Extract coverage percentages
          LINES=$(grep -o 'Lines.*: [0-9.]*%' coverage/coverage-summary.json | grep -o '[0-9.]*' | head -1)
          FUNCTIONS=$(grep -o 'Functions.*: [0-9.]*%' coverage/coverage-summary.json | grep -o '[0-9.]*' | head -1)
          BRANCHES=$(grep -o 'Branches.*: [0-9.]*%' coverage/coverage-summary.json | grep -o '[0-9.]*' | head -1)
          
          echo \"Coverage: Lines: ${LINES}%, Functions: ${FUNCTIONS}%, Branches: ${BRANCHES}%\"
          
          # Check thresholds
          if (( $(echo \"$LINES < 80\" | bc -l) )); then
            echo \"❌ Line coverage ${LINES}% is below threshold 80%\"
            exit 1
          fi
          
          if (( $(echo \"$FUNCTIONS < 80\" | bc -l) )); then
            echo \"❌ Function coverage ${FUNCTIONS}% is below threshold 80%\"
            exit 1
          fi
          
          if (( $(echo \"$BRANCHES < 70\" | bc -l) )); then
            echo \"❌ Branch coverage ${BRANCHES}% is below threshold 70%\"
            exit 1
          fi
          
          echo \"✅ All coverage thresholds met!\"

      - name: Comment PR with coverage
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
            const total = coverage.total;
            
            const comment = `## 📊 Test Coverage Report
            
            | Metric | Coverage | Threshold | Status |
            |--------|----------|-----------|--------|
            | Lines | ${total.lines.pct}% | 80% | ${total.lines.pct >= 80 ? '✅' : '❌'} |
            | Functions | ${total.functions.pct}% | 80% | ${total.functions.pct >= 80 ? '✅' : '❌'} |
            | Branches | ${total.branches.pct}% | 70% | ${total.branches.pct >= 70 ? '✅' : '❌'} |
            | Statements | ${total.statements.pct}% | 80% | ${total.statements.pct >= 80 ? '✅' : '❌'} |
            
            [View detailed coverage report](https://codecov.io/github/${{ github.repository }}/commit/${{ github.sha }})`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### 2. パフォーマンス監視

```yaml
# .github/workflows/performance-check.yml
name: Performance Check

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse-check:
    name: Lighthouse Performance Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start server
        run: |
          npm run preview &
          npx wait-on http://localhost:3000 --timeout 60000

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

  bundle-analysis:
    name: Bundle Size Analysis
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Analyze bundle size
        run: |
          npm run build
          npx bundlesize

      - name: Comment bundle size changes
        uses: preactjs/compressed-size-action@v2
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          pattern: \"./build/**/*.{js,css,html}\"
```

## デプロイメント戦略

### 1. Blue-Green デプロイメント

```bash
#!/bin/bash
# scripts/deploy-blue-green.sh

set -e

ENVIRONMENT=${1:-production}
NEW_VERSION=${2:-$(git rev-parse --short HEAD)}

echo "🚀 Starting Blue-Green deployment for $ENVIRONMENT"
echo "📦 Version: $NEW_VERSION"

# 現在のアクティブ環境を確認
CURRENT_ACTIVE=$(curl -s https://nanika-game.com/api/health | jq -r '.environment' || echo \"blue\")
TARGET_ENV=$([ \"$CURRENT_ACTIVE\" = \"blue\" ] && echo \"green\" || echo \"blue\")

echo \"📍 Current active: $CURRENT_ACTIVE\"
echo \"🎯 Deploying to: $TARGET_ENV\"

# ビルドとデプロイ
echo \"🔨 Building application...\"
npm run build

echo \"📤 Deploying to $TARGET_ENV environment...\"
rsync -avz --delete ./build/ deploy@server:/var/www/$TARGET_ENV/

# ターゲット環境の起動
echo \"▶️ Starting $TARGET_ENV environment...\"
ssh deploy@server \"sudo systemctl start nanika-game-$TARGET_ENV\"

# ヘルスチェック
echo \"🏥 Running health checks...\"
sleep 30

for i in {1..5}; do
  if curl -f \"http://$TARGET_ENV.internal.nanika-game.com/api/health\"; then
    echo \"✅ Health check passed on attempt $i\"
    break
  elif [ $i -eq 5 ]; then
    echo \"❌ Health check failed after 5 attempts\"
    exit 1
  else
    echo \"⏳ Health check failed, retrying in 10s... (attempt $i/5)\"
    sleep 10
  fi
done

# スモークテスト
echo \"💨 Running smoke tests...\"
npm run test:smoke -- --env=$TARGET_ENV

# トラフィック切り替え
echo \"🔄 Switching traffic to $TARGET_ENV...\"
ssh deploy@server \"sudo ln -sfn /etc/nginx/sites-available/$TARGET_ENV /etc/nginx/sites-enabled/nanika-game\"
ssh deploy@server \"sudo systemctl reload nginx\"

# 最終確認
echo \"🏁 Final health check...\"
sleep 30
curl -f https://nanika-game.com/api/health

# 旧環境の停止
echo \"⏹️ Stopping $CURRENT_ACTIVE environment...\"
ssh deploy@server \"sudo systemctl stop nanika-game-$CURRENT_ACTIVE\"

echo \"✅ Blue-Green deployment completed successfully!\"
echo \"🎉 $NEW_VERSION is now live in $TARGET_ENV environment\"
```

### 2. ロールバック戦略

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

ENVIRONMENT=${1:-production}
TARGET_VERSION=${2}

echo \"🔄 Starting rollback for $ENVIRONMENT\"

if [ -z \"$TARGET_VERSION\" ]; then
  # 前のバージョンを取得
  TARGET_VERSION=$(git log --oneline -n 2 | tail -1 | cut -d' ' -f1)
  echo \"📋 Auto-detected target version: $TARGET_VERSION\"
fi

# 現在の環境状態を確認
CURRENT_ACTIVE=$(curl -s https://nanika-game.com/api/health | jq -r '.environment')
TARGET_ENV=$([ \"$CURRENT_ACTIVE\" = \"blue\" ] && echo \"green\" || echo \"blue\")

echo \"📍 Current active: $CURRENT_ACTIVE\"
echo \"🎯 Rolling back to: $TARGET_ENV (version: $TARGET_VERSION)\"

# ターゲットバージョンをチェックアウト
git checkout $TARGET_VERSION

# ビルド
echo \"🔨 Building rollback version...\"
npm ci
npm run build

# デプロイ
echo \"📤 Deploying rollback version to $TARGET_ENV...\"
rsync -avz --delete ./build/ deploy@server:/var/www/$TARGET_ENV/

# 起動とヘルスチェック
echo \"▶️ Starting $TARGET_ENV environment...\"
ssh deploy@server \"sudo systemctl start nanika-game-$TARGET_ENV\"

sleep 30
curl -f \"http://$TARGET_ENV.internal.nanika-game.com/api/health\"

# トラフィック切り替え
echo \"🔄 Switching traffic to rollback version...\"
ssh deploy@server \"sudo ln -sfn /etc/nginx/sites-available/$TARGET_ENV /etc/nginx/sites-enabled/nanika-game\"
ssh deploy@server \"sudo systemctl reload nginx\"

# 旧環境停止
ssh deploy@server \"sudo systemctl stop nanika-game-$CURRENT_ACTIVE\"

echo \"✅ Rollback completed successfully!\"
echo \"📚 Rolled back to version: $TARGET_VERSION\"

# 元のブランチに戻る
git checkout main
```

## 監視・通知システム

### 1. Slack統合

```yaml
# .github/workflows/notifications.yml
name: Notifications

on:
  workflow_run:
    workflows: [\"Continuous Integration\", \"Continuous Deployment\"]
    types: [completed]

jobs:
  notify-slack:
    name: Notify Slack
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Notify deployment success
        if: github.event.workflow_run.conclusion == 'success'
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: |
            🎉 Deployment successful!
            
            **Branch:** ${{ github.ref_name }}
            **Commit:** ${{ github.sha }}
            **Author:** ${{ github.actor }}
            **Environment:** ${{ github.ref == 'refs/heads/main' && 'Production' || 'Staging' }}
            
            [View deployment](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify deployment failure
        if: github.event.workflow_run.conclusion == 'failure'
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: |
            🚨 Deployment failed!
            
            **Branch:** ${{ github.ref_name }}
            **Commit:** ${{ github.sha }}
            **Author:** ${{ github.actor }}
            **Environment:** ${{ github.ref == 'refs/heads/main' && 'Production' || 'Staging' }}
            
            [View logs](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2. メトリクス収集

```yaml
# .github/workflows/metrics.yml
name: Collect Deployment Metrics

on:
  workflow_run:
    workflows: [\"Continuous Deployment\"]
    types: [completed]

jobs:
  collect-metrics:
    name: Collect Metrics
    runs-on: ubuntu-latest
    steps:
      - name: Calculate deployment metrics
        run: |
          # デプロイ時間を計算
          START_TIME=$(curl -s -H \"Authorization: token ${{ secrets.GITHUB_TOKEN }}\" \
            \"https://api.github.com/repos/${{ github.repository }}/actions/runs/${{ github.event.workflow_run.id }}\" \
            | jq -r '.created_at')
          
          END_TIME=$(curl -s -H \"Authorization: token ${{ secrets.GITHUB_TOKEN }}\" \
            \"https://api.github.com/repos/${{ github.repository }}/actions/runs/${{ github.event.workflow_run.id }}\" \
            | jq -r '.updated_at')
          
          # 時間計算（簡易版）
          echo \"Deployment duration: $START_TIME to $END_TIME\"

      - name: Send metrics to monitoring system
        run: |
          # DataDog, New Relic, または独自の監視システムに送信
          curl -X POST \"${{ secrets.METRICS_ENDPOINT }}\" \
            -H \"Content-Type: application/json\" \
            -d '{
              \"event\": \"deployment\",
              \"status\": \"${{ github.event.workflow_run.conclusion }}\",
              \"branch\": \"${{ github.ref_name }}\",
              \"commit\": \"${{ github.sha }}\",
              \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }'
```

## セキュリティ・シークレット管理

### 1. GitHub Secrets設定

**Required Secrets:**
```bash
# Production
PRODUCTION_SSH_KEY          # SSH private key for production server
PRODUCTION_HOST             # Production server hostname
PRODUCTION_USER             # Username for production deployment
PRODUCTION_API_URL          # Production API URL

# Staging  
STAGING_SSH_KEY             # SSH private key for staging server
STAGING_HOST                # Staging server hostname
STAGING_USER                # Username for staging deployment
STAGING_API_URL             # Staging API URL

# Third-party services
CODECOV_TOKEN               # Codecov integration
VERCEL_TOKEN                # Vercel deployment
VERCEL_ORG_ID               # Vercel organization ID
VERCEL_PROJECT_ID           # Vercel project ID
SLACK_WEBHOOK_URL           # Slack notifications
LHCI_GITHUB_APP_TOKEN       # Lighthouse CI

# Monitoring
METRICS_ENDPOINT            # Metrics collection endpoint
```

### 2. セキュリティスキャン

```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  push:
    branches: [main]

jobs:
  security-scan:
    name: Security Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run CodeQL analysis
        uses: github/codeql-action/init@v3
        with:
          languages: javascript

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

## 今後の拡張計画

### Phase 1: 基盤強化（3ヶ月）
1. **マルチ環境対応**: Preview環境の自動作成・削除
2. **高度なテスト**: Visual regression、Performance testing
3. **セキュリティ強化**: SAST/DAST、Container scanning
4. **監視強化**: APM統合、Error tracking

### Phase 2: スケーラビリティ（6ヶ月）
1. **コンテナ化**: Docker、Kubernetes対応
2. **マイクロサービス**: サービス別デプロイパイプライン
3. **CDN統合**: 静的アセットの最適化配信
4. **データベース管理**: Migration、Backup自動化

### Phase 3: AI/自動化（12ヶ月）
1. **AI支援**: 自動テスト生成、Code review bot
2. **予測分析**: デプロイリスク分析、障害予測
3. **自動復旧**: 障害検知からロールバックまで自動化
4. **コスト最適化**: リソース使用量分析と自動スケーリング

## まとめ

本CI/CD設計は、GitHub Actionsを活用した包括的な自動化パイプラインにより、高品質なソフトウェアの迅速で信頼性の高いリリースを実現します。厳格な品質ゲート、多段階デプロイメント、包括的な監視により、ゲームアプリケーションの安定運用と継続的改善を支援します。

段階的な機能拡張と運用経験の蓄積により、より堅牢で効率的なCI/CDシステムを構築していきます。