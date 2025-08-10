# Nanika Game デザインシステム概要

## 📋 目次
1. [デザインシステムとは](#デザインシステムとは)
2. [クイックスタート](#クイックスタート)
3. [基本構成要素](#基本構成要素)
4. [開発ワークフロー](#開発ワークフロー)
5. [ツールとテクノロジー](#ツールとテクノロジー)
6. [ベストプラクティス](#ベストプラクティス)

## デザインシステムとは

Nanika Gameのデザインシステムは、一貫性のあるユーザー体験を提供するための包括的なガイドラインです。コンポーネント、パターン、原則を定義し、効率的な開発を支援します。

### 主要な目的
- **一貫性**: 全ての画面で統一されたUI/UX
- **効率性**: 再利用可能なコンポーネントによる開発速度向上
- **保守性**: 標準化されたパターンによるメンテナンスの容易さ
- **アクセシビリティ**: WCAG 2.1 AA準拠の実装

## クイックスタート

### 1. 基本的なコンポーネント利用

```tsx
// ボタンコンポーネントの利用例
<button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium">
  クリック
</button>

// フォーム入力フィールドの利用例
<input
  type="text"
  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
  placeholder="テキストを入力"
/>
```

### 2. レイアウトの基本構造

```tsx
// 基本的なページレイアウト
<div className="min-h-screen bg-gray-50">
  <header className="bg-white shadow">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* ヘッダーコンテンツ */}
    </div>
  </header>
  
  <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    {/* メインコンテンツ */}
  </main>
</div>
```

### 3. カラーパレットの利用

```css
/* 主要カラー */
--primary: indigo-600    /* #4F46E5 */
--primary-hover: indigo-700  /* #4338CA */
--success: green-500     /* #10B981 */
--warning: yellow-500    /* #F59E0B */
--danger: red-500        /* #EF4444 */
--gray-base: gray-50     /* #F9FAFB */
--text-primary: gray-900 /* #111827 */
--text-secondary: gray-600 /* #4B5563 */
```

## 基本構成要素

### 1. デザイントークン
- **カラー**: プライマリ、セカンダリ、状態色
- **タイポグラフィ**: フォントファミリー、サイズ、ウェイト
- **スペーシング**: 8pxグリッドシステム
- **シャドウ**: エレベーションレベル
- **ボーダー**: 半径、幅、スタイル

### 2. コンポーネント階層

```
基礎コンポーネント（Atoms）
├── Button
├── Input
├── Label
├── Icon
└── Typography

複合コンポーネント（Molecules）
├── FormField
├── Card
├── Alert
├── Modal
└── Navigation

テンプレート（Templates）
├── AuthLayout
├── DashboardLayout
├── FormLayout
└── ListLayout
```

### 3. レスポンシブデザイン

```tsx
// Tailwindのレスポンシブプレフィックス
// sm: 640px以上
// md: 768px以上
// lg: 1024px以上
// xl: 1280px以上
// 2xl: 1536px以上

<div className="px-4 sm:px-6 lg:px-8">
  {/* モバイルファーストのアプローチ */}
</div>
```

## 開発ワークフロー

### 1. コンポーネント作成プロセス

```bash
1. デザイン要件の確認
   - UI/UX要件の理解
   - アクセシビリティ要件の確認

2. コンポーネント設計
   - Props定義
   - 状態管理の設計
   - バリアント定義

3. 実装
   - TypeScriptでの型定義
   - Tailwind CSSでのスタイリング
   - アクセシビリティ属性の追加

4. テスト
   - ユニットテスト作成
   - アクセシビリティテスト
   - ビジュアルテスト

5. ドキュメント化
   - 使用例の作成
   - Props説明の記載
```

### 2. スタイリングガイドライン

```tsx
// 推奨: Tailwind CSSユーティリティクラス
<button className="bg-indigo-600 text-white px-4 py-2 rounded-md">
  ボタン
</button>

// 複雑なスタイルの場合: clsx/cnを使用
import { cn } from '~/utils/cn';

const buttonClasses = cn(
  'px-4 py-2 rounded-md font-medium',
  'bg-indigo-600 text-white',
  'hover:bg-indigo-700',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);
```

## ツールとテクノロジー

### 使用技術スタック
- **フレームワーク**: React 18+ with React Router v7
- **スタイリング**: Tailwind CSS v4
- **型定義**: TypeScript 5+
- **テスト**: Vitest + React Testing Library
- **アクセシビリティ**: axe-core

### 開発ツール
```bash
# フォーマット
npm run format

# リント
npm run lint

# 型チェック
npm run typecheck

# テスト実行
npm run test
```

## ベストプラクティス

### 1. アクセシビリティ

```tsx
// 適切なARIA属性の使用
<button
  aria-label="メニューを開く"
  aria-expanded={isOpen}
  aria-controls="menu-items"
>
  <MenuIcon />
</button>

// フォームのラベル付け
<label htmlFor="email" className="block text-sm font-medium">
  メールアドレス
</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
```

### 2. パフォーマンス

```tsx
// 画像の最適化
<img
  src="/images/hero.jpg"
  alt="ヒーロー画像"
  loading="lazy"
  decoding="async"
  className="w-full h-auto"
/>

// 条件付きレンダリング
{isVisible && <ExpensiveComponent />}

// メモ化の活用
const MemoizedComponent = memo(Component);
```

### 3. 一貫性の維持

```tsx
// 定数の利用
const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
} as const;

// 共通コンポーネントの利用
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
```

### 4. エラーハンドリング

```tsx
// エラー境界の実装
<ErrorBoundary fallback={<ErrorFallback />}>
  <Component />
</ErrorBoundary>

// フォームエラーの表示
{errors.email && (
  <p id="email-error" className="mt-1 text-sm text-red-600">
    {errors.email}
  </p>
)}
```

## 次のステップ

1. **[デザイン原則](./01_design_principles.md)** - カラーシステム、タイポグラフィの詳細
2. **[コンポーネント設計](./02_component_design.md)** - UIコンポーネントの詳細仕様
3. **[レイアウトシステム](./02_layout_system.md)** - グリッドとレイアウトパターン
4. **[アニメーションシステム](./03_animation_system.md)** - モーションとトランジション

## 更新履歴

- 2025-08-10: 初版作成
- 基本的なデザインシステム構造を定義
- Tailwind CSS v4対応
- React Router v7のパターンを統合