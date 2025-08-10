# SEO要件設計

## 目的と概要

このドキュメントは、Nanika GameプロジェクトのSEO（検索エンジン最適化）戦略について詳述します。React Router v7のSSR機能を活用し、ゲームアプリケーションとしての認知度向上とオーガニック検索からのユーザー獲得を目的とした包括的なSEO実装を定義します。

## 現在の実装状況

- **React Router v7 SSR**: サーバーサイドレンダリング対応済み
- **基本メタタグ**: title、descriptionの設定
- **セマンティックHTML**: 適切なHTML要素の使用
- **レスポンシブデザイン**: モバイルファースト設計
- **HTTPS対応**: セキュア通信の実装

## SEO戦略概要

### ターゲットキーワード

**プライマリキーワード:**
- オンラインゲーム
- ブラウザゲーム
- マルチプレイヤーゲーム
- 無料ゲーム

**セカンダリキーワード:**
- リアルタイム対戦ゲーム
- 友達と遊べるゲーム
- Web ゲーム
- パーティゲーム

**ロングテールキーワード:**
- 登録不要 オンラインゲーム
- 友達と一緒にできるゲーム
- スマホで遊べる対戦ゲーム
- 無料で楽しめるマルチプレイヤーゲーム

## React Router v7でのSEO実装

### 1. メタデータ管理

```typescript
// app/web/routes/home.tsx
import type { MetaFunction } from '@react-router/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Nanika Game - 友達と楽しむオンライン対戦ゲーム' },
    {
      name: 'description',
      content: '無料で楽しめるオンライン対戦ゲーム「Nanika Game」。友達と一緒にリアルタイムで対戦できるブラウザゲームです。登録簡単、今すぐプレイ開始！'
    },
    {
      name: 'keywords',
      content: 'オンラインゲーム,ブラウザゲーム,マルチプレイヤー,対戦ゲーム,無料ゲーム,リアルタイム'
    },
    // Open Graph
    { property: 'og:title', content: 'Nanika Game - 友達と楽しむオンライン対戦ゲーム' },
    { property: 'og:description', content: '無料で楽しめるオンライン対戦ゲーム。友達と一緒にリアルタイムで対戦しよう！' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://nanika-game.com' },
    { property: 'og:image', content: 'https://nanika-game.com/og-image.jpg' },
    { property: 'og:site_name', content: 'Nanika Game' },
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Nanika Game - 友達と楽しむオンライン対戦ゲーム' },
    { name: 'twitter:description', content: '無料で楽しめるオンライン対戦ゲーム。友達と一緒にリアルタイムで対戦しよう！' },
    { name: 'twitter:image', content: 'https://nanika-game.com/twitter-image.jpg' },
    // その他
    { name: 'robots', content: 'index,follow' },
    { name: 'author', content: 'Nanika Game Team' },
    { name: 'viewport', content: 'width=device-width,initial-scale=1' },
    { httpEquiv: 'Content-Language', content: 'ja' },
  ];
};
```

### 2. ページ別メタデータ戦略

#### ホームページ (`/`)
```typescript
export const meta: MetaFunction = () => ([
  { title: 'Nanika Game - 友達と楽しむオンライン対戦ゲーム | 無料ブラウザゲーム' },
  {
    name: 'description',
    content: '【完全無料】友達と一緒に楽しめるオンライン対戦ゲーム「Nanika Game」。登録簡単、ブラウザで今すぐプレイ！リアルタイム対戦でスリル満点のゲーム体験を。'
  },
]);
```

#### ゲーム一覧ページ (`/games`)
```typescript
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const gameCount = data.games.length;
  return [
    { title: `参加可能なゲーム${gameCount}件 | Nanika Game` },
    {
      name: 'description',
      content: `現在${gameCount}件のゲームが開催中！お好みのゲームに参加して友達と対戦しよう。新しいゲームの作成も簡単です。`
    },
  ];
};
```

#### 動的ページ（ゲームルーム）
```typescript
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const game = data.game;
  return [
    { title: `${game.name} - ゲームルーム | Nanika Game` },
    {
      name: 'description',
      content: `${game.name}に参加中。${game.participantCount}/${game.maxPlayers}人が参加。今すぐ参加してゲームを楽しもう！`
    },
    { property: 'og:title', content: `${game.name} - ゲームルーム` },
    { property: 'og:description', content: `${game.name}に参加中。一緒にゲームを楽しみませんか？` },
  ];
};
```

## 構造化データ（JSON-LD）実装

### 1. Webサイト情報

```typescript
// app/web/components/StructuredData.tsx
export function WebsiteStructuredData() {
  const websiteData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Nanika Game',
    description: '友達と楽しめるオンライン対戦ゲーム',
    url: 'https://nanika-game.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://nanika-game.com/search?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    },
    author: {
      '@type': 'Organization',
      name: 'Nanika Game Team'
    },
    dateCreated: '2024-01-01',
    inLanguage: 'ja'
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
    />
  );
}
```

