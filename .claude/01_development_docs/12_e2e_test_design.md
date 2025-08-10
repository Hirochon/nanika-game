# E2Eテスト設計

## 目的と概要

このドキュメントは、Nanika GameプロジェクトのE2E（End-to-End）テスト設計について詳述します。Playwrightを活用したブラウザテストにより、ユーザーの実際の操作フローを再現し、システム全体の動作を検証します。エラー監視、クリティカルパステスト、視覚回帰テストを含む包括的なE2Eテスト戦略を提供します。

## 現在の実装状況

- **Playwrightセットアップ**: 基本的なブラウザテスト環境構築（Chrome, Firefox, Safari対応）
- **テストデータベース**: E2E専用のテストデータベース環境
- **CI/CD統合**: GitHub ActionsでのE2Eテスト自動実行
- **基本テストスイート**: ログイン・登録・ダッシュボードの基本フロー
- **テスト環境**: 本番に近いステージング環境でのテスト実行

## E2Eテスト戦略

### 1. テストピラミッドにおける位置づけ

```mermaid
graph TD
    A[E2E Tests<br/>高価・低速・信頼性高] --> B[Integration Tests<br/>中価格・中速・中信頼性]
    B --> C[Unit Tests<br/>安価・高速・信頼性中]
    
    style A fill:#ff6b6b
    style B fill:#ffd93d  
    style C fill:#6bcf7f
    
    D[E2E: 5-10%<br/>クリティカルパスのみ] --> A
    E[Integration: 20-30%<br/>API・DB連携] --> B
    F[Unit: 60-75%<br/>ビジネスロジック] --> C
```

### 2. テスト範囲とスコープ

```typescript
// E2Eテストの分類
export const E2ETestCategory = {
  SMOKE: 'smoke',           // 基本動作確認（5分以内）
  CRITICAL: 'critical',     // クリティカルパス（15分以内）
  REGRESSION: 'regression', // 回帰テスト（30分以内）
  VISUAL: 'visual',         // ビジュアル回帰テスト
  PERFORMANCE: 'performance' // パフォーマンステスト
} as const;
export type E2ETestCategory = typeof E2ETestCategory[keyof typeof E2ETestCategory];
```

## Playwrightテストフレームワーク設計

