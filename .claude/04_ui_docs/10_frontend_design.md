# フロントエンド設計

## 目的と概要

このドキュメントは、Nanika Gameプロジェクトのフロントエンドアーキテクチャとコンポーネント設計について詳述します。React Router v7とTailwind CSSを活用し、ゲームアプリケーションに最適化された再利用可能で保守しやすいUI システムと、優れたユーザーエクスペリエンスを提供するフロントエンド設計を定義します。

## 現在の実装状況

- **React Router v7**: 最新のフルスタック React フレームワーク対応
- **Tailwind CSS**: ユーティリティファースト CSS による迅速な UI 開発
- **TypeScript**: 完全な型安全性とIntelliSense サポート
- **基本コンポーネント**: ログイン、登録、ダッシュボード画面の実装済み
- **カスタムフック**: useAuth フックによる認証状態管理
- **レスポンシブデザイン**: モバイルファーストアプローチ実装済み

## アーキテクチャ原則

### 1. コンポーネント設計原則

**単一責任原則（SRP）:**
- 各コンポーネントは明確で単一の責任を持つ
- ビジネスロジックとプレゼンテーションを分離
- 再利用可能性を重視した設計

**組み合わせ優先（Composition over Inheritance）:**
- コンポーネントの拡張は継承ではなく組み合わせで実現
- Higher-Order Components や Render Props よりも Hooks を優先
- 複合コンポーネントパターンの活用

**型安全性:**
- すべてのProps、State、イベントハンドラーに型定義
- 厳密な TypeScript 設定による安全性確保
- ジェネリック型の活用で再利用性向上

### 2. レイヤー構造

```
app/web/
├── components/           # 再利用可能UIコンポーネント
│   ├── ui/              # プリミティブUIコンポーネント
│   ├── forms/           # フォーム関連コンポーネント
│   ├── layout/          # レイアウトコンポーネント
│   └── game/            # ゲーム固有コンポーネント
├── hooks/               # カスタムフック
├── routes/              # ページコンポーネント（React Router）
├── utils/               # ユーティリティ関数
├── types/               # フロントエンド固有型定義
└── app.css              # グローバルスタイル
```

## UIコンポーネントシステム

### 1. プリミティブコンポーネント

#### Button コンポーネント

