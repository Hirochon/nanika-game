# アニメーションシステムとモーション設計

## 📋 目次
1. [アニメーション原則](#アニメーション原則)
2. [トランジション設定](#トランジション設定)
3. [基本アニメーション](#基本アニメーション)
4. [インタラクションアニメーション](#インタラクションアニメーション)
5. [ページトランジション](#ページトランジション)
6. [ローディングアニメーション](#ローディングアニメーション)
7. [マイクロインタラクション](#マイクロインタラクション)
8. [パフォーマンス最適化](#パフォーマンス最適化)
9. [実装例](#実装例)

## アニメーション原則

### 1. 目的を持ったモーション
- ユーザーの注意を適切に誘導
- 状態変化を明確に伝える
- 空間的な関係性を示す
- ブランドの個性を表現

### 2. 自然な動き
- 物理法則に基づいたイージング
- 適切な持続時間（200-400ms）
- 過度な演出を避ける
- 一貫性のあるタイミング

### 3. パフォーマンス優先
- GPU加速可能なプロパティを使用
- `transform`と`opacity`を優先
- `will-change`の適切な使用
- 60fpsの維持

### 4. アクセシビリティ
- `prefers-reduced-motion`への対応
- フォーカス状態の明確化
- キーボード操作との調和
- 適切なフィードバック

## トランジション設定

### 持続時間（Duration）

```css
/* Tailwind CSS Duration クラス */
--duration-75:  75ms;   /* 極小アニメーション */
--duration-100: 100ms;  /* 小さなアニメーション */
--duration-150: 150ms;  /* クイックフィードバック */
--duration-200: 200ms;  /* 標準（推奨） */
--duration-300: 300ms;  /* ゆったり */
--duration-500: 500ms;  /* スライド、展開 */
--duration-700: 700ms;  /* 複雑な変形 */
--duration-1000: 1000ms; /* ページ遷移 */
```

### イージング関数（Timing Functions）

```css
/* 標準的なイージング */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* カスタムイージング */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-snappy: cubic-bezier(0.4, 0, 0.6, 1);
```

### Tailwindトランジションクラス

```tsx
// 基本トランジション
<button className="transition-colors duration-200 ease-in-out">
  ホバーで色が変わる
</button>

// 複数プロパティ
<div className="transition-all duration-300 ease-out">
  全プロパティがアニメーション
</div>

// 特定プロパティ
<div className="transition-transform duration-200">
  transformのみアニメーション
</div>

// 遅延付き
<div className="transition delay-100 duration-300">
  100ms遅れてアニメーション開始
</div>
```

## 基本アニメーション

### フェードイン/アウト

```tsx
// フェードイン
const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  return (
    <div 
      className="animate-fadeIn"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// CSS定義
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fadeIn {
  animation: fadeIn 300ms ease-out forwards;
}

// 使用例
<FadeIn delay={100}>
  <Card>コンテンツ</Card>
</FadeIn>
```

### スライドイン

```tsx
// スライドインコンポーネント
const SlideIn = ({ 
  children, 
  direction = 'left',
  duration = 300 
}: {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  duration?: number;
}) => {
  const transforms = {
    left: 'translateX(-100%)',
    right: 'translateX(100%)',
    up: 'translateY(-100%)',
    down: 'translateY(100%)',
  };

  return (
    <div 
      className="animate-slideIn"
      style={{
        '--slide-from': transforms[direction],
        '--slide-duration': `${duration}ms`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

// CSS
@keyframes slideIn {
  from {
    transform: var(--slide-from);
    opacity: 0;
  }
  to {
    transform: translateX(0) translateY(0);
    opacity: 1;
  }
}

.animate-slideIn {
  animation: slideIn var(--slide-duration) ease-out forwards;
}
```

### スケールアニメーション

```tsx
// ポップアップ効果
<div className="transform transition-transform duration-200 hover:scale-105">
  ホバーで拡大
</div>

// クリック時の縮小効果
<button className="active:scale-95 transition-transform duration-100">
  クリックで縮小
</button>

// ズームイン効果
@keyframes zoomIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-zoomIn {
  animation: zoomIn 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 回転アニメーション

```tsx
// ローディングスピナー
<div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />

// カスタム回転
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-rotate {
  animation: rotate 1s linear infinite;
}

// 3D回転
.rotate-y {
  transform-style: preserve-3d;
  transition: transform 600ms;
}

.rotate-y:hover {
  transform: rotateY(180deg);
}
```

## インタラクションアニメーション

### ホバー効果

```tsx
// ボタンホバー
<button className="
  bg-indigo-600 text-white px-4 py-2 rounded-md
  transition-all duration-200
  hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5
">
  ホバーで浮き上がる
</button>

// カードホバー
<div className="
  bg-white rounded-lg shadow-md p-6
  transition-all duration-300
  hover:shadow-xl hover:scale-[1.02]
  cursor-pointer
">
  <h3>カードタイトル</h3>
  <p>ホバーで拡大・影が濃くなる</p>
</div>

// リンクホバー
<a className="
  text-indigo-600 
  relative inline-block
  after:content-[''] after:absolute after:left-0 after:bottom-0
  after:w-0 after:h-0.5 after:bg-indigo-600
  after:transition-all after:duration-300
  hover:after:w-full
">
  下線がアニメーション
</a>
```

### クリックフィードバック

```tsx
// リップルエフェクト
const RippleButton = ({ children, ...props }) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples([...ripples, { x, y, id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  };

  return (
    <button 
      className="relative overflow-hidden px-4 py-2 bg-indigo-600 text-white rounded-md"
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white opacity-30 animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </button>
  );
};

// CSS for ripple
@keyframes ripple {
  from {
    width: 0;
    height: 0;
  }
  to {
    width: 300px;
    height: 300px;
    opacity: 0;
  }
}

.animate-ripple {
  animation: ripple 600ms ease-out;
}
```

### フォーカスアニメーション

```tsx
// フォーカスリング
<input className="
  px-3 py-2 border border-gray-300 rounded-md
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
  focus:scale-[1.02]
" />

// フォーカストラップアニメーション
.focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-offset 0.2s ease;
}

.focus-visible:focus {
  outline-color: #4F46E5;
  outline-offset: 4px;
}
```

## ページトランジション

### フェードトランジション

```tsx
// React Router v7 with View Transitions API
import { useViewTransitionState } from 'react-router';

function PageTransition({ children }: { children: React.ReactNode }) {
  const isTransitioning = useViewTransitionState();
  
  return (
    <div className={cn(
      'transition-opacity duration-300',
      isTransitioning ? 'opacity-0' : 'opacity-100'
    )}>
      {children}
    </div>
  );
}
```

### スライドトランジション

```tsx
// ページ間スライド
const SlideTransition = ({ children, direction = 'left' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={cn(
      'transition-transform duration-500 ease-out',
      isVisible ? 'translate-x-0' : direction === 'left' ? '-translate-x-full' : 'translate-x-full'
    )}>
      {children}
    </div>
  );
};
```

## ローディングアニメーション

### スピナー

```tsx
// 基本スピナー
<div className="flex items-center justify-center p-4">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
</div>

// ドットローダー
<div className="flex space-x-2">
  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
</div>

// プログレスバー
<div className="w-full bg-gray-200 rounded-full h-2">
  <div 
    className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
    style={{ width: `${progress}%` }}
  />
</div>
```

### スケルトンスクリーン

```tsx
// スケルトンローダー
const Skeleton = ({ className }: { className?: string }) => {
  return (
    <div className={cn(
      'animate-pulse bg-gray-200 rounded',
      className
    )} />
  );
};

// 使用例
<div className="space-y-4">
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
  <Skeleton className="h-20 w-full" />
</div>

// シマーエフェクト
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

## マイクロインタラクション

### トグルスイッチ

```tsx
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
};
```

### ツールチップ

```tsx
// ツールチップアニメーション
.tooltip {
  opacity: 0;
  transform: translateY(4px);
  transition: all 200ms ease-out;
  pointer-events: none;
}

.tooltip-trigger:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

// 使用例
<div className="relative tooltip-trigger">
  <button>ホバーしてください</button>
  <div className="tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-sm rounded">
    ツールチップテキスト
  </div>
</div>
```

### アコーディオン

```tsx
const Accordion = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
      >
        <span>{title}</span>
        <ChevronIcon 
          className={cn(
            'w-5 h-5 transition-transform duration-200',
            isOpen ? 'rotate-180' : ''
          )}
        />
      </button>
      <div 
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-96' : 'max-h-0'
        )}
      >
        <div className="px-4 py-3 border-t border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
};
```

## パフォーマンス最適化

### GPU加速の活用

```css
/* GPU加速を使用する */
.gpu-accelerated {
  transform: translateZ(0); /* または translate3d(0,0,0) */
  will-change: transform, opacity; /* 変更予定のプロパティを指定 */
}

/* アニメーション終了後にwill-changeを削除 */
.animation-done {
  will-change: auto;
}
```

### アニメーションの最適化

```tsx
// requestAnimationFrameの使用
const smoothScroll = (targetY: number, duration: number) => {
  const startY = window.scrollY;
  const startTime = performance.now();

  const scroll = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
    
    window.scrollTo(0, startY + (targetY - startY) * easeProgress);

    if (progress < 1) {
      requestAnimationFrame(scroll);
    }
  };

  requestAnimationFrame(scroll);
};
```

### Reduced Motion対応

```css
/* アニメーションを減らす設定への対応 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Tailwindでの対応 */
<div className="transition-transform motion-reduce:transition-none">
  アクセシビリティ対応アニメーション
</div>
```

## 実装例

### 完全なアニメーションコンポーネント

```tsx
// AnimatedCard.tsx
interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  delay = 0,
  className 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={cardRef}
      className={cn(
        'bg-white rounded-lg shadow-md p-6',
        'transform transition-all duration-500',
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4',
        'hover:shadow-xl hover:scale-[1.02]',
        'motion-reduce:transition-none',
        className
      )}
    >
      {children}
    </div>
  );
};

// 使用例
<div className="grid grid-cols-3 gap-6">
  {items.map((item, index) => (
    <AnimatedCard key={item.id} delay={index * 100}>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </AnimatedCard>
  ))}
</div>
```

### ページ遷移アニメーション

```tsx
// PageTransition.tsx
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('fadeIn');

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('fadeOut');
    }
  }, [location, displayLocation]);

  return (
    <div
      className={cn(
        'transition-opacity duration-300',
        transitionStage === 'fadeIn' ? 'opacity-100' : 'opacity-0'
      )}
      onAnimationEnd={() => {
        if (transitionStage === 'fadeOut') {
          setTransitionStage('fadeIn');
          setDisplayLocation(location);
        }
      }}
    >
      {children}
    </div>
  );
};
```

## 更新履歴

- 2025-08-10: 初版作成
- アニメーション原則の定義
- 基本アニメーションパターン追加
- インタラクションアニメーション実装
- パフォーマンス最適化ガイドライン追加
- アクセシビリティ対応追加