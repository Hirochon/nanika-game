import { type ClassValue, clsx } from 'clsx';

/**
 * クラス名を条件付きで結合するユーティリティ関数
 * clsxライブラリを使用して、複数のクラス名を効率的に合成します
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