```typescript
// app/web/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // ベースクラス
  [
    'inline-flex items-center justify-center rounded-md text-sm font-medium',
    'transition-colors duration-200 focus-visible:outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50'
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-blue-600 text-white hover:bg-blue-700',
          'focus-visible:ring-blue-500'
        ],
        secondary: [
          'bg-gray-100 text-gray-900 hover:bg-gray-200',
          'focus-visible:ring-gray-500'
        ],
        destructive: [
          'bg-red-600 text-white hover:bg-red-700',
          'focus-visible:ring-red-500'
        ],
        outline: [
          'border border-gray-300 bg-white text-gray-700',
          'hover:bg-gray-50 focus-visible:ring-gray-500'
        ],
        ghost: [
          'text-gray-700 hover:bg-gray-100',
          'focus-visible:ring-gray-500'
        ],
        link: [
          'text-blue-600 underline-offset-4 hover:underline',
          'focus-visible:ring-blue-500'
        ]
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className=\"-ml-1 mr-2 h-4 w-4 animate-spin\"
            xmlns=\"http://www.w3.org/2000/svg\"
            fill=\"none\"
            viewBox=\"0 0 24 24\"
          >
            <circle
              className=\"opacity-25\"
              cx=\"12\"
              cy=\"12\"
              r=\"10\"
              stroke=\"currentColor\"
              strokeWidth=\"4\"
            />
            <path
              className=\"opacity-75\"
              fill=\"currentColor\"
              d=\"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z\"
            />
          </svg>
        )}
        {!loading && leftIcon && (
          <span className=\"mr-2\">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className=\"ml-2\">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

#### Input コンポーネント

```typescript
// app/web/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  [
    'block w-full rounded-md border px-3 py-2 text-sm',
    'transition-colors duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:cursor-not-allowed disabled:opacity-50'
  ],
  {
    variants: {
      variant: {
        default: [
          'border-gray-300 bg-white text-gray-900',
          'focus:border-blue-500 focus:ring-blue-500'
        ],
        error: [
          'border-red-300 bg-white text-gray-900',
          'focus:border-red-500 focus:ring-red-500'
        ],
        success: [
          'border-green-300 bg-white text-gray-900',
          'focus:border-green-500 focus:ring-green-500'
        ]
      },
      size: {
        sm: 'h-8 px-2 py-1 text-xs',
        md: 'h-10 px-3 py-2 text-sm',
        lg: 'h-12 px-4 py-3 text-base'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\\s+/g, '-');
    const finalVariant = error ? 'error' : variant;

    return (
      <div className=\"space-y-2\">
        {label && (
          <label
            htmlFor={inputId}
            className=\"block text-sm font-medium text-gray-700\"
          >
            {label}
          </label>
        )}
        
        <div className=\"relative\">
          {leftIcon && (
            <div className=\"pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3\">
              <span className=\"text-gray-400\">{leftIcon}</span>
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={inputVariants({
              variant: finalVariant,
              size,
              className: [
                className,
                leftIcon && 'pl-10',
                rightIcon && 'pr-10'
              ].filter(Boolean).join(' ')
            })}
            {...props}
          />
          
          {rightIcon && (
            <div className=\"pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3\">
              <span className=\"text-gray-400\">{rightIcon}</span>
            </div>
          )}
        </div>
        
        {error && (
          <p className=\"text-sm text-red-600\">{error}</p>
        )}
        
        {helperText && !error && (
          <p className=\"text-sm text-gray-500\">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

### 2. 複合コンポーネント

#### Card コンポーネント

```typescript
// app/web/components/ui/Card.tsx
import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  ['rounded-lg border bg-white shadow-sm'],
  {
    variants: {
      variant: {
        default: 'border-gray-200',
        elevated: 'border-gray-200 shadow-lg',
        outlined: 'border-gray-300 shadow-none'
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md'
    }
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({ variant, padding, className })}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

// Card サブコンポーネント
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`border-b border-gray-200 pb-4 ${className || ''}`}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-lg font-semibold text-gray-900 ${className || ''}`}
    {...props}
  />
));

CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`pt-4 ${className || ''}`}
    {...props}
  />
));

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`border-t border-gray-200 pt-4 ${className || ''}`}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';
```

### 3. フォームコンポーネント

#### FormField コンポーネント

```typescript
// app/web/components/forms/FormField.tsx
import { type ReactNode } from 'react';
import { Input, type InputProps } from '../ui/Input';

export interface FormFieldProps extends Omit<InputProps, 'error'> {
  name: string;
  errors?: Record<string, string[]>;
  children?: ReactNode;
}

export function FormField({ 
  name, 
  errors, 
  children, 
  ...inputProps 
}: FormFieldProps) {
  const fieldErrors = errors?.[name];
  const errorMessage = fieldErrors?.[0];

  if (children) {
    // カスタムフィールドの場合
    return (
      <div className=\"space-y-2\">
        {inputProps.label && (
          <label
            htmlFor={name}
            className=\"block text-sm font-medium text-gray-700\"
          >
            {inputProps.label}
          </label>
        )}
        {children}
        {errorMessage && (
          <p className=\"text-sm text-red-600\">{errorMessage}</p>
        )}
        {inputProps.helperText && !errorMessage && (
          <p className=\"text-sm text-gray-500\">{inputProps.helperText}</p>
        )}
      </div>
    );
  }

  return (
    <Input
      {...inputProps}
      name={name}
      id={name}
      error={errorMessage}
    />
  );
}

