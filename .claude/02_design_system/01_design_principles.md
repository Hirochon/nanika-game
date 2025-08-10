# デザイン原則とビジュアル言語

## 📋 目次
1. [デザイン原則](#デザイン原則)
2. [カラーシステム](#カラーシステム)
3. [タイポグラフィ](#タイポグラフィ)
4. [スペーシングシステム](#スペーシングシステム)
5. [エレベーションとシャドウ](#エレベーションとシャドウ)
6. [ボーダーとコーナー](#ボーダーとコーナー)
7. [アイコンガイドライン](#アイコンガイドライン)
8. [実装例](#実装例)

## デザイン原則

### 1. シンプルさと明瞭性（Simplicity & Clarity）
- 必要最小限の要素で最大の効果を
- 情報階層を明確に
- 認知負荷を最小限に

### 2. 一貫性（Consistency）
- 同じ機能には同じパターンを
- 予測可能なインタラクション
- 統一されたビジュアル言語

### 3. アクセシビリティ（Accessibility）
- WCAG 2.1 AA準拠
- キーボードナビゲーション対応
- スクリーンリーダー最適化

### 4. レスポンシブ（Responsive）
- モバイルファーストアプローチ
- 流動的なレイアウト
- タッチフレンドリーなUI

### 5. パフォーマンス（Performance）
- 高速な初期表示
- スムーズなアニメーション
- 最適化されたアセット

## カラーシステム

### プライマリカラー

```css
/* Indigo - ブランドカラー */
--color-primary-50:  #EEF2FF;  /* 背景色（最も薄い） */
--color-primary-100: #E0E7FF;
--color-primary-200: #C7D2FE;
--color-primary-300: #A5B4FC;
--color-primary-400: #818CF8;
--color-primary-500: #6366F1;  /* 補助的な使用 */
--color-primary-600: #4F46E5;  /* メインのブランドカラー */
--color-primary-700: #4338CA;  /* ホバー状態 */
--color-primary-800: #3730A3;
--color-primary-900: #312E81;  /* 最も濃い */
```

### グレースケール

```css
/* Gray - テキストと背景 */
--color-gray-50:  #F9FAFB;  /* 背景色 */
--color-gray-100: #F3F4F6;
--color-gray-200: #E5E7EB;
--color-gray-300: #D1D5DB;  /* ボーダー */
--color-gray-400: #9CA3AF;
--color-gray-500: #6B7280;  /* プレースホルダー */
--color-gray-600: #4B5563;  /* セカンダリテキスト */
--color-gray-700: #374151;
--color-gray-800: #1F2937;
--color-gray-900: #111827;  /* プライマリテキスト */
--color-gray-950: #030712;  /* ダークモード背景 */
```

### 状態色（Semantic Colors）

```css
/* Success - 成功状態 */
--color-success-50:  #F0FDF4;
--color-success-100: #DCFCE7;
--color-success-500: #22C55E;  /* メイン */
--color-success-600: #16A34A;  /* ホバー */
--color-success-700: #15803D;

/* Warning - 警告状態 */
--color-warning-50:  #FFFBEB;
--color-warning-100: #FEF3C7;
--color-warning-500: #F59E0B;  /* メイン */
--color-warning-600: #D97706;  /* ホバー */
--color-warning-700: #B45309;

/* Danger/Error - エラー状態 */
--color-danger-50:  #FEF2F2;
--color-danger-100: #FEE2E2;
--color-danger-500: #EF4444;  /* メイン */
--color-danger-600: #DC2626;  /* ホバー */
--color-danger-700: #B91C1C;

/* Info - 情報 */
--color-info-50:  #EFF6FF;
--color-info-100: #DBEAFE;
--color-info-500: #3B82F6;  /* メイン */
--color-info-600: #2563EB;  /* ホバー */
--color-info-700: #1D4ED8;
```

### カラー使用ガイドライン

```tsx
// プライマリアクション
<button className="bg-indigo-600 hover:bg-indigo-700 text-white">
  メインアクション
</button>

// セカンダリアクション
<button className="bg-gray-200 hover:bg-gray-300 text-gray-900">
  サブアクション
</button>

// 成功メッセージ
<div className="bg-green-50 border border-green-200 text-green-800">
  操作が成功しました
</div>

// エラーメッセージ
<div className="bg-red-50 border border-red-200 text-red-800">
  エラーが発生しました
</div>
```

## タイポグラフィ

### フォントファミリー

```css
/* システムフォントスタック */
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif,
             "Apple Color Emoji", "Segoe UI Emoji",
             "Segoe UI Symbol", "Noto Color Emoji";

--font-mono: ui-monospace, SFMono-Regular, "SF Mono",
             Consolas, "Liberation Mono", Menlo, monospace;
```

### フォントサイズ

```css
/* テキストサイズスケール */
--text-xs:   0.75rem;  /* 12px - 補足情報 */
--text-sm:   0.875rem; /* 14px - キャプション、ラベル */
--text-base: 1rem;     /* 16px - 本文 */
--text-lg:   1.125rem; /* 18px - リード文 */
--text-xl:   1.25rem;  /* 20px - 小見出し */
--text-2xl:  1.5rem;   /* 24px - セクション見出し */
--text-3xl:  1.875rem; /* 30px - ページタイトル */
--text-4xl:  2.25rem;  /* 36px - 大見出し */
--text-5xl:  3rem;     /* 48px - ヒーロータイトル */
```

### フォントウェイト

```css
--font-normal:   400;  /* 通常テキスト */
--font-medium:   500;  /* 強調テキスト */
--font-semibold: 600;  /* 見出し */
--font-bold:     700;  /* 重要な見出し */
--font-extrabold: 800; /* 特別な強調 */
```

### 行間（Line Height）

```css
--leading-none:    1;     /* タイトル */
--leading-tight:   1.25;  /* 見出し */
--leading-snug:    1.375; /* サブ見出し */
--leading-normal:  1.5;   /* 本文（デフォルト） */
--leading-relaxed: 1.625; /* 読みやすい本文 */
--leading-loose:   2;     /* 広めの行間 */
```

### タイポグラフィ実装例

```tsx
// ページタイトル
<h1 className="text-3xl font-bold text-gray-900 leading-tight">
  ダッシュボード
</h1>

// セクション見出し
<h2 className="text-2xl font-semibold text-gray-900 leading-snug">
  最近のアクティビティ
</h2>

// 本文
<p className="text-base text-gray-600 leading-normal">
  ここに説明文が入ります。適切な行間で読みやすく表示されます。
</p>

// キャプション
<span className="text-sm text-gray-500">
  最終更新: 2025年8月10日
</span>

// コード
<code className="font-mono text-sm bg-gray-100 px-1 py-0.5 rounded">
  npm run dev
</code>
```

## スペーシングシステム

### 8pxグリッドベース

```css
/* スペーシングスケール */
--space-0:   0;       /* 0px */
--space-1:   0.25rem; /* 4px */
--space-2:   0.5rem;  /* 8px - 基本単位 */
--space-3:   0.75rem; /* 12px */
--space-4:   1rem;    /* 16px */
--space-5:   1.25rem; /* 20px */
--space-6:   1.5rem;  /* 24px */
--space-8:   2rem;    /* 32px */
--space-10:  2.5rem;  /* 40px */
--space-12:  3rem;    /* 48px */
--space-16:  4rem;    /* 64px */
--space-20:  5rem;    /* 80px */
--space-24:  6rem;    /* 96px */
```

### スペーシング使用例

```tsx
// パディング
<div className="p-4">      {/* 16px全方向 */}
<div className="px-6 py-4"> {/* 横24px、縦16px */}
<div className="pt-8 pb-4"> {/* 上32px、下16px */}

// マージン
<div className="m-4">       {/* 16px全方向 */}
<div className="mt-6 mb-4"> {/* 上24px、下16px */}
<div className="mx-auto">   {/* 横方向中央揃え */}

// ギャップ（Flexbox/Grid）
<div className="flex gap-4">     {/* 要素間16px */}
<div className="grid gap-x-4 gap-y-6"> {/* 横16px、縦24px */}
```

## エレベーションとシャドウ

### シャドウレベル

```css
/* エレベーションスケール */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-base: 0 1px 3px 0 rgb(0 0 0 / 0.1),
               0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
             0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
             0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1),
             0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
```

### 使用ガイドライン

```tsx
// カード（浮いている要素）
<div className="bg-white shadow-md rounded-lg p-6">
  カードコンテンツ
</div>

// モーダル（最前面）
<div className="bg-white shadow-2xl rounded-lg">
  モーダルコンテンツ
</div>

// ホバー時のエレベーション変化
<button className="shadow-sm hover:shadow-md transition-shadow">
  ホバーで浮き上がる
</button>
```

## ボーダーとコーナー

### ボーダー幅

```css
--border-0: 0;
--border: 1px;     /* デフォルト */
--border-2: 2px;
--border-4: 4px;
--border-8: 8px;
```

### 角丸（Border Radius）

```css
--rounded-none: 0;
--rounded-sm: 0.125rem;  /* 2px */
--rounded: 0.25rem;      /* 4px - デフォルト */
--rounded-md: 0.375rem;  /* 6px */
--rounded-lg: 0.5rem;    /* 8px */
--rounded-xl: 0.75rem;   /* 12px */
--rounded-2xl: 1rem;     /* 16px */
--rounded-3xl: 1.5rem;   /* 24px */
--rounded-full: 9999px;  /* 完全な円 */
```

### 実装例

```tsx
// 標準的なボーダー
<div className="border border-gray-300 rounded-md p-4">
  ボーダー付きボックス
</div>

// フォーカス時のボーダー
<input className="border border-gray-300 focus:border-indigo-500 rounded-md" />

// 円形アバター
<img className="w-10 h-10 rounded-full border-2 border-white" />
```

## アイコンガイドライン

### サイズ規約

```tsx
// アイコンサイズ
const ICON_SIZES = {
  xs: 'w-3 h-3',   // 12px
  sm: 'w-4 h-4',   // 16px
  md: 'w-5 h-5',   // 20px - デフォルト
  lg: 'w-6 h-6',   // 24px
  xl: 'w-8 h-8',   // 32px
};

// 使用例
<IconComponent className="w-5 h-5 text-gray-500" />
```

### アイコンとテキストの組み合わせ

```tsx
// ボタン内のアイコン
<button className="flex items-center gap-2">
  <SaveIcon className="w-4 h-4" />
  <span>保存</span>
</button>

// ラベル付きアイコン
<div className="flex items-center gap-1 text-sm text-gray-600">
  <ClockIcon className="w-4 h-4" />
  <span>5分前</span>
</div>
```

## 実装例

### 完全なコンポーネント例

```tsx
// プライマリボタン
<button className="
  px-4 py-2
  bg-indigo-600 hover:bg-indigo-700
  text-white font-medium text-sm
  rounded-md
  shadow-sm hover:shadow-md
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
">
  確認する
</button>

// フォームフィールド
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    メールアドレス
  </label>
  <input
    type="email"
    className="
      w-full px-3 py-2
      border border-gray-300 rounded-md
      text-gray-900 placeholder-gray-500
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
      transition-colors duration-200
    "
    placeholder="email@example.com"
  />
  <p className="text-xs text-gray-500">
    ログインに使用するメールアドレスを入力してください
  </p>
</div>

// カードコンポーネント
<div className="
  bg-white rounded-lg shadow-md
  hover:shadow-lg transition-shadow duration-300
  overflow-hidden
">
  <div className="p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      カードタイトル
    </h3>
    <p className="text-gray-600 leading-relaxed">
      カードの説明文がここに入ります。
    </p>
  </div>
  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
    <button className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
      詳細を見る →
    </button>
  </div>
</div>
```

## ダークモード対応

```tsx
// ダークモード対応のカラー定義
<div className="
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-gray-700
">
  <h2 className="text-gray-900 dark:text-white">
    ダークモード対応タイトル
  </h2>
  <p className="text-gray-600 dark:text-gray-400">
    ダークモード対応の本文
  </p>
</div>
```

## 更新履歴

- 2025-08-10: 初版作成
- カラーシステムの定義
- タイポグラフィシステムの確立
- スペーシンググリッドの設定
- 実装例の追加