import { describe, expect, it } from 'vitest';
import { Email, EmailInvalidError } from './email.vo';

describe('Email', () => {
  describe('create', () => {
    it('正常なメールアドレスでEmailを作成できる', () => {
      const email = Email.create('test@example.com');
      expect(email.value).toBe('test@example.com');
    });

    it('メールアドレスは小文字に正規化される', () => {
      const email = Email.create('TEST@EXAMPLE.COM');
      expect(email.value).toBe('test@example.com');
    });

    it('前後の空白は除去される', () => {
      const email = Email.create('  test@example.com  ');
      expect(email.value).toBe('test@example.com');
    });

    it('空文字列の場合はエラーになる', () => {
      expect(() => Email.create('')).toThrow(EmailInvalidError);
      expect(() => Email.create('')).toThrow('Email cannot be empty');
    });

    it('nullやundefinedの場合はエラーになる', () => {
      expect(() => Email.create(null as any)).toThrow(EmailInvalidError);
      expect(() => Email.create(undefined as any)).toThrow(EmailInvalidError);
    });

    it('無効なフォーマットの場合はエラーになる', () => {
      expect(() => Email.create('invalid')).toThrow(EmailInvalidError);
      expect(() => Email.create('invalid@')).toThrow(EmailInvalidError);
      expect(() => Email.create('@example.com')).toThrow(EmailInvalidError);
      expect(() => Email.create('test@')).toThrow(EmailInvalidError);
    });

    it('254文字を超える場合はエラーになる', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => Email.create(longEmail)).toThrow(EmailInvalidError);
      expect(() => Email.create(longEmail)).toThrow('Email is too long');
    });
  });

  describe('equals', () => {
    it('同じメールアドレスの場合はtrueを返す', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('異なるメールアドレスの場合はfalseを返す', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('other@example.com');
      expect(email1.equals(email2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('メールアドレスの文字列表現を返す', () => {
      const email = Email.create('test@example.com');
      expect(email.toString()).toBe('test@example.com');
    });
  });
});
