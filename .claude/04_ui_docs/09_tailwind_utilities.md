# Tailwind CSS ユーティリティパターン集

## 概要
このドキュメントは、Nanika GameプロジェクトにおけるTailwind CSS v4の使用パターンとベストプラクティスを定義します。モダンなユーティリティファーストCSS設計により、保守性の高いスタイリングを実現します。

## 目次
1. [基本セットアップ](#基本セットアップ)
2. [レイアウトパターン](#レイアウトパターン)
3. [レスポンシブデザイン](#レスポンシブデザイン)
4. [カラーシステム](#カラーシステム)
5. [タイポグラフィ](#タイポグラフィ)
6. [コンポーネントパターン](#コンポーネントパターン)
7. [アニメーション](#アニメーション)
8. [ダークモード](#ダークモード)
9. [カスタムユーティリティ](#カスタムユーティリティ)
10. [パフォーマンス最適化](#パフォーマンス最適化)

## 基本セットアップ

### CSS設定（app/web/app.css）
```css
@import "tailwindcss";

@theme {
  --font-sans:
    "Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
}

html,
body {
  @apply bg-white dark:bg-gray-950;

  @media (prefers-color-scheme: dark) {
    color-scheme: dark;
  }
}
```

### Vite設定
```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
```

## レイアウトパターン

### Flexboxレイアウト
```tsx
// 中央配置
<div className="flex items-center justify-center min-h-screen">
  <div>中央のコンテンツ</div>
</div>

// 水平配置（スペース均等）
<div className="flex justify-between items-center">
  <div>左</div>
  <div>中央</div>
  <div>右</div>
</div>

// 垂直配置
<div className="flex flex-col space-y-4">
  <div>アイテム1</div>
  <div>アイテム2</div>
  <div>アイテム3</div>
</div>

// レスポンシブフレックス
<div className="flex flex-col md:flex-row gap-4">
  <div className="flex-1">メイン</div>
  <div className="w-full md:w-64">サイドバー</div>
</div>
```

### Gridレイアウト
```tsx
// 基本的なグリッド
<div className="grid grid-cols-3 gap-4">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>

// レスポンシブグリッド
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {items.map(item => (
    <div key={item.id} className="p-4 bg-white rounded-lg shadow">
      {item.content}
    </div>
  ))}
</div>

// 複雑なグリッドレイアウト
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-8">メインコンテンツ</div>
  <div className="col-span-12 md:col-span-4">サイドバー</div>
  <div className="col-span-12 md:col-span-6 lg:col-span-3">フッター1</div>
  <div className="col-span-12 md:col-span-6 lg:col-span-3">フッター2</div>
</div>
```

### コンテナレイアウト
```tsx
// 中央寄せコンテナ
<div className="container mx-auto px-4">
  <div className="max-w-7xl mx-auto">
    コンテンツ
  </div>
</div>

// セクション分割
<div className="min-h-screen flex flex-col">
  <header className="bg-white shadow-sm">
    <div className="container mx-auto px-4 py-4">
      ヘッダー
    </div>
  </header>
  
  <main className="flex-1 container mx-auto px-4 py-8">
    メインコンテンツ
  </main>
  
  <footer className="bg-gray-100">
    <div className="container mx-auto px-4 py-4">
      フッター
    </div>
  </footer>
</div>
```

## レスポンシブデザイン

### ブレークポイント
```tsx
// Tailwind v4のデフォルトブレークポイント
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px

// モバイルファーストアプローチ
<div className="
  text-sm      // モバイル（デフォルト）
  sm:text-base // 640px以上
  md:text-lg   // 768px以上
  lg:text-xl   // 1024px以上
  xl:text-2xl  // 1280px以上
">
  レスポンシブテキスト
</div>

// 表示/非表示の制御
<div className="block md:hidden">モバイルのみ表示</div>
<div className="hidden md:block">デスクトップのみ表示</div>

// レスポンシブパディング
<div className="p-4 sm:p-6 md:p-8 lg:p-10">
  段階的にパディングが増加
</div>
```

### レスポンシブグリッド
```tsx
// カード列の自動調整
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {cards.map(card => (
    <div key={card.id} className="bg-white rounded-lg shadow p-4">
      {card.content}
    </div>
  ))}
</div>

// レスポンシブな2カラムレイアウト
<div className="flex flex-col lg:flex-row gap-8">
  <div className="lg:w-2/3">
    メインコンテンツ
  </div>
  <div className="lg:w-1/3">
    サイドバー
  </div>
</div>
```

## カラーシステム

### 基本的な色の使用
```tsx
// 背景色
<div className="bg-blue-500">青い背景</div>
<div className="bg-gradient-to-r from-blue-500 to-purple-500">グラデーション</div>

// テキスト色
<p className="text-gray-900">黒に近いテキスト</p>
<p className="text-gray-500">グレーのテキスト</p>
<p className="text-red-600">赤いテキスト（エラー）</p>
<p className="text-green-600">緑のテキスト（成功）</p>

// ボーダー色
<div className="border border-gray-300">グレーのボーダー</div>
<div className="border-2 border-blue-500">青い太いボーダー</div>
```

### セマンティックカラー
```tsx
// 成功・エラー・警告のパターン
const Alert = ({ type, message }) => {
  const styles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  return (
    <div className={`p-4 rounded-md border ${styles[type]}`}>
      {message}
    </div>
  );
};

// ステータスインジケーター
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  アクティブ
</span>
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
  非アクティブ
</span>
```

## タイポグラフィ

### テキストサイズと太さ
```tsx
// サイズ階層
<h1 className="text-4xl font-bold">見出し1</h1>
<h2 className="text-3xl font-semibold">見出し2</h2>
<h3 className="text-2xl font-medium">見出し3</h3>
<p className="text-base">本文テキスト</p>
<small className="text-sm text-gray-500">補助テキスト</small>

// フォントウェイト
<p className="font-thin">極細</p>
<p className="font-light">細字</p>
<p className="font-normal">標準</p>
<p className="font-medium">中太</p>
<p className="font-semibold">やや太字</p>
<p className="font-bold">太字</p>
<p className="font-black">極太</p>
```

### テキスト装飾とスタイル
```tsx
// 整列
<p className="text-left">左寄せ</p>
<p className="text-center">中央寄せ</p>
<p className="text-right">右寄せ</p>
<p className="text-justify">両端揃え</p>

// 装飾
<p className="underline">下線</p>
<p className="line-through">取り消し線</p>
<p className="uppercase">大文字変換</p>
<p className="lowercase">小文字変換</p>
<p className="capitalize">頭文字大文字</p>

// 行間
<p className="leading-tight">狭い行間</p>
<p className="leading-normal">標準の行間</p>
<p className="leading-relaxed">広い行間</p>

// 文字間
<p className="tracking-tight">狭い文字間</p>
<p className="tracking-normal">標準の文字間</p>
<p className="tracking-wide">広い文字間</p>
```

## コンポーネントパターン

### ボタン
```tsx
// 基本ボタン
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
  ボタン
</button>

// ボタンバリエーション
const Button = ({ variant = 'primary', size = 'md', children, ...props }) => {
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`
        ${variants[variant]}
        ${sizes[size]}
        rounded-md font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      {...props}
    >
      {children}
    </button>
  );
};
```

### フォーム要素
```tsx
// 入力フィールド
<div className="space-y-4">
  <div>
    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
      メールアドレス
    </label>
    <input
      type="email"
      id="email"
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      placeholder="email@example.com"
    />
  </div>

  <div>
    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
      パスワード
    </label>
    <input
      type="password"
      id="password"
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
</div>

// セレクトボックス
<select className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                   focus:outline-none focus:ring-blue-500 focus:border-blue-500">
  <option>選択してください</option>
  <option value="1">オプション1</option>
  <option value="2">オプション2</option>
</select>

// チェックボックス
<div className="flex items-center">
  <input
    id="remember"
    type="checkbox"
    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
  />
  <label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
    ログイン状態を保持
  </label>
</div>
```

### カード
```tsx
// 基本カード
<div className="bg-white rounded-lg shadow-md overflow-hidden">
  <img src="/image.jpg" alt="" className="w-full h-48 object-cover" />
  <div className="p-6">
    <h3 className="text-lg font-semibold mb-2">カードタイトル</h3>
    <p className="text-gray-600">カードの説明文がここに入ります。</p>
  </div>
</div>

// ホバーエフェクト付きカード
<div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-300 cursor-pointer">
  <div className="p-6">
    <h3 className="text-xl font-bold mb-2">インタラクティブカード</h3>
    <p className="text-gray-600 mb-4">ホバーで影が大きくなります。</p>
    <a href="#" className="text-blue-500 hover:text-blue-600 font-medium">
      詳細を見る →
    </a>
  </div>
</div>
```

### モーダル
```tsx
// モーダルコンポーネント
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* オーバーレイ */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* モーダルコンテンツ */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};
```

## アニメーション

### トランジション
```tsx
// 基本的なトランジション
<button className="bg-blue-500 hover:bg-blue-600 transition-colors duration-200">
  色の変化
</button>

// 複数プロパティのトランジション
<div className="transform hover:scale-105 hover:shadow-lg transition-all duration-300">
  ホバーで拡大
</div>

// イージング関数
<div className="transition-transform duration-500 ease-in-out hover:translate-x-2">
  スムーズな移動
</div>
```

### アニメーションクラス
```tsx
// パルスアニメーション
<div className="animate-pulse bg-gray-200 h-4 w-3/4 rounded"></div>

// スピンアニメーション
<svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
  {/* ローディングアイコン */}
</svg>

// バウンスアニメーション
<div className="animate-bounce">
  ↓
</div>

// カスタムアニメーション
<style jsx>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out;
  }
`}</style>
```

## ダークモード

### ダークモード対応
```tsx
// 自動切り替え
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  ライト/ダークモード対応
</div>

// ダークモード専用スタイル
<button className="
  bg-blue-500 hover:bg-blue-600
  dark:bg-blue-600 dark:hover:bg-blue-700
  text-white
">
  ボタン
</button>

// カード（ダークモード対応）
<div className="
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  shadow-lg dark:shadow-none
  rounded-lg p-6
">
  <h3 className="text-gray-900 dark:text-gray-100">タイトル</h3>
  <p className="text-gray-600 dark:text-gray-400">説明文</p>
</div>
```

### ダークモードの実装
```tsx
// ダークモードトグル
const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700"
    >
      {isDark ? '🌙' : '☀️'}
    </button>
  );
};
```

## カスタムユーティリティ

### カスタムCSSクラス
```css
/* app/web/app.css */
@layer utilities {
  .text-shadow {
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  .glass-effect {
    @apply bg-white bg-opacity-80 backdrop-blur-md;
  }
}
```

### 再利用可能なコンポーネントクラス
```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded-md
           hover:bg-blue-600 focus:outline-none focus:ring-2
           focus:ring-blue-500 focus:ring-offset-2
           transition-colors duration-200;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md p-6
           dark:bg-gray-800 dark:shadow-none;
  }
  
  .input-field {
    @apply block w-full px-3 py-2 border border-gray-300
           rounded-md shadow-sm focus:outline-none
           focus:ring-blue-500 focus:border-blue-500
           dark:bg-gray-700 dark:border-gray-600;
  }
}
```

## パフォーマンス最適化

### PurgeCSS設定
```javascript
// Tailwind v4では自動的に未使用のCSSが削除される
// ビルド時に使用されているクラスのみが含まれる
```

### クラスの動的生成を避ける
```tsx
// ❌ 悪い例: 動的なクラス名（PurgeCSSで削除される可能性）
const getColorClass = (color) => `bg-${color}-500`;

// ✅ 良い例: 完全なクラス名を使用
const colorClasses = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
};
const getColorClass = (color) => colorClasses[color];
```

### クラス名の結合
```tsx
// clsxやclassnamesライブラリの使用
import clsx from 'clsx';

const Button = ({ isActive, isDisabled, className, ...props }) => {
  return (
    <button
      className={clsx(
        'px-4 py-2 rounded-md font-medium transition-colors',
        {
          'bg-blue-500 text-white': isActive,
          'bg-gray-200 text-gray-500': !isActive,
          'opacity-50 cursor-not-allowed': isDisabled,
        },
        className
      )}
      disabled={isDisabled}
      {...props}
    />
  );
};
```

## ベストプラクティス

### 1. ユーティリティファースト
```tsx
// ✅ Tailwindクラスを直接使用
<div className="max-w-sm mx-auto p-6 bg-white rounded-lg shadow-md">
  コンテンツ
</div>

// ❌ 不要なカスタムCSSを避ける
<div className="custom-card">
  コンテンツ
</div>
```

### 2. レスポンシブデザインの徹底
```tsx
// ✅ モバイルファーストで設計
<div className="text-sm md:text-base lg:text-lg">
  レスポンシブテキスト
</div>
```

### 3. 一貫性のあるスペーシング
```tsx
// ✅ Tailwindのスペーシングスケールを使用
<div className="p-4 m-2 space-y-4">
  <div className="mb-4">アイテム1</div>
  <div className="mb-4">アイテム2</div>
</div>
```

### 4. セマンティックな色の使用
```tsx
// ✅ 意味のある色を一貫して使用
const statusColors = {
  success: 'text-green-600 bg-green-50',
  error: 'text-red-600 bg-red-50',
  warning: 'text-yellow-600 bg-yellow-50',
  info: 'text-blue-600 bg-blue-50',
};
```

### 5. アクセシビリティの考慮
```tsx
// ✅ フォーカス状態を明示
<button className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
  ボタン
</button>

// ✅ 適切なコントラスト比
<p className="text-gray-900 dark:text-gray-100">
  読みやすいテキスト
</p>
```

## デバッグツール

### Tailwind CSS IntelliSense（VS Code拡張）
- クラス名の自動補完
- ホバーでCSSプレビュー
- 構文ハイライト

### ブラウザ開発者ツール
```javascript
// クラスの動的追加/削除でスタイルを確認
document.querySelector('.element').classList.add('bg-red-500');
document.querySelector('.element').classList.remove('bg-blue-500');
```

## まとめ

Tailwind CSSを効果的に使用するためのポイント：

1. **ユーティリティファースト**: カスタムCSSよりもユーティリティクラスを優先
2. **レスポンシブ設計**: モバイルファーストアプローチの徹底
3. **一貫性**: スペーシング、色、タイポグラフィの統一
4. **再利用性**: コンポーネント化による効率的な開発
5. **パフォーマンス**: 未使用CSSの自動削除
6. **アクセシビリティ**: フォーカス状態とコントラストの確保
7. **ダークモード**: システム設定に応じた自動切り替え

これらのパターンを活用することで、保守性が高く、一貫性のあるUIを効率的に構築できます。