# レイアウトシステムとグリッド設計

## 📋 目次
1. [レイアウトの基本原則](#レイアウトの基本原則)
2. [グリッドシステム](#グリッドシステム)
3. [レスポンシブデザイン](#レスポンシブデザイン)
4. [Flexboxパターン](#flexboxパターン)
5. [Gridパターン](#gridパターン)
6. [一般的なレイアウトパターン](#一般的なレイアウトパターン)
7. [スペーシングシステム](#スペーシングシステム)
8. [実装例](#実装例)

## レイアウトの基本原則

### 1. モバイルファースト
- 最小画面サイズから設計を開始
- プログレッシブエンハンスメント
- タッチ操作を前提とした設計

### 2. 8pxグリッド
- 全てのスペーシングは8の倍数
- 一貫性のある視覚的リズム
- 計算しやすい数値体系

### 3. コンテンツ中心設計
- コンテンツに適したレイアウト選択
- 読みやすさを最優先
- 適切な行長（45-75文字）

### 4. 流動的レイアウト
- 固定幅より相対単位を優先
- フレキシブルな要素配置
- ビューポートに応じた調整

## グリッドシステム

### 12カラムグリッド

```css
/* 基本グリッド設定 */
.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;  /* 16px */
  padding-right: 1rem; /* 16px */
}

/* ブレークポイント別の最大幅 */
@media (min-width: 640px) {  /* sm */
  .container { max-width: 640px; }
}

@media (min-width: 768px) {  /* md */
  .container { max-width: 768px; }
}

@media (min-width: 1024px) { /* lg */
  .container { max-width: 1024px; }
}

@media (min-width: 1280px) { /* xl */
  .container { max-width: 1280px; }
}

@media (min-width: 1536px) { /* 2xl */
  .container { max-width: 1536px; }
}
```

### Tailwind CSSグリッドクラス

```tsx
// 12カラムグリッド
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-8">メインコンテンツ</div>
  <div className="col-span-12 md:col-span-4">サイドバー</div>
</div>

// 自動フィットグリッド
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  <Card />
  <Card />
  <Card />
  <Card />
</div>

// 固定カラムグリッド
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  <div>カラム1</div>
  <div>カラム2</div>
  <div>カラム3</div>
</div>
```

## レスポンシブデザイン

### ブレークポイント

```tsx
// Tailwind CSS v4 ブレークポイント
const breakpoints = {
  'sm':  '640px',   // スマートフォン（横向き）
  'md':  '768px',   // タブレット（縦向き）
  'lg':  '1024px',  // タブレット（横向き）/ 小型デスクトップ
  'xl':  '1280px',  // デスクトップ
  '2xl': '1536px',  // 大型デスクトップ
};

// 使用例
<div className="
  px-4      // モバイル: 16px
  sm:px-6   // 640px以上: 24px
  lg:px-8   // 1024px以上: 32px
">
  レスポンシブパディング
</div>
```

### レスポンシブユーティリティ

```tsx
// 表示/非表示の制御
<div className="block md:hidden">モバイルのみ表示</div>
<div className="hidden md:block">デスクトップのみ表示</div>

// レスポンシブフォントサイズ
<h1 className="text-2xl sm:text-3xl lg:text-4xl">
  レスポンシブタイトル
</h1>

// レスポンシブグリッド
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* モバイル: 1列, タブレット: 2列, デスクトップ: 3列 */}
</div>

// レスポンシブフレックス方向
<div className="flex flex-col md:flex-row gap-4">
  {/* モバイル: 縦並び, デスクトップ: 横並び */}
</div>
```

## Flexboxパターン

### 基本的なFlexレイアウト

```tsx
// 水平中央揃え
<div className="flex justify-center">
  <button>中央のボタン</button>
</div>

// 垂直中央揃え
<div className="flex items-center min-h-screen">
  <div>垂直中央のコンテンツ</div>
</div>

// 水平・垂直中央揃え
<div className="flex items-center justify-center min-h-screen">
  <div>完全中央のコンテンツ</div>
</div>

// 両端揃え
<div className="flex justify-between items-center">
  <span>左側</span>
  <span>右側</span>
</div>

// 等間隔配置
<div className="flex justify-evenly">
  <button>ボタン1</button>
  <button>ボタン2</button>
  <button>ボタン3</button>
</div>
```

### 高度なFlexパターン

```tsx
// サイドバー付きレイアウト
<div className="flex min-h-screen">
  <aside className="w-64 flex-shrink-0 bg-gray-100">
    サイドバー（固定幅）
  </aside>
  <main className="flex-1 p-6">
    メインコンテンツ（可変幅）
  </main>
</div>

// ヘッダー・フッター固定レイアウト
<div className="flex flex-col min-h-screen">
  <header className="flex-shrink-0 h-16 bg-white shadow">
    ヘッダー
  </header>
  <main className="flex-1 overflow-auto">
    スクロール可能なメインコンテンツ
  </main>
  <footer className="flex-shrink-0 h-16 bg-gray-100">
    フッター
  </footer>
</div>

// カード内の要素配置
<div className="flex flex-col h-full">
  <div className="flex-shrink-0">
    <img src="/image.jpg" className="w-full h-48 object-cover" />
  </div>
  <div className="flex-1 p-4">
    <h3>タイトル</h3>
    <p>説明文</p>
  </div>
  <div className="flex-shrink-0 p-4 border-t">
    <button>アクション</button>
  </div>
</div>
```

## Gridパターン

### 基本的なGridレイアウト

```tsx
// 2カラムレイアウト
<div className="grid grid-cols-2 gap-4">
  <div>左カラム</div>
  <div>右カラム</div>
</div>

// 自動配置グリッド
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6">
  {items.map(item => (
    <Card key={item.id} {...item} />
  ))}
</div>

// 非対称グリッド
<div className="grid grid-cols-3 gap-4">
  <div className="col-span-2">大きいエリア</div>
  <div>小さいエリア</div>
  <div>小さいエリア</div>
  <div className="col-span-2">大きいエリア</div>
</div>
```

### 高度なGridパターン

```tsx
// ダッシュボードレイアウト
<div className="grid grid-cols-12 gap-6">
  {/* 統計カード */}
  <div className="col-span-12 lg:col-span-3">
    <StatCard />
  </div>
  <div className="col-span-12 lg:col-span-3">
    <StatCard />
  </div>
  <div className="col-span-12 lg:col-span-3">
    <StatCard />
  </div>
  <div className="col-span-12 lg:col-span-3">
    <StatCard />
  </div>
  
  {/* チャート */}
  <div className="col-span-12 lg:col-span-8">
    <ChartCard />
  </div>
  
  {/* アクティビティ */}
  <div className="col-span-12 lg:col-span-4">
    <ActivityCard />
  </div>
  
  {/* テーブル */}
  <div className="col-span-12">
    <TableCard />
  </div>
</div>

// メディアグリッド
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
  {images.map(image => (
    <div key={image.id} className="aspect-square">
      <img 
        src={image.url} 
        className="w-full h-full object-cover rounded-lg"
      />
    </div>
  ))}
</div>

// フォームレイアウト
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <FormField label="名前" name="firstName" />
  <FormField label="姓" name="lastName" />
  <FormField label="メール" name="email" className="md:col-span-2" />
  <FormField label="電話番号" name="phone" />
  <FormField label="郵便番号" name="zipCode" />
  <FormField label="住所" name="address" className="md:col-span-2" />
</div>
```

## 一般的なレイアウトパターン

### 1. ホーリーグレイルレイアウト

```tsx
// ヘッダー、フッター、サイドバー付きレイアウト
<div className="min-h-screen flex flex-col">
  {/* ヘッダー */}
  <header className="bg-white shadow-sm border-b">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
      <h1 className="text-xl font-semibold">サイトタイトル</h1>
    </div>
  </header>

  {/* メインコンテンツエリア */}
  <div className="flex-1 flex">
    {/* 左サイドバー */}
    <aside className="w-64 bg-gray-50 border-r hidden lg:block">
      <nav className="p-4">ナビゲーション</nav>
    </aside>

    {/* メインコンテンツ */}
    <main className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        コンテンツ
      </div>
    </main>

    {/* 右サイドバー（オプション） */}
    <aside className="w-80 bg-gray-50 border-l hidden xl:block">
      <div className="p-4">関連情報</div>
    </aside>
  </div>

  {/* フッター */}
  <footer className="bg-gray-100 border-t">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      フッター情報
    </div>
  </footer>
</div>
```

### 2. カードグリッドレイアウト

```tsx
// レスポンシブカードグリッド
<div className="container mx-auto px-4 py-8">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {cards.map(card => (
      <div key={card.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
        <img 
          src={card.image} 
          className="w-full h-48 object-cover rounded-t-lg"
        />
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
          <p className="text-gray-600 text-sm">{card.description}</p>
        </div>
      </div>
    ))}
  </div>
</div>
```

### 3. スプリットスクリーン

```tsx
// 50/50 スプリットレイアウト
<div className="min-h-screen flex flex-col lg:flex-row">
  {/* 左側: イメージ */}
  <div className="lg:w-1/2 bg-indigo-600 flex items-center justify-center p-12">
    <img src="/illustration.svg" className="max-w-md w-full" />
  </div>
  
  {/* 右側: コンテンツ */}
  <div className="lg:w-1/2 flex items-center justify-center p-12">
    <div className="max-w-md w-full">
      <h1 className="text-3xl font-bold mb-6">タイトル</h1>
      <p className="text-gray-600 mb-8">説明文</p>
      <Button variant="primary" size="lg">
        開始する
      </Button>
    </div>
  </div>
</div>
```

### 4. マガジンレイアウト

```tsx
// 記事レイアウト
<article className="max-w-4xl mx-auto px-4 py-12">
  {/* ヘッダー */}
  <header className="mb-8">
    <h1 className="text-4xl font-bold mb-4">記事タイトル</h1>
    <div className="flex items-center gap-4 text-gray-600">
      <span>著者名</span>
      <span>•</span>
      <time>2025年8月10日</time>
      <span>•</span>
      <span>5分で読める</span>
    </div>
  </header>

  {/* ヒーロー画像 */}
  <figure className="mb-12">
    <img 
      src="/hero.jpg" 
      className="w-full rounded-lg shadow-lg"
    />
    <figcaption className="mt-2 text-center text-sm text-gray-600">
      画像の説明
    </figcaption>
  </figure>

  {/* 本文 */}
  <div className="prose prose-lg max-w-none">
    <p className="lead text-xl text-gray-700 mb-8">
      リード文がここに入ります。
    </p>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {/* メインコンテンツ */}
        <p>本文...</p>
      </div>
      <aside className="lg:col-span-1">
        {/* サイドバー */}
        <div className="sticky top-8">
          <h3 className="font-semibold mb-4">関連記事</h3>
          {/* 関連記事リスト */}
        </div>
      </aside>
    </div>
  </div>
</article>
```

## スペーシングシステム

### スペーシングスケール

```tsx
// Tailwindスペーシングクラス
const spacing = {
  '0':   '0px',
  'px':  '1px',
  '0.5': '2px',
  '1':   '4px',
  '1.5': '6px',
  '2':   '8px',    // 基本単位
  '2.5': '10px',
  '3':   '12px',
  '3.5': '14px',
  '4':   '16px',   // よく使う
  '5':   '20px',
  '6':   '24px',   // よく使う
  '7':   '28px',
  '8':   '32px',   // よく使う
  '9':   '36px',
  '10':  '40px',
  '11':  '44px',
  '12':  '48px',   // よく使う
  '14':  '56px',
  '16':  '64px',   // よく使う
  '20':  '80px',
  '24':  '96px',
  '28':  '112px',
  '32':  '128px',
};
```

### スペーシング使用パターン

```tsx
// コンポーネント間のスペーシング
<div className="space-y-4">  {/* 縦方向に16pxの間隔 */}
  <Component1 />
  <Component2 />
  <Component3 />
</div>

// セクション間のスペーシング
<section className="py-12 md:py-16 lg:py-20">
  {/* レスポンシブな縦パディング */}
</section>

// カード内のスペーシング
<div className="p-6 space-y-4">
  <h3 className="text-lg font-semibold">タイトル</h3>
  <p className="text-gray-600">説明文</p>
  <div className="pt-4 border-t">
    <Button>アクション</Button>
  </div>
</div>

// フォーム要素のスペーシング
<form className="space-y-6">
  <div className="space-y-2">
    <label>ラベル</label>
    <input />
    <p className="text-sm text-gray-500">ヘルプテキスト</p>
  </div>
</form>
```

## 実装例

### 完全なページレイアウト例

```tsx
// pages/Dashboard.tsx
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">ダッシュボード</h1>
            <nav className="flex gap-4">
              <a href="#" className="text-gray-600 hover:text-gray-900">ホーム</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">設定</a>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="総ユーザー" value="1,234" change="+12%" />
          <StatCard title="アクティブ" value="456" change="+5%" />
          <StatCard title="収益" value="¥123,456" change="+8%" />
          <StatCard title="成長率" value="23%" change="+2%" />
        </div>

        {/* 2カラムレイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* メインエリア */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold">最近のアクティビティ</h2>
              </Card.Header>
              <Card.Body>
                <ActivityList />
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold">パフォーマンス</h2>
              </Card.Header>
              <Card.Body>
                <Chart />
              </Card.Body>
            </Card>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold">クイックアクション</h2>
              </Card.Header>
              <Card.Body className="space-y-3">
                <Button variant="primary" fullWidth>新規作成</Button>
                <Button variant="secondary" fullWidth>レポート表示</Button>
                <Button variant="ghost" fullWidth>設定</Button>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold">お知らせ</h2>
              </Card.Header>
              <Card.Body>
                <NotificationList />
              </Card.Body>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### レスポンシブテーブルレイアウト

```tsx
// スクロール可能なテーブル
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          名前
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          ステータス
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          日付
        </th>
        <th className="relative px-6 py-3">
          <span className="sr-only">編集</span>
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {data.map(item => (
        <tr key={item.id}>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {item.name}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <Badge variant={item.status === 'active' ? 'success' : 'default'}>
              {item.status}
            </Badge>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {item.date}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <a href="#" className="text-indigo-600 hover:text-indigo-900">
              編集
            </a>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

## 更新履歴

- 2025-08-10: 初版作成
- グリッドシステム定義
- レスポンシブパターン追加
- Flexbox/Gridレイアウト例
- 一般的なレイアウトパターン追加