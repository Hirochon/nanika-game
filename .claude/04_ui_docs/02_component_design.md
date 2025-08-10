# UIコンポーネント設計

## 📋 目次
1. [コンポーネント階層](#コンポーネント階層)
2. [基礎コンポーネント（Atoms）](#基礎コンポーネントatoms)
3. [複合コンポーネント（Molecules）](#複合コンポーネントmolecules)
4. [テンプレート（Templates）](#テンプレートtemplates)
5. [コンポーネント実装ガイドライン](#コンポーネント実装ガイドライン)
6. [アクセシビリティチェックリスト](#アクセシビリティチェックリスト)

## コンポーネント階層

```
基礎コンポーネント（Atoms）
├── Button         - ボタン要素
├── Input          - 入力フィールド
├── Label          - ラベル要素
├── Typography     - テキスト要素
├── Icon           - アイコン要素
├── Badge          - バッジ/タグ
├── Spinner        - ローディングインジケータ
└── Divider        - 区切り線

複合コンポーネント（Molecules）
├── FormField      - フォーム入力セット
├── Card           - カードコンテナ
├── Alert          - アラートメッセージ
├── Modal          - モーダルダイアログ
├── Dropdown       - ドロップダウンメニュー
├── Navigation     - ナビゲーションバー
├── Pagination     - ページネーション
└── Toast          - トースト通知

テンプレート（Templates）
├── AuthLayout     - 認証画面レイアウト
├── DashboardLayout - ダッシュボードレイアウト
├── FormLayout     - フォームレイアウト
└── ListLayout     - リスト表示レイアウト
```

## 基礎コンポーネント（Atoms）

### Button

```tsx
// Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

// バリアント定義
const buttonVariants = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

// 使用例
<Button variant="primary" size="md" onClick={handleClick}>
  保存する
</Button>

<Button variant="secondary" loading disabled>
  <Spinner className="mr-2" />
  処理中...
</Button>

<Button variant="danger" fullWidth>
  削除する
</Button>
```

### Input

```tsx
// Input.tsx
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  error?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

// スタイル定義
const inputStyles = {
  base: `
    w-full px-3 py-2
    border rounded-md
    text-gray-900 placeholder-gray-500
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
  `,
  default: 'border-gray-300 focus:ring-indigo-500 focus:border-transparent',
  error: 'border-red-500 focus:ring-red-500',
  disabled: 'bg-gray-100 cursor-not-allowed opacity-60',
};

// 使用例
<Input
  type="email"
  placeholder="メールアドレス"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={!!errors.email}
  aria-invalid={!!errors.email}
  aria-describedby="email-error"
/>
```

### Typography

```tsx
// Typography.tsx
interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'overline';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  align?: 'left' | 'center' | 'right';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const typographyVariants = {
  h1: 'text-4xl font-bold leading-tight',
  h2: 'text-3xl font-semibold leading-tight',
  h3: 'text-2xl font-semibold leading-snug',
  h4: 'text-xl font-medium leading-snug',
  body: 'text-base leading-normal',
  caption: 'text-sm leading-normal',
  overline: 'text-xs uppercase tracking-wider font-medium',
};

// 使用例
<Typography variant="h1" color="primary">
  ページタイトル
</Typography>

<Typography variant="body" color="secondary" align="center">
  説明文テキスト
</Typography>
```

### Badge

```tsx
// Badge.tsx
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const badgeVariants = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

// 使用例
<Badge variant="success">アクティブ</Badge>
<Badge variant="warning" size="sm">保留中</Badge>
```

## 複合コンポーネント（Molecules）

### FormField

```tsx
// FormField.tsx
interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export function FormField({
  label,
  name,
  error,
  helpText,
  required,
  ...inputProps
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        error={!!error}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : `${name}-help`}
        {...inputProps}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={`${name}-help`} className="text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}

// 使用例
<FormField
  label="メールアドレス"
  name="email"
  type="email"
  placeholder="email@example.com"
  value={formData.email}
  onChange={handleChange}
  error={errors.email}
  helpText="ログインに使用するメールアドレス"
  required
/>
```

### Card

```tsx
// Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

// 複合コンポーネントパターン
export function Card({ children, className, shadow = 'md', ...props }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-lg overflow-hidden',
      shadowStyles[shadow],
      hover && 'hover:shadow-lg transition-shadow duration-300',
      className
    )}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-200', className)}>
      {children}
    </div>
  );
};

Card.Body = function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('p-6', className)}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 bg-gray-50 border-t border-gray-200', className)}>
      {children}
    </div>
  );
};

// 使用例
<Card shadow="lg" hover>
  <Card.Header>
    <h3 className="text-lg font-semibold">カードタイトル</h3>
  </Card.Header>
  <Card.Body>
    <p>カードの本文コンテンツ</p>
  </Card.Body>
  <Card.Footer>
    <Button variant="primary">アクション</Button>
  </Card.Footer>
</Card>
```

### Alert

```tsx
// Alert.tsx
interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const alertVariants = {
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: InfoIcon,
    iconColor: 'text-blue-400',
    text: 'text-blue-800',
  },
  success: {
    container: 'bg-green-50 border-green-200',
    icon: CheckCircleIcon,
    iconColor: 'text-green-400',
    text: 'text-green-800',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200',
    icon: ExclamationIcon,
    iconColor: 'text-yellow-400',
    text: 'text-yellow-800',
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: XCircleIcon,
    iconColor: 'text-red-400',
    text: 'text-red-800',
  },
};

// 使用例
<Alert variant="success" title="操作が完了しました" onClose={handleClose}>
  データが正常に保存されました。
</Alert>

<Alert variant="error">
  エラーが発生しました。もう一度お試しください。
</Alert>
```

### Modal

```tsx
// Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* オーバーレイ */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* モーダル本体 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={cn(
          'relative bg-white rounded-lg shadow-2xl w-full',
          modalSizes[size]
        )}>
          {/* ヘッダー */}
          {title && (
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
                aria-label="閉じる"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          )}
          
          {/* コンテンツ */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// 使用例
<Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="確認">
  <p className="mb-4">本当に削除してもよろしいですか？</p>
  <div className="flex justify-end gap-3">
    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
      キャンセル
    </Button>
    <Button variant="danger" onClick={handleDelete}>
      削除する
    </Button>
  </div>
</Modal>
```

## テンプレート（Templates）

### AuthLayout

```tsx
// AuthLayout.tsx
interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-md p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// 使用例
<AuthLayout 
  title="ログイン" 
  subtitle="アカウントにログインしてください"
>
  <Form method="post" className="space-y-4">
    <FormField name="email" label="メールアドレス" type="email" />
    <FormField name="password" label="パスワード" type="password" />
    <Button type="submit" variant="primary" fullWidth>
      ログイン
    </Button>
  </Form>
</AuthLayout>
```

### DashboardLayout

```tsx
// DashboardLayout.tsx
interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Nanika Game</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{user.name}</span>
              <Form method="post" action="/logout">
                <Button variant="ghost" size="sm">
                  ログアウト
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </header>

      {/* サイドバー + メインコンテンツ */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* サイドバー */}
        <aside className="w-64 bg-white border-r border-gray-200">
          <nav className="p-4 space-y-1">
            <NavLink to="/dashboard" className="nav-link">
              ダッシュボード
            </NavLink>
            <NavLink to="/profile" className="nav-link">
              プロフィール
            </NavLink>
            <NavLink to="/settings" className="nav-link">
              設定
            </NavLink>
          </nav>
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

## コンポーネント実装ガイドライン

### 1. TypeScript型定義

```tsx
// 必須: 全てのpropsに型定義
interface ComponentProps {
  // 必須props
  id: string;
  name: string;
  
  // オプショナルprops
  className?: string;
  disabled?: boolean;
  
  // イベントハンドラー
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChange?: (value: string) => void;
  
  // children
  children?: React.ReactNode;
  
  // ARIA属性
  'aria-label'?: string;
  'aria-describedby'?: string;
}
```

### 2. デフォルト値の設定

```tsx
// デフォルトprops
const Component: React.FC<ComponentProps> = ({
  variant = 'default',
  size = 'md',
  disabled = false,
  ...props
}) => {
  // 実装
};
```

### 3. クラス名の合成

```tsx
import { cn } from '~/utils/cn';

// 条件付きクラス名
const className = cn(
  'base-classes',
  variant === 'primary' && 'primary-classes',
  disabled && 'disabled-classes',
  props.className // カスタムクラスを最後に
);
```

### 4. フォワードRef

```tsx
// ref転送が必要なコンポーネント
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn('input-base', className)}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
```

## アクセシビリティチェックリスト

### フォーム要素
- [ ] 全ての入力フィールドにラベルが関連付けられている
- [ ] エラーメッセージが`aria-describedby`で関連付けられている
- [ ] 必須フィールドに`aria-required="true"`が設定されている
- [ ] 無効な入力に`aria-invalid="true"`が設定されている

### ボタン・リンク
- [ ] アイコンのみのボタンに`aria-label`が設定されている
- [ ] 新しいウィンドウで開くリンクに適切な通知がある
- [ ] フォーカス順序が論理的である

### モーダル・ポップアップ
- [ ] フォーカストラップが実装されている
- [ ] ESCキーで閉じることができる
- [ ] 背景のスクロールが無効化されている
- [ ] `role="dialog"`と`aria-modal="true"`が設定されている

### カラーコントラスト
- [ ] 通常テキスト: 4.5:1以上
- [ ] 大きいテキスト: 3:1以上
- [ ] インタラクティブ要素: 3:1以上

### キーボード操作
- [ ] すべての機能がキーボードで操作可能
- [ ] フォーカスインジケータが明確に表示される
- [ ] タブ順序が論理的である

## 更新履歴

- 2025-08-10: 初版作成
- 基礎コンポーネント定義
- 複合コンポーネント設計
- テンプレート構造
- アクセシビリティガイドライン追加