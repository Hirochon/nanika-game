import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/errors/domain.error';
import { MessageId } from './message-id.vo';

describe('MessageId', () => {
  describe('create', () => {
    it('正の整数から MessageId を作成できる', () => {
      const id = MessageId.create(1);
      expect(id.value).toBe(1);
    });

    it('0以下の値でエラーがスローされる', () => {
      expect(() => MessageId.create(0)).toThrow(DomainError);
      expect(() => MessageId.create(-1)).toThrow(DomainError);
      expect(() => MessageId.create(-100)).toThrow(DomainError);
    });

    it('整数以外の値でエラーがスローされる', () => {
      expect(() => MessageId.create(1.5)).toThrow(DomainError);
      expect(() => MessageId.create(NaN)).toThrow(DomainError);
      expect(() => MessageId.create(Infinity)).toThrow(DomainError);
    });
  });

  describe('generate', () => {
    it('一時的なIDを生成できる', () => {
      const id = MessageId.generate();
      expect(typeof id.value).toBe('number');
      expect(id.value).toBeGreaterThan(0);
    });

    it('異なるIDが生成される', () => {
      const id1 = MessageId.generate();
      const id2 = MessageId.generate();
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('equals', () => {
    it('同じ値の MessageId は等しい', () => {
      const id1 = MessageId.create(1);
      const id2 = MessageId.create(1);
      expect(id1.equals(id2)).toBe(true);
    });

    it('異なる値の MessageId は等しくない', () => {
      const id1 = MessageId.create(1);
      const id2 = MessageId.create(2);
      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('数値を文字列として返す', () => {
      const id = MessageId.create(123);
      expect(id.toString()).toBe('123');
    });
  });
});