### 2. ゲーム情報（VideoGame Schema）

```typescript
export function GameStructuredData({ game }: { game: Game }) {
  const gameData = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: `${game.name}は${game.maxPlayers}人まで参加できる対戦ゲームです。`,
    url: `https://nanika-game.com/games/${game.id}`,
    genre: 'Strategy Game',
    gamePlatform: 'Web Browser',
    operatingSystem: 'Any',
    applicationCategory: 'Game',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: game.averageRating || 4.5,
      reviewCount: game.reviewCount || 100,
      bestRating: 5,
      worstRating: 1
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(gameData) }}
    />
  );
}
```

### 3. パンくずリスト

```typescript
export function BreadcrumbStructuredData({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
    />
  );
}
```

## 技術的SEO実装

### 1. sitemap.xml生成

```typescript
// app/web/routes/sitemap[.]xml.tsx
export async function loader() {
  const baseUrl = 'https://nanika-game.com';
  
  // 静的ページ
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/login', priority: '0.8', changefreq: 'monthly' },
    { url: '/register', priority: '0.8', changefreq: 'monthly' },
    { url: '/games', priority: '0.9', changefreq: 'hourly' },
  ];

  // 動的ページ（アクティブなゲーム）
  const games = await getActiveGames();
  const gamePages = games.map(game => ({
    url: `/games/${game.id}`,
    priority: '0.7',
    changefreq: 'hourly',
    lastmod: game.updatedAt.toISOString()
  }));

  const allPages = [...staticPages, ...gamePages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600' // 1時間キャッシュ
    }
  });
}
```

### 2. robots.txt

```typescript
// app/web/routes/robots[.]txt.tsx
export function loader() {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://nanika-game.com/sitemap.xml`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}
```

### 3. Canonical URL設定

```typescript
// 各ページでcanonical URLを設定
export const meta: MetaFunction = ({ location }) => {
  const canonicalUrl = `https://nanika-game.com${location.pathname}`;
  
  return [
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};
```

## コンテンツSEO戦略

### 1. ヘディング構造最適化

```typescript
// セマンティックなHTML構造
export default function HomePage() {
  return (
    <main>
      <h1>Nanika Game - 友達と楽しむオンライン対戦ゲーム</h1>
      
      <section>
        <h2>なぜNanika Gameが選ばれるのか</h2>
        
        <div>
          <h3>完全無料で楽しめる</h3>
          <p>登録費用、月額費用は一切不要。今すぐ無料でゲームを始められます。</p>
        </div>
        
        <div>
          <h3>友達と簡単に対戦</h3>
          <p>ゲームルームを作成して友達を招待するだけ。複雑な設定は不要です。</p>
        </div>
        
        <div>
          <h3>リアルタイム対戦</h3>
          <p>遅延のないリアルタイム通信で、スリリングな対戦を楽しめます。</p>
        </div>
      </section>

      <section>
        <h2>ゲームの遊び方</h2>
        <ol>
          <li>アカウント登録（30秒で完了）</li>
          <li>ゲームルーム作成または参加</li>
          <li>友達と対戦開始！</li>
        </ol>
      </section>
    </main>
  );
}
```

### 2. コンテンツの充実化

```typescript
// ゲームルール説明ページ
export default function GameRules() {
  return (
    <article>
      <header>
        <h1>Nanika Game のルールと遊び方</h1>
        <p>初心者の方でも安心してプレイできるよう、詳しくルールを説明します。</p>
      </header>

      <section>
        <h2>基本ルール</h2>
        <p>Nanika Gameは2-4人で楽しむ戦略ゲームです。...</p>
      </section>

      <section>
        <h2>勝利条件</h2>
        <p>以下の条件のいずれかを満たすとゲームに勝利します：</p>
        <ul>
          <li>相手のポイントを0にする</li>
          <li>制限時間内に最も高いスコアを獲得する</li>
        </ul>
      </section>

      <section>
        <h2>よくある質問</h2>
        <details>
          <summary>ゲームは無料ですか？</summary>
          <p>はい、完全無料でプレイできます。隠れた費用は一切ありません。</p>
        </details>
        
        <details>
          <summary>スマートフォンでもプレイできますか？</summary>
          <p>はい、iOS・Android問わず、ブラウザからアクセスしてプレイできます。</p>
        </details>
      </section>
    </article>
  );
}
```

## パフォーマンスSEO

### 1. Core Web Vitals対応

```typescript
// 画像の遅延読み込みと最適化
export function OptimizedImage({ src, alt, ...props }: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      {...props}
      onLoad={(e) => {
        // Web Vitalsメトリクス送信
        if (window.gtag) {
          window.gtag('event', 'image_loaded', {
            'custom_parameter': src
          });
        }
      }}
    />
  );
}
```

### 2. 重要リソースのプリロード

```typescript
// app/root.tsx
export const links: LinksFunction = () => [
  // 重要なフォントのプリロード
  {
    rel: 'preload',
    href: '/fonts/inter-var.woff2',
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous'
  },
  // 重要なCSS
  {
    rel: 'preload',
    href: '/styles/critical.css',
    as: 'style'
  },
  // DNS prefetch for external resources
  {
    rel: 'dns-prefetch',
    href: '//www.google-analytics.com'
  }
];
```

## ローカルSEO対応（将来実装）

### 1. 地域ターゲティング

```typescript
// 地域別ランディングページ
export const meta: MetaFunction = () => ([
  { title: '東京でオンラインゲームを楽しむなら Nanika Game' },
  {
    name: 'description',
    content: '東京在住の方におすすめのオンライン対戦ゲーム。地域の友達と一緒にプレイしよう！'
  },
  { name: 'geo.region', content: 'JP-13' }, // 東京都
  { name: 'geo.placename', content: 'Tokyo' },
]);
```

## 国際化SEO（将来実装）

### 1. 多言語対応

```typescript
// hreflang実装
export const links: LinksFunction = () => [
  {
    rel: 'alternate',
    hrefLang: 'ja',
    href: 'https://nanika-game.com/'
  },
  {
    rel: 'alternate',
    hrefLang: 'en',
    href: 'https://nanika-game.com/en/'
  },
  {
    rel: 'alternate',
    hrefLang: 'x-default',
    href: 'https://nanika-game.com/'
  }
];
```

## SEO監視・測定

### 1. Google Analytics 4 統合

```typescript
// app/web/utils/analytics.ts
export function initializeAnalytics() {
  // GA4設定
  window.gtag('config', 'G-XXXXXXXXXX', {
    page_title: document.title,
    page_location: window.location.href,
    content_group1: 'Gaming', // カテゴリ
    custom_map: {
      custom_dimension_1: 'user_type' // ログインユーザー判定
    }
  });
}

// カスタムイベント送信
export function trackGameStart(gameId: string) {
  window.gtag('event', 'game_start', {
    game_id: gameId,
    event_category: 'engagement',
    event_label: 'game_interaction'
  });
}
```

### 2. Search Console連携

```typescript
// サイト認証メタタグ
export const meta: MetaFunction = () => ([
  {
    name: 'google-site-verification',
    content: 'your-verification-code'
  }
]);
```

### 3. SEOメトリクス収集

```typescript
// Core Web Vitalsの測定
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function initializeWebVitals() {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
}

function sendToAnalytics({ name, value, id }: any) {
  window.gtag('event', name, {
    event_category: 'Web Vitals',
    value: Math.round(name === 'CLS' ? value * 1000 : value),
    event_label: id,
    non_interaction: true
  });
}
```

## SEOチェックリスト

### 技術的SEO
- [ ] 全ページでtitle, descriptionが適切に設定されている
- [ ] Canonical URLが設定されている
- [ ] robots.txtが正しく配置されている
- [ ] sitemap.xmlが生成・送信されている
- [ ] 構造化データが実装されている
- [ ] モバイルフレンドリーテストを通過している
- [ ] Core Web Vitalsが良好な値を示している
- [ ] HTTPSで配信されている

### コンテンツSEO
- [ ] 適切なヘディング構造（H1-H6）が使用されている
- [ ] 画像にalt属性が設定されている
- [ ] 内部リンクが適切に配置されている
- [ ] コンテンツが独自性がある
- [ ] ターゲットキーワードが自然に含まれている
- [ ] 情報が最新に保たれている

### ユーザーエクスペリエンス
- [ ] ページの読み込み速度が3秒以内
- [ ] モバイルデバイスで正常に動作する
- [ ] ナビゲーションが分かりやすい
- [ ] 404エラーページが適切に設定されている
- [ ] SSL証明書が有効

## 今後の改善計画

### Phase 1: 基礎固め（3ヶ月）
1. 全ページのメタデータ最適化
2. 構造化データの実装
3. サイトマップの自動生成
4. Core Web Vitalsの改善

### Phase 2: コンテンツ拡充（6ヶ月）
1. ゲーム攻略ガイドページ作成
2. ブログ機能の追加
3. ユーザーレビュー機能
4. FAQページの充実

### Phase 3: 高度な最適化（12ヶ月）
1. 多言語対応
2. PWA化によるアプリライクな体験
3. AMP対応（必要に応じて）
4. 音声検索最適化

## まとめ

本SEO戦略は、React Router v7のSSR機能を最大限活用し、ゲームアプリケーションとしての特性を考慮した包括的なSEO実装を提供します。技術的SEOからコンテンツSEO、ユーザーエクスペリエンス最適化まで、全方位的にアプローチすることで、検索エンジンからの自然流入とユーザーエンゲージメントの向上を実現します。

継続的なモニタリングと改善を通じて、競合他社に対する検索順位の優位性を確立し、Nanika Gameの認知度とユーザーベースの拡大を支援します。