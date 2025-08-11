/**
 * 入力フィールドコンポーネント
 * デザインシステムに基づく基礎UIコンポーネント
 */

import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, fullWidth = false, ...props }, ref) => {
    return (
      <input
        className={cn(
          'px-3 py-2 border rounded-md text-gray-900 placeholder-gray-500',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          error
            ? 'border-red-500 focus:ring-red-500 focus:border-transparent'
            : 'border-gray-300 focus:ring-indigo-500 focus:border-transparent',
          'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
          fullWidth && 'w-full',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