### 1. 基本設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // テストディレクトリ
  testDir: './e2e/tests',
  
  // 並列実行設定
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  
  // レポート設定
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['list', { printSteps: true }]
  ],
  
  // 全体設定
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 日本語環境でのテスト
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    
    // ブラウザ設定
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // テストデータ
    storageState: undefined, // 各テストで認証状態をセットアップ
  },
  
  // ブラウザプロジェクト設定
  projects: [
    // デスクトップブラウザ
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // モバイルデバイス
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // 認証済みテスト
    {
      name: 'authenticated',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'e2e/auth/user.json'
      },
      dependencies: ['setup'],
    },
  ],
  
  // セットアップ
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),
  
  // タイムアウト設定
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  
  // 再試行設定
  retries: process.env.CI ? 2 : 1,
  
  // Webサーバー設定（開発時）
  webServer: process.env.CI ? undefined : {
    command: 'npm run preview',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. グローバルセットアップ

```typescript
// e2e/global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 E2Eテストのグローバルセットアップを開始');
  
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  
  // テストデータベースの準備
  await setupTestDatabase();
  
  // 認証状態の事前準備
  await setupAuthenticationStates(baseURL);
  
  // テスト用ユーザーの作成
  await createTestUsers();
  
  console.log('✅ グローバルセットアップ完了');
}

async function setupTestDatabase() {
  console.log('💾 テストデータベースの準備中...');
  
  // テストデータベースのリセット
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_TEST
      }
    }
  });
  
  try {
    // 既存データのクリア
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('✅ テストデータベース準備完了');
  } catch (error) {
    console.error('❌ テストデータベースエラー:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function setupAuthenticationStates(baseURL: string) {
  console.log('🔐 認証状態の事前準備中...');
  
  const browser = await chromium.launch();
  
  try {
    // 一般ユーザー認証状態
    await createAuthState(browser, baseURL, {
      email: 'testuser@example.com',
      password: 'password123',
      name: 'Test User'
    }, 'e2e/auth/user.json');
    
    // 管理者認証状態
    await createAuthState(browser, baseURL, {
      email: 'admin@example.com', 
      password: 'admin123',
      name: 'Admin User'
    }, 'e2e/auth/admin.json');
    
    console.log('✅ 認証状態準備完了');
  } finally {
    await browser.close();
  }
}

async function createAuthState(browser, baseURL: string, user: any, outputPath: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // ユーザーを作成
    await createTestUser(user);
    
    // ログイン処理
    await page.goto(`${baseURL}/login`);
    await page.fill('[data-testid="email"]', user.email);
    await page.fill('[data-testid="password"]', user.password);
    await page.click('[data-testid="login-button"]');
    
    // ログイン成功を確認
    await page.waitForURL('**/dashboard');
    
    // 認証状態を保存
    await context.storageState({ path: outputPath });
  } finally {
    await context.close();
  }
}

async function createTestUser(userData: any) {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_TEST } }
  });
  
  try {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
```

## クリティカルパステスト

### 1. 認証フロー

```typescript
// e2e/tests/auth/authentication.spec.ts
import { test, expect } from '@playwright/test';

test.describe('認証フロー', () => {
  test.beforeEach(async ({ page }) => {
    // 各テスト前にクリーンな状態
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test('新規ユーザー登録からゲーム参加まで', async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;
    
    // 1. ホームページアクセス
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Nanika Game');
    
    // 2. 新規登録
    await page.click('[data-testid="register-link"]');
    await page.fill('[data-testid="name"]', 'E2E Test User');
    await page.fill('[data-testid="email"]', testEmail);
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password"]', 'SecurePass123!');
    await page.check('[data-testid="accept-terms"]');
    
    await page.click('[data-testid="register-button"]');
    
    // 3. ダッシュボードにリダイレクト確認
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toContainText('E2E Test User');
    
    // 4. ゲーム作成
    await page.click('[data-testid="create-game-button"]');
    await page.fill('[data-testid="game-name"]', 'E2Eテストゲーム');
    await page.selectOption('[data-testid="max-players"]', '4');
    await page.selectOption('[data-testid="difficulty"]', 'normal');
    
    await page.click('[data-testid="create-game-submit"]');
    
    // 5. ゲーム画面への遷移確認
    await page.waitForURL('**/games/*');
    await expect(page.locator('[data-testid="game-title"]')).toContainText('E2Eテストゲーム');
    await expect(page.locator('[data-testid="game-status"]')).toContainText('待機中');
  });

  test('ログイン・ログアウトフロー', async ({ page }) => {
    // 1. ログイン
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'testuser@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await page.waitForURL('**/dashboard');
    
    // 2. ユーザー情報確認
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Test User');
    
    // 3. ログアウト
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // 4. ホームページへリダイレクト確認
    await page.waitForURL('/');
    await expect(page.locator('[data-testid="login-link"]')).toBeVisible();
  });

  test('認証エラーハンドリング', async ({ page }) => {
    await page.goto('/login');
    
    // 1. 無効な認証情報
    await page.fill('[data-testid="email"]', 'invalid@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // 2. エラーメッセージ確認
    await expect(page.locator('[data-testid="error-message"]')).toContainText('メールアドレスまたはパスワードが正しくありません');
    
    // 3. フォームが保持されている確認
    await expect(page.locator('[data-testid="email"]')).toHaveValue('invalid@example.com');
    await expect(page.locator('[data-testid="password"]')).toHaveValue('');
  });
});
```

### 2. ゲームプレイフロー

```typescript
// e2e/tests/game/gameplay.spec.ts
import { test, expect } from '@playwright/test';

test.describe('ゲームプレイフロー', () => {
  test.use({ storageState: 'e2e/auth/user.json' });

  test('マルチプレイヤーゲームのフルフロー', async ({ browser }) => {
    // 複数のプレイヤーをシミュレート
    const contexts = await Promise.all([
      browser.newContext({ storageState: 'e2e/auth/user.json' }),
      browser.newContext(), // ゲストユーザー
    ]);
    
    const [hostContext, guestContext] = contexts;
    const [hostPage, guestPage] = await Promise.all([
      hostContext.newPage(),
      guestContext.newPage(),
    ]);

    try {
      // 1. ホストがゲーム作成
      await hostPage.goto('/dashboard');
      await hostPage.click('[data-testid="create-game-button"]');
      
      await hostPage.fill('[data-testid="game-name"]', 'マルチプレイヤーテスト');
      await hostPage.selectOption('[data-testid="max-players"]', '2');
      await hostPage.click('[data-testid="create-game-submit"]');
      
      const gameUrl = hostPage.url();
      const gameId = gameUrl.split('/').pop();
      
      // 2. ゲスト参加
      await guestPage.goto(`/games/${gameId}`);
      
      // ゲストログイン（簡易フロー）
      await guestPage.click('[data-testid="join-as-guest"]');
      await guestPage.fill('[data-testid="guest-name"]', 'ゲストプレイヤー');
      await guestPage.click('[data-testid="join-game-button"]');
      
      // 3. 両プレイヤーでゲーム開始を確認
      await Promise.all([
        expect(hostPage.locator('[data-testid="player-count"]')).toContainText('2/2'),
        expect(guestPage.locator('[data-testid="player-count"]')).toContainText('2/2'),
      ]);
      
      // 4. ゲーム開始
      await hostPage.click('[data-testid="start-game-button"]');
      
      await Promise.all([
        hostPage.waitForSelector('[data-testid="game-board"]'),
        guestPage.waitForSelector('[data-testid="game-board"]'),
      ]);
      
      // 5. ゲームプレイ（簡単な操作）
      await hostPage.click('[data-testid="game-cell-0-0"]');
      await expect(hostPage.locator('[data-testid="current-turn"]')).toContainText('ゲストプレイヤー');
      
      await guestPage.click('[data-testid="game-cell-1-1"]');
      await expect(guestPage.locator('[data-testid="current-turn"]')).toContainText('Test User');
      
      // 6. ゲーム終了条件のテスト（簡略化）
      await hostPage.click('[data-testid="forfeit-button"]');
      await hostPage.click('[data-testid="confirm-forfeit"]');
      
      // 7. 結果画面確認
      await Promise.all([
        expect(hostPage.locator('[data-testid="game-result"]')).toContainText('敗北'),
        expect(guestPage.locator('[data-testid="game-result"]')).toContainText('勝利'),
      ]);
      
    } finally {
      await Promise.all([
        hostContext.close(),
        guestContext.close(),
      ]);
    }
  });

  test('ゲーム一覧・フィルタリング機能', async ({ page }) => {
    await page.goto('/games');
    
    // 1. ゲーム一覧表示確認
    await expect(page.locator('[data-testid="game-list"]')).toBeVisible();
    
    // 2. フィルター機能
    await page.selectOption('[data-testid="status-filter"]', 'waiting');
    await page.click('[data-testid="apply-filter"]');
    
    // 3. フィルター結果確認
    const gameCards = page.locator('[data-testid="game-card"]');
    const count = await gameCards.count();
    
    for (let i = 0; i < count; i++) {
      await expect(gameCards.nth(i).locator('[data-testid="game-status"]')).toContainText('待機中');
    }
    
    // 4. 検索機能
    await page.fill('[data-testid="search-input"]', 'テスト');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    const filteredGames = page.locator('[data-testid="game-card"]:has-text("テスト")');
    await expect(filteredGames.first()).toBeVisible();
  });
});
```

## ビジュアル回帰テスト

### 1. スクリーンショット比較

```typescript
// e2e/tests/visual/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('ビジュアル回帰テスト', () => {
  test.use({ storageState: 'e2e/auth/user.json' });

  test('主要画面のスクリーンショット比較', async ({ page }) => {
    // 1. ホームページ
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage.png');
    
    // 2. ダッシュボード
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="user-name"]');
    await expect(page).toHaveScreenshot('dashboard.png');
    
    // 3. ゲーム一覧
    await page.goto('/games');
    await page.waitForSelector('[data-testid="game-list"]');
    await expect(page).toHaveScreenshot('games-list.png');
    
    // 4. プロフィールページ
    await page.goto('/profile');
    await page.waitForSelector('[data-testid="profile-form"]');
    await expect(page).toHaveScreenshot('profile.png');
  });

  test('ゲーム画面のビジュアルテスト', async ({ page }) => {
    // テストゲームを作成
    await page.goto('/dashboard');
    await page.click('[data-testid="create-game-button"]');
    await page.fill('[data-testid="game-name"]', 'ビジュアルテストゲーム');
    await page.click('[data-testid="create-game-submit"]');
    
    // ゲーム画面のスクリーンショット
    await page.waitForSelector('[data-testid="game-board"]');
    await expect(page).toHaveScreenshot('game-room.png');
  });

  test('レスポンシブデザインのテスト', async ({ page }) => {
    await page.goto('/');
    
    // デスクトップ
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('homepage-desktop.png');
    
    // タブレット
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot('homepage-tablet.png');
    
    // モバイル
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });

  test('ダークモードのテスト', async ({ page }) => {
    await page.goto('/dashboard');
    
    // ライトモード
    await expect(page).toHaveScreenshot('dashboard-light.png');
    
    // ダークモードに切り替え
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500); // アニメーション待機
    await expect(page).toHaveScreenshot('dashboard-dark.png');
  });
});
```

### 2. コンポーネント単位のビジュアルテスト

```typescript
// e2e/tests/visual/components.spec.ts
import { test, expect } from '@playwright/test';

test.describe('コンポーネントビジュアルテスト', () => {
  test('フォームコンポーネントの状態別スクリーンショット', async ({ page }) => {
    await page.goto('/login');
    
    // 1. 初期状態
    await expect(page.locator('[data-testid="login-form"]')).toHaveScreenshot('login-form-initial.png');
    
    // 2. 入力中状態
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await expect(page.locator('[data-testid="login-form"]')).toHaveScreenshot('login-form-filled.png');
    
    // 3. エラー状態
    await page.fill('[data-testid="email"]', 'invalid-email');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="error-message"]');
    await expect(page.locator('[data-testid="login-form"]')).toHaveScreenshot('login-form-error.png');
  });

  test('ゲームカードコンポーネント', async ({ page }) => {
    await page.goto('/games');
    
    // 個別のゲームカードのスクリーンショット
    const gameCard = page.locator('[data-testid="game-card"]').first();
    await expect(gameCard).toHaveScreenshot('game-card-waiting.png');
    
    // ホバー状態
    await gameCard.hover();
    await expect(gameCard).toHaveScreenshot('game-card-hover.png');
  });

  test('ナビゲーションコンポーネント', async ({ page }) => {
    await page.goto('/dashboard');
    
    // デスクトップナビゲーション
    await expect(page.locator('[data-testid="desktop-nav"]')).toHaveScreenshot('desktop-nav.png');
    
    // モバイルナビゲーション
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toHaveScreenshot('mobile-nav.png');
  });
});
```

## パフォーマンス測定

### 1. Core Web Vitals測定

```typescript
// e2e/tests/performance/web-vitals.spec.ts
import { test, expect } from '@playwright/test';

test.describe('パフォーマンステスト', () => {
  test('Core Web Vitals測定', async ({ page }) => {
    // Web Vitalsライブラリの注入
    await page.addInitScript(() => {
      window.webVitalsResults = {};
    });

    await page.goto('/');
    
    // Largest Contentful Paint (LCP)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });
    
    // First Input Delay (FID) - 実際のインタラクションで測定
    await page.click('[data-testid="login-link"]');
    
    const fid = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            resolve(entry.processingStart - entry.startTime);
          }
        }).observe({ entryTypes: ['first-input'] });
      });
    });
    
    // パフォーマンス基準の検証
    expect(lcp).toBeLessThan(2500); // LCP < 2.5秒
    expect(fid).toBeLessThan(100);  // FID < 100ms
    
    console.log(`LCP: ${lcp}ms, FID: ${fid}ms`);
  });

  test('ページロード時間測定', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // 3秒以内のロード時間を要求
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`Dashboard load time: ${loadTime}ms`);
  });

  test('API レスポンス時間測定', async ({ page }) => {
    await page.goto('/games');
    
    // API呼び出しのレスポンス時間を測定
    const [response] = await Promise.all([
      page.waitForResponse('**/api/games**'),
      page.reload()
    ]);
    
    const responseTime = Date.now() - response.request().timing().requestTime;
    
    // API応答時間は1秒以内
    expect(responseTime).toBeLessThan(1000);
    
    console.log(`API response time: ${responseTime}ms`);
  });

  test('画像最適化確認', async ({ page }) => {
    await page.goto('/');
    
    // 画像要素の確認
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const image = images.nth(i);
      
      // 適切なフォーマット確認
      const src = await image.getAttribute('src');
      if (src) {
        expect(src).toMatch(/\.(webp|avif|jpg|png)$/);
      }
      
      // alt属性の確認
      const alt = await image.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });
});
```

### 2. バンドルサイズとリソース監視

```typescript
// e2e/tests/performance/bundle-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('リソース監視', () => {
  test('JavaScriptバンドルサイズ確認', async ({ page }) => {
    const responses: any[] = [];
    
    page.on('response', response => {
      if (response.url().includes('.js')) {
        responses.push({
          url: response.url(),
          size: response.headers()['content-length'] || 0
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // メインバンドルサイズの確認
    const mainBundle = responses.find(r => r.url.includes('index'));
    if (mainBundle) {
      expect(parseInt(mainBundle.size)).toBeLessThan(500 * 1024); // 500KB未満
    }
    
    // 総JSサイズの確認
    const totalJSSize = responses.reduce((sum, r) => sum + parseInt(r.size || 0), 0);
    expect(totalJSSize).toBeLessThan(1024 * 1024); // 1MB未満
  });

  test('CSSファイルサイズ確認', async ({ page }) => {
    const cssResponses: any[] = [];
    
    page.on('response', response => {
      if (response.url().includes('.css')) {
        cssResponses.push({
          url: response.url(),
          size: response.headers()['content-length'] || 0
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const totalCSSSize = cssResponses.reduce((sum, r) => sum + parseInt(r.size || 0), 0);
    expect(totalCSSSize).toBeLessThan(200 * 1024); // 200KB未満
  });

  test('リソースキャッシュ確認', async ({ page }) => {
    // 初回訪問
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const firstLoadResponses: any[] = [];
    page.on('response', response => {
      firstLoadResponses.push({
        url: response.url(),
        fromCache: response.fromServiceWorker() || response.status() === 304
      });
    });
    
    // 2回目の訪問
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 静的リソースがキャッシュされているか確認
    const cachedResources = firstLoadResponses.filter(r => 
      (r.url.includes('.js') || r.url.includes('.css') || r.url.includes('.png')) && 
      r.fromCache
    );
    
    expect(cachedResources.length).toBeGreaterThan(0);
  });
});
```

## アクセシビリティテスト

### 1. 自動アクセシビリティ監査

```typescript
// e2e/tests/accessibility/a11y.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('アクセシビリティテスト', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  test('ホームページのアクセシビリティ', async ({ page }) => {
    await page.goto('/');
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test('ログインフォームのアクセシビリティ', async ({ page }) => {
    await page.goto('/login');
    
    await checkA11y(page, '[data-testid="login-form"]', {
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'keyboard-trap': { enabled: true }
      }
    });
  });

  test('ゲーム画面のアクセシビリティ', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="create-game-button"]');
    await page.fill('[data-testid="game-name"]', 'A11yテスト');
    await page.click('[data-testid="create-game-submit"]');
    
    await checkA11y(page, '[data-testid="game-board"]', {
      rules: {
        'focus-order-semantics': { enabled: true },
        'keyboard-navigation': { enabled: true }
      }
    });
  });
});
```

### 2. キーボードナビゲーションテスト

```typescript
// e2e/tests/accessibility/keyboard-navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('キーボードナビゲーション', () => {
  test('Tab順序の確認', async ({ page }) => {
    await page.goto('/');
    
    // Tab順序の定義
    const expectedTabOrder = [
      '[data-testid="login-link"]',
      '[data-testid="register-link"]',
      '[data-testid="games-link"]',
      '[data-testid="about-link"]'
    ];
    
    // Tab移動テスト
    for (const selector of expectedTabOrder) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      const expectedElement = selector.match(/data-testid="([^"]+)"/)?.[1];
      expect(focusedElement).toBe(expectedElement);
    }
  });

  test('フォームのキーボード操作', async ({ page }) => {
    await page.goto('/login');
    
    // Tab移動
    await page.keyboard.press('Tab'); // email field
    await page.keyboard.type('test@example.com');
    
    await page.keyboard.press('Tab'); // password field
    await page.keyboard.type('password123');
    
    await page.keyboard.press('Tab'); // remember me checkbox
    await page.keyboard.press('Space'); // check
    
    await page.keyboard.press('Tab'); // login button
    await page.keyboard.press('Enter'); // submit
    
    // フォーカスが適切に移動することを確認
    await page.waitForURL('**/dashboard');
  });

  test('Escapeキーの動作', async ({ page }) => {
    await page.goto('/dashboard');
    
    // モーダル表示
    await page.click('[data-testid="create-game-button"]');
    await expect(page.locator('[data-testid="game-creation-modal"]')).toBeVisible();
    
    // Escapeキーでモーダル閉じる
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="game-creation-modal"]')).not.toBeVisible();
  });
});
```

## エラー監視・デバッグ

### 1. JavaScriptエラーの捕捉

```typescript
// e2e/tests/monitoring/error-tracking.spec.ts
import { test, expect } from '@playwright/test';

test.describe('エラー監視', () => {
  test('JavaScriptエラーの監視', async ({ page }) => {
    const jsErrors: string[] = [];
    
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    page.on('response', response => {
      if (response.status() >= 400) {
        jsErrors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });
    
    await page.goto('/');
    await page.click('[data-testid="games-link"]');
    await page.waitForLoadState('networkidle');
    
    // JavaScriptエラーがないことを確認
    expect(jsErrors).toHaveLength(0);
  });

  test('コンソール警告の監視', async ({ page }) => {
    const consoleWarnings: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });
    
    await page.goto('/dashboard');
    
    // React開発モード以外の警告をチェック
    const relevantWarnings = consoleWarnings.filter(w => 
      !w.includes('React') && 
      !w.includes('DevTools')
    );
    
    expect(relevantWarnings).toHaveLength(0);
  });

  test('ネットワークエラーの監視', async ({ page }) => {
    const networkErrors: any[] = [];
    
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
    });
    
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    
    // ネットワークエラーがないことを確認
    expect(networkErrors).toHaveLength(0);
  });
});
```

### 2. デバッグ支援機能

```typescript
// e2e/utils/debug-helpers.ts

export class DebugHelper {
  constructor(private page: any) {}

  async captureState(label: string) {
    const timestamp = new Date().toISOString();
    
    // スクリーンショット
    await this.page.screenshot({
      path: `debug-screenshots/${label}-${timestamp}.png`,
      fullPage: true
    });
    
    // HTMLダンプ
    const html = await this.page.content();
    require('fs').writeFileSync(
      `debug-html/${label}-${timestamp}.html`, 
      html
    );
    
    // ネットワークログ
    const performanceLog = await this.page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0];
    });
    
    console.log(`Debug capture: ${label}`, {
      timestamp,
      performanceLog,
      url: this.page.url()
    });
  }

  async waitForStableDOM(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        let lastMutationTime = window.lastMutationTime || 0;
        const now = Date.now();
        
        new MutationObserver(() => {
          window.lastMutationTime = Date.now();
        }).observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
        
        return now - lastMutationTime > 1000; // 1秒間変更なし
      },
      { timeout }
    );
  }

  async logPerformanceMetrics() {
    const metrics = await this.page.evaluate(() => {
      return {
        timing: performance.timing,
        memory: (performance as any).memory,
        navigation: performance.navigation
      };
    });
    
    console.log('Performance metrics:', metrics);
    return metrics;
  }
}
```

## CI/CD統合

### 1. GitHub Actions設定

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e-tests:
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
    
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL_TEST: postgresql://test_user:test_password@localhost:5432/test_db
          
      - name: Build application
        run: npm run build
        
      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}
        
      - name: Start application
        run: |
          npm run preview &
          npx wait-on http://localhost:3000 --timeout 60000
        env:
          DATABASE_URL_TEST: postgresql://test_user:test_password@localhost:5432/test_db
          
      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.browser }}
        env:
          BASE_URL: http://localhost:3000
          DATABASE_URL_TEST: postgresql://test_user:test_password@localhost:5432/test_db
          
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
          
      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: screenshots-${{ matrix.browser }}
          path: test-results/
