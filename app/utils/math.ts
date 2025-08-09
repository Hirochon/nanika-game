/**
 * 2つの数値を加算する
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * 2つの数値を乗算する
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * 数値が偶数かどうかを判定する
 */
export function isEven(n: number): boolean {
  return n % 2 === 0;
}

/**
 * 数値の階乗を計算する
 */
export function factorial(n: number): number {
  if (n < 0) {
    throw new Error('Factorial is not defined for negative numbers');
  }
  if (n === 0 || n === 1) {
    return 1;
  }
  return n * factorial(n - 1);
}