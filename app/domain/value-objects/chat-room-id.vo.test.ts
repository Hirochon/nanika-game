import { describe, expect, it } from 'vitest';
import { ChatDomainError } from '../../shared/errors/chat.error';
import { ChatRoomId } from './chat-room-id.vo';

describe('ChatRoomId', () => {
  describe('create', () => {
    it('正の整数から ChatRoomId を作成できる', () => {
      const id = ChatRoomId.create(1);
      expect(id.value).toBe(1);
    });

    it('0以下の値でエラーがスローされる', () => {
      expect(() => ChatRoomId.create(0)).toThrow(ChatDomainError);
      expect(() => ChatRoomId.create(-1)).toThrow(ChatDomainError);
      expect(() => ChatRoomId.create(-100)).toThrow(ChatDomainError);
    });

    it('整数以外の値でエラーがスローされる', () => {
      expect(() => ChatRoomId.create(1.5)).toThrow(ChatDomainError);
      expect(() => ChatRoomId.create(NaN)).toThrow(ChatDomainError);
      expect(() => ChatRoomId.create(Infinity)).toThrow(ChatDomainError);
    });
  });

  describe('generate', () => {
    it('一時的なIDを生成できる', () => {
      const id = ChatRoomId.generate();
      expect(typeof id.value).toBe('number');
      expect(id.value).toBeGreaterThan(0);
    });

    it('異なるIDが生成される', () => {
      const id1 = ChatRoomId.generate();
      const id2 = ChatRoomId.generate();
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('equals', () => {
    it('同じ値の ChatRoomId は等しい', () => {
      const id1 = ChatRoomId.create(1);
      const id2 = ChatRoomId.create(1);
      expect(id1.equals(id2)).toBe(true);
    });

    it('異なる値の ChatRoomId は等しくない', () => {
      const id1 = ChatRoomId.create(1);
      const id2 = ChatRoomId.create(2);
      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('数値を文字列として返す', () => {
      const id = ChatRoomId.create(123);
      expect(id.toString()).toBe('123');
    });
  });
});