```

### 2. テスト結果レポート

```typescript
// e2e/reporters/custom-reporter.ts
import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class CustomReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    const status = result.status;
    const duration = result.duration;
    
    console.log(`${status.toUpperCase()}: ${test.title} (${duration}ms)`);
    
    if (result.error) {
      console.error('Error:', result.error.message);
    }
    
    // Slack通知（失敗時）
    if (status === 'failed' && process.env.CI) {
      this.sendSlackNotification(test, result);
    }
  }
  
  private async sendSlackNotification(test: TestCase, result: TestResult) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    const payload = {
      text: `🚨 E2Eテスト失敗: ${test.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*テスト名:* ${test.title}\n*エラー:* ${result.error?.message}\n*実行時間:* ${result.duration}ms`
          }
        }
      ]
    };
    
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Slack通知の送信に失敗:', error);
    }
  }
}

export default CustomReporter;
```

## テストデータ管理

### 1. シードデータ生成

```typescript
// e2e/fixtures/test-data.ts

export class TestDataGenerator {
  private prisma: any;
  
  constructor() {
    const { PrismaClient } = require('@prisma/client');
    this.prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST } }
    });
  }
  
  async createTestUsers(count = 5) {
    const bcrypt = require('bcryptjs');
    const users = [];
    
    for (let i = 0; i < count; i++) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      const user = await this.prisma.user.create({
        data: {
          name: `Test User ${i + 1}`,
          email: `testuser${i + 1}@example.com`,
          password: hashedPassword,
        }
      });
      
      users.push(user);
    }
    
    return users;
  }
  
  async createTestGames(users: any[], count = 10) {
    const games = [];
    const statuses = ['waiting', 'playing', 'finished'];
    const difficulties = ['easy', 'normal', 'hard'];
    
    for (let i = 0; i < count; i++) {
      const creator = users[Math.floor(Math.random() * users.length)];
      
      const game = await this.prisma.game.create({
        data: {
          name: `Test Game ${i + 1}`,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          maxPlayers: Math.floor(Math.random() * 6) + 2, // 2-8 players
          settings: {
            gameMode: 'classic',
            difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
            allowSpectators: Math.random() > 0.5,
            isPrivate: Math.random() > 0.7
          },
          createdBy: creator.id
        }
      });
      
      games.push(game);
    }
    
    return games;
  }
  
  async cleanupTestData() {
    await this.prisma.session.deleteMany();
    await this.prisma.game.deleteMany();
    await this.prisma.user.deleteMany();
  }
  
  async disconnect() {
    await this.prisma.$disconnect();
  }
}
```

### 2. テスト環境のリセット

```typescript
// e2e/utils/test-cleanup.ts
import { TestDataGenerator } from '../fixtures/test-data';