// 使用例
export function LoginForm() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method=\"post\" className=\"space-y-6\">
      <FormField
        name=\"email\"
        type=\"email\"
        label=\"メールアドレス\"
        placeholder=\"your@email.com\"
        required
        errors={actionData?.errors}
      />
      
      <FormField
        name=\"password\"
        type=\"password\"
        label=\"パスワード\"
        placeholder=\"パスワードを入力\"
        required
        errors={actionData?.errors}
      />
      
      <Button type=\"submit\" className=\"w-full\">
        ログイン
      </Button>
    </Form>
  );
}
```

## レイアウトコンポーネント

### 1. ページレイアウト

```typescript
// app/web/components/layout/Layout.tsx
import { type ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';

export interface LayoutProps {
  children: ReactNode;
  sidebar?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

export function Layout({ 
  children, 
  sidebar = false, 
  maxWidth = 'lg',
  className 
}: LayoutProps) {
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-full'
  }[maxWidth];

  return (
    <div className=\"min-h-screen bg-gray-50\">
      <Header />
      
      <main className=\"flex-1\">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${maxWidthClass}`}>
          {sidebar ? (
            <div className=\"flex gap-8\">
              <aside className=\"w-64 flex-shrink-0\">
                <Sidebar />
              </aside>
              <div className={`flex-1 ${className || ''}`}>
                {children}
              </div>
            </div>
          ) : (
            <div className={className}>
              {children}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

// 特定用途向けレイアウト
export function GameLayout({ children }: { children: ReactNode }) {
  return (
    <Layout maxWidth=\"full\" className=\"h-[calc(100vh-theme(spacing.16))]\">
      <div className=\"h-full bg-white rounded-lg shadow-sm overflow-hidden\">
        {children}
      </div>
    </Layout>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className=\"min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100\">
      <div className=\"flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8\">
        <div className=\"w-full max-w-md space-y-8\">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### 2. レスポンシブグリッド

```typescript
// app/web/components/layout/Grid.tsx
import { type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const gridVariants = cva(
  'grid gap-4',
  {
    variants: {
      cols: {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        auto: 'grid-cols-[repeat(auto-fit,minmax(280px,1fr))]'
      },
      gap: {
        sm: 'gap-2',
        md: 'gap-4',
        lg: 'gap-6',
        xl: 'gap-8'
      }
    },
    defaultVariants: {
      cols: 'auto',
      gap: 'md'
    }
  }
);

export interface GridProps
  extends VariantProps<typeof gridVariants> {
  children: ReactNode;
  className?: string;
}

export function Grid({ children, cols, gap, className }: GridProps) {
  return (
    <div className={gridVariants({ cols, gap, className })}>
      {children}
    </div>
  );
}

// 使用例
export function GameGrid({ games }: { games: GameSummary[] }) {
  return (
    <Grid cols={3} gap=\"lg\">
      {games.map(game => (
        <Card key={game.id} variant=\"elevated\">
          <CardHeader>
            <CardTitle>{game.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className=\"text-sm text-gray-600\">
              {game.currentPlayers}/{game.maxPlayers} プレイヤー
            </p>
            <p className=\"text-xs text-gray-500 mt-1\">
              {new Date(game.createdAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </Grid>
  );
}
```

## ゲーム固有コンポーネント

### 1. ゲームボード

```typescript
// app/web/components/game/GameBoard.tsx
import { useState, useCallback, type MouseEvent } from 'react';

export interface GameCellData {
  x: number;
  y: number;
  content?: {
    type: 'player' | 'item' | 'obstacle';
    owner?: string;
    color?: string;
  };
  isSelectable: boolean;
  isHighlighted?: boolean;
}

export interface GameBoardProps {
  width: number;
  height: number;
  cells: GameCellData[][];
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number) => void;
  isInteractive?: boolean;
  className?: string;
}

export function GameBoard({
  width,
  height,
  cells,
  onCellClick,
  onCellHover,
  isInteractive = true,
  className
}: GameBoardProps) {
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  const handleCellClick = useCallback((x: number, y: number) => {
    if (!isInteractive) return;
    onCellClick?.(x, y);
  }, [isInteractive, onCellClick]);

  const handleCellMouseEnter = useCallback((x: number, y: number) => {
    if (!isInteractive) return;
    setHoveredCell({ x, y });
    onCellHover?.(x, y);
  }, [isInteractive, onCellHover]);

  const handleCellMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  return (
    <div
      className={`inline-block border-2 border-gray-800 bg-gray-100 ${className || ''}`}
      style={{
        gridTemplateColumns: `repeat(${width}, 1fr)`,
        display: 'grid'
      }}
    >
      {cells.flat().map((cell) => {
        const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y;
        
        return (
          <GameCell
            key={`${cell.x}-${cell.y}`}
            cell={cell}
            isHovered={isHovered}
            onClick={() => handleCellClick(cell.x, cell.y)}
            onMouseEnter={() => handleCellMouseEnter(cell.x, cell.y)}
            onMouseLeave={handleCellMouseLeave}
            interactive={isInteractive}
          />
        );
      })}
    </div>
  );
}

interface GameCellProps {
  cell: GameCellData;
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  interactive: boolean;
}

function GameCell({
  cell,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  interactive
}: GameCellProps) {
  const baseClasses = [
    'w-12 h-12 border border-gray-300 flex items-center justify-center text-xs font-bold',
    'transition-all duration-150'
  ];

  const stateClasses = [];

  if (interactive && cell.isSelectable) {
    stateClasses.push('cursor-pointer hover:bg-blue-100');
  }

  if (isHovered && cell.isSelectable) {
    stateClasses.push('ring-2 ring-blue-500');
  }

  if (cell.isHighlighted) {
    stateClasses.push('bg-yellow-200');
  }

  // セルの内容に応じた背景色
  if (cell.content) {
    switch (cell.content.type) {
      case 'player':
        stateClasses.push('bg-blue-500 text-white');
        break;
      case 'item':
        stateClasses.push('bg-green-500 text-white');
        break;
      case 'obstacle':
        stateClasses.push('bg-gray-500 text-white');
        break;
    }
  }

  return (
    <div
      className={[...baseClasses, ...stateClasses].join(' ')}
      onClick={interactive ? onClick : undefined}
      onMouseEnter={interactive ? onMouseEnter : undefined}
      onMouseLeave={interactive ? onMouseLeave : undefined}
      role={interactive && cell.isSelectable ? 'button' : undefined}
      tabIndex={interactive && cell.isSelectable ? 0 : undefined}
      aria-label={`Cell at ${cell.x}, ${cell.y}${cell.content ? ` containing ${cell.content.type}` : ''}`}
    >
      {cell.content && (
        <span>
          {cell.content.type === 'player' && '👤'}
          {cell.content.type === 'item' && '🎁'}
          {cell.content.type === 'obstacle' && '🚧'}
        </span>
      )}
    </div>
  );
}
```

### 2. プレイヤー情報パネル

```typescript
// app/web/components/game/PlayerPanel.tsx
export interface PlayerInfo {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isCurrentTurn: boolean;
  isOnline: boolean;
  character?: {
    type: string;
    level: number;
  };
}

export interface PlayerPanelProps {
  players: PlayerInfo[];
  currentUserId?: string;
  className?: string;
}

export function PlayerPanel({ 
  players, 
  currentUserId, 
  className 
}: PlayerPanelProps) {
  return (
    <div className={`space-y-3 ${className || ''}`}>
      <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
        プレイヤー ({players.length})
      </h3>
      
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          isCurrentUser={player.id === currentUserId}
        />
      ))}
    </div>
  );
}

interface PlayerCardProps {
  player: PlayerInfo;
  isCurrentUser: boolean;
}

function PlayerCard({ player, isCurrentUser }: PlayerCardProps) {
  return (
    <div
      className={`
        rounded-lg border p-3 transition-all duration-200
        ${player.isCurrentTurn 
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
          : 'border-gray-200 bg-white hover:bg-gray-50'
        }
        ${isCurrentUser ? 'ring-1 ring-green-300' : ''}
      `}
    >
      <div className=\"flex items-center space-x-3\">
        {/* アバター */}
        <div className=\"relative flex-shrink-0\">
          <img
            className=\"h-10 w-10 rounded-full\"
            src={player.avatar || '/default-avatar.png'}
            alt={`${player.name}のアバター`}
          />
          <div
            className={`
              absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white
              ${player.isOnline ? 'bg-green-400' : 'bg-gray-400'}
            `}
            aria-label={player.isOnline ? 'オンライン' : 'オフライン'}
          />
        </div>

        {/* プレイヤー情報 */}
        <div className=\"flex-1 min-w-0\">
          <div className=\"flex items-center space-x-2\">
            <p className=\"text-sm font-medium text-gray-900 truncate\">
              {player.name}
              {isCurrentUser && (
                <span className=\"ml-1 text-xs text-green-600\">(あなた)</span>
              )}
            </p>
            {player.isCurrentTurn && (
              <span className=\"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800\">
                プレイ中
              </span>
            )}
          </div>
          
          <div className=\"flex items-center space-x-4 mt-1\">
            <p className=\"text-xs text-gray-500\">
              スコア: <span className=\"font-medium\">{player.score}</span>
            </p>
            
            {player.character && (
              <p className=\"text-xs text-gray-500\">
                {player.character.type} Lv.{player.character.level}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## カスタムフック

### 1. ゲーム状態管理フック

```typescript
// app/web/hooks/useGameState.ts
import { useState, useCallback, useRef, useEffect } from 'react';

export interface GameStateHookProps {
  gameId: string;
  initialState?: GameState;
  onStateChange?: (newState: GameState) => void;
}

export function useGameState({ 
  gameId, 
  initialState, 
  onStateChange 
}: GameStateHookProps) {
  const [gameState, setGameState] = useState<GameState | null>(initialState || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // リアルタイム状態更新の設定
  useEffect(() => {
    if (!gameId) return;

    const eventSource = new EventSource(`/api/games/${gameId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsLoading(false);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const newState = JSON.parse(event.data) as GameState;
        setGameState(newState);
        onStateChange?.(newState);
      } catch (err) {
        console.error('Failed to parse game state:', err);
        setError('ゲーム状態の更新に失敗しました');
      }
    };

    eventSource.onerror = () => {
      setError('リアルタイム接続が切断されました');
      setIsLoading(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [gameId, onStateChange]);

  // 手動でゲーム状態を更新
  const refreshGameState = useCallback(async () => {
    if (!gameId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/games/${gameId}/state`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch game state');
      }
      
      const newState = await response.json() as GameState;
      setGameState(newState);
      onStateChange?.(newState);
    } catch (err) {
      setError('ゲーム状態の取得に失敗しました');
      console.error('Failed to refresh game state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [gameId, onStateChange]);

  // ゲームアクション実行
  const executeMove = useCallback(async (moveData: GameMoveData) => {
    if (!gameId) return { success: false, error: 'ゲームIDが設定されていません' };

    try {
      const response = await fetch(`/api/games/${gameId}/moves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.message || '手の実行に失敗しました' };
      }

      return { success: true, data: result };
    } catch (err) {
      console.error('Failed to execute move:', err);
      return { success: false, error: 'ネットワークエラーが発生しました' };
    }
  }, [gameId]);

  return {
    gameState,
    isLoading,
    error,
    refreshGameState,
    executeMove,
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN
  };
}
```

### 2. フォーム管理フック

```typescript
// app/web/hooks/useForm.ts
import { useState, useCallback } from 'react';
import { useNavigation } from 'react-router';

export interface UseFormProps<T> {
  initialValues: T;
  validate?: (values: T) => Record<string, string[]>;
  onSubmit?: (values: T) => void | Promise<void>;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit
}: UseFormProps<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const navigation = useNavigation();

  const isSubmitting = navigation.state === 'submitting';

  const setValue = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string[]) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const setFieldTouched = useCallback((name: keyof T, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }));
  }, []);

  const validateField = useCallback((name: keyof T, value: any) => {
    if (!validate) return [];

    const allErrors = validate({ ...values, [name]: value });
    const fieldErrors = allErrors[name as string] || [];
    
    setErrors(prev => ({ ...prev, [name]: fieldErrors }));
    return fieldErrors;
  }, [values, validate]);

  const validateForm = useCallback(() => {
    if (!validate) return true;

    const formErrors = validate(values);
    setErrors(formErrors);
    
    return Object.keys(formErrors).length === 0;
  }, [values, validate]);

  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit?.(values);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [values, validateForm, onSubmit]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const getFieldProps = useCallback((name: keyof T) => ({
    name: name as string,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(name, newValue);
      
      if (touched[name as string]) {
        validateField(name, newValue);
      }
    },
    onBlur: () => {
      setFieldTouched(name);
      validateField(name, values[name]);
    }
  }), [values, touched, setValue, setFieldTouched, validateField]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldError,
    setFieldTouched,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    getFieldProps
  };
}
```

## パフォーマンス最適化

### 1. メモ化とコンポーネント最適化

```typescript
// app/web/components/optimized/OptimizedGameBoard.tsx
import { memo, useMemo, useCallback } from 'react';

export interface OptimizedGameBoardProps {
  width: number;
  height: number;
  cellData: GameCellData[][];
  onCellClick: (x: number, y: number) => void;
}

export const OptimizedGameBoard = memo<OptimizedGameBoardProps>(({
  width,
  height,
  cellData,
  onCellClick
}) => {
  // セルクリックハンドラーのメモ化
  const handleCellClick = useCallback((x: number, y: number) => {
    onCellClick(x, y);
  }, [onCellClick]);

  // セルの描画をメモ化
  const renderedCells = useMemo(() => {
    return cellData.flat().map((cell, index) => (
      <OptimizedGameCell
        key={`${cell.x}-${cell.y}`}
        cell={cell}
        onClick={handleCellClick}
      />
    ));
  }, [cellData, handleCellClick]);

  return (
    <div
      className=\"game-board\"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, 1fr)`,
        gap: '1px'
      }}
    >
      {renderedCells}
    </div>
  );
});

OptimizedGameBoard.displayName = 'OptimizedGameBoard';

// セルコンポーネントもメモ化
const OptimizedGameCell = memo<{
  cell: GameCellData;
  onClick: (x: number, y: number) => void;
}>(({ cell, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(cell.x, cell.y);
  }, [cell.x, cell.y, onClick]);

  return (
    <div
      className={`game-cell ${cell.isSelectable ? 'selectable' : ''}`}
      onClick={cell.isSelectable ? handleClick : undefined}
    >
      {cell.content && <CellContent content={cell.content} />}
    </div>
  );
});

OptimizedGameCell.displayName = 'OptimizedGameCell';
```

### 2. 仮想化対応（大量データ用）

```typescript
// app/web/components/virtualized/VirtualizedList.tsx
import { FixedSizeList as List } from 'react-window';

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  className
}: VirtualizedListProps<T>) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  return (
    <div className={className}>
      <List
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        width=\"100%\"
      >
        {Row}
      </List>
    </div>
  );
}

// 使用例: 大量のゲーム履歴表示
export function GameHistoryList({ games }: { games: GameSummary[] }) {
  const renderGameItem = useCallback((game: GameSummary, index: number) => (
    <div className=\"flex items-center space-x-4 p-4 border-b\">
      <div className=\"flex-1\">
        <h4 className=\"font-medium\">{game.name}</h4>
        <p className=\"text-sm text-gray-600\">
          {new Date(game.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className=\"text-right\">
        <span className=\"text-sm font-medium\">
          {game.currentPlayers}/{game.maxPlayers}
        </span>
      </div>
    </div>
  ), []);

  return (
    <VirtualizedList
      items={games}
      itemHeight={80}
      height={400}
      renderItem={renderGameItem}
      className=\"border rounded-lg\"
    />
  );
}
```

## 今後の拡張計画

### Phase 1: UI/UX強化（3ヶ月）
1. **アニメーションライブラリ**: Framer Motion統合によるスムーズな画面遷移
2. **ダークモード**: システム設定連動のテーマ切り替え
3. **アクセシビリティ**: WCAG 2.1 AA準拠の完全対応
4. **デザインシステム拡張**: より多くのコンポーネントとパターン

### Phase 2: ゲーム機能特化（6ヶ月）
1. **リアルタイム機能**: WebSocket統合による即座の状態同期
2. **3Dゲームボード**: Three.js統合による立体的なゲーム体験
3. **音声・効果音**: Web Audio APIによるゲーム体験向上
4. **モバイル最適化**: タッチ操作とPWA対応

### Phase 3: 先進的機能（12ヶ月）
1. **VR/AR対応**: WebXR APIによる没入型ゲーム体験
2. **AI支援**: プレイヤー向けヒント・攻略支援機能
3. **マルチ言語**: 完全国際化対応
4. **オフライン対応**: Service Workerによるオフラインプレイ

## まとめ

本フロントエンド設計は、React Router v7とTailwind CSSを活用し、ゲームアプリケーションに最適化された包括的なUIシステムを提供します。コンポーネントの再利用性、型安全性、パフォーマンス、アクセシビリティを重視した設計により、優れた開発者体験とユーザーエクスペリエンスを両立します。

継続的な改善と最新技術の導入により、競争力のあるモダンなゲームアプリケーションのフロントエンドを構築していきます。