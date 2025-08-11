import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/errors/domain.error';
import { ChatMemberId } from './chat-member-id.vo';

describe('ChatMemberId', () => {
  describe('create', () => {
    it('正の整数から ChatMemberId を作成できる', () => {
      const id = ChatMemberId.create(1);
      expect(id.value).toBe(1);
    });

    it('0以下の値でエラーがスローされる', () => {
      expect(() => ChatMemberId.create(0)).toThrow(DomainError);
      expect(() => ChatMemberId.create(-1)).toThrow(DomainError);
      expect(() => ChatMemberId.create(-100)).toThrow(DomainError);
    });

    it('整数以外の値でエラーがスローされる', () => {
      expect(() => ChatMemberId.create(1.5)).toThrow(DomainError);
      expect(() => ChatMemberId.create(NaN)).toThrow(DomainError);
      expect(() => ChatMemberId.create(Infinity)).toThrow(DomainError);
    });
  });

  describe('generate', () => {
    it('一時的なIDを生成できる', () => {
      const id = ChatMemberId.generate();
      expect(typeof id.value).toBe('number');
      expect(id.value).toBeGreaterThan(0);
    });

    it('異なるIDが生成される', () => {
      const id1 = ChatMemberId.generate();
      const id2 = ChatMemberId.generate();
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('equals', () => {
    it('同じ値の ChatMemberId は等しい', () => {
      const id1 = ChatMemberId.create(1);
      const id2 = ChatMemberId.create(1);
      expect(id1.equals(id2)).toBe(true);
    });

    it('異なる値の ChatMemberId は等しくない', () => {
      const id1 = ChatMemberId.create(1);
      const id2 = ChatMemberId.create(2);
      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('数値を文字列として返す', () => {
      const id = ChatMemberId.create(123);
      expect(id.toString()).toBe('123');
    });
  });
});