export async function resetTestEnvironment() {
  const generator = new TestDataGenerator();
  
  try {
    console.log('🧹 テストデータをクリーンアップ中...');
    await generator.cleanupTestData();
    
    console.log('👥 テストユーザーを作成中...');
    const users = await generator.createTestUsers(10);
    
    console.log('🎮 テストゲームを作成中...');
    await generator.createTestGames(users, 20);
    
    console.log('✅ テスト環境のリセット完了');
  } finally {
    await generator.disconnect();
  }
}
```

## 今後の拡張計画

### Phase 1: テスト基盤強化（3ヶ月）
1. **並列テスト実行**: テスト実行時間の短縮
2. **ビジュアル回帰テストの自動化**: スクリーンショット比較の精度向上
3. **A11yテストの詳細化**: より厳密なアクセシビリティ検証
4. **API統合テストの拡張**: GraphQL・WebSocket対応

### Phase 2: 高度なテスト機能（6ヶ月）
1. **AI支援テスト**: 自動テストケース生成
2. **カオスエンジニアリング**: 障害耐性テスト
3. **パフォーマンス監視強化**: 継続的パフォーマンステスト
4. **セキュリティテスト**: 脆弱性検査の自動化

### Phase 3: 運用最適化（12ヶ月）
1. **テスト結果の分析・改善**: ML活用したテスト効率化
2. **ユーザーシナリオの自動化**: 実際のユーザー行動の再現
3. **マルチブラウザテストの完全自動化**: 全ブラウザでの同時実行
4. **本番環境監視との統合**: リアルユーザー監視データの活用

## まとめ

本E2Eテスト設計は、Playwrightを活用した包括的なブラウザテストにより、ユーザーの実際の体験を忠実に再現し、システム全体の品質を保証します。クリティカルパステスト、ビジュアル回帰テスト、パフォーマンステスト、アクセシビリティテストを組み合わせることで、多角的な品質検証を実現しています。

CI/CD統合による自動実行と詳細なエラー監視により、開発プロセス全体の品質向上と迅速なフィードバックサイクルを支援し、信頼性の高いゲームアプリケーションの継続的な改善を可能にします。