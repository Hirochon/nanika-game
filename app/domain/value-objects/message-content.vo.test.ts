import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/errors/domain.error';
import { MessageContent } from './message-content.vo';

describe('MessageContent', () => {
  describe('create', () => {
    it('有効なメッセージ内容で MessageContent を作成できる', () => {
      const content = MessageContent.create('テストメッセージ');
      expect(content.value).toBe('テストメッセージ');
    });

    it('最大文字数のメッセージを作成できる', () => {
      const longMessage = 'a'.repeat(10000);
      const content = MessageContent.create(longMessage);
      expect(content.length).toBe(10000);
    });

    it('空文字列でエラーがスローされる', () => {
      expect(() => MessageContent.create('')).toThrow(DomainError);
    });

    it('スペースのみの文字列でエラーがスローされる', () => {
      expect(() => MessageContent.create('   ')).toThrow(DomainError);
      expect(() => MessageContent.create('\t\n')).toThrow(DomainError);
    });

    it('null や undefined でエラーがスローされる', () => {
      expect(() => MessageContent.create(null as any)).toThrow(DomainError);
      expect(() => MessageContent.create(undefined as any)).toThrow(DomainError);
    });

    it('文字列以外でエラーがスローされる', () => {
      expect(() => MessageContent.create(123 as any)).toThrow(DomainError);
      expect(() => MessageContent.create({} as any)).toThrow(DomainError);
    });

    it('最大文字数を超えるとエラーがスローされる', () => {
      const tooLongMessage = 'a'.repeat(10001);
      expect(() => MessageContent.create(tooLongMessage)).toThrow(DomainError);
      expect(() => MessageContent.create(tooLongMessage)).toThrow(
        'メッセージは10000文字以内で入力してください'
      );
    });
  });

  describe('length', () => {
    it('メッセージの長さを返す', () => {
      const content = MessageContent.create('テスト');
      expect(content.length).toBe(3);
    });
  });

  describe('sanitized', () => {
    it('HTMLタグがエスケープされる', () => {
      const content = MessageContent.create('<script>alert("xss")</script>');
      const sanitized = content.sanitized();
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('特殊文字がエスケープされる', () => {
      const content = MessageContent.create('&<>"\'');
      const sanitized = content.sanitized();
      expect(sanitized).toBe('&amp;&lt;&gt;&quot;&#039;');
    });

    it('通常の文字列は変更されない', () => {
      const content = MessageContent.create('普通のメッセージです');
      const sanitized = content.sanitized();
      expect(sanitized).toBe('普通のメッセージです');
    });
  });

  describe('normalized', () => {
    it('小文字に変換され、前後の空白が取り除かれる', () => {
      const content = MessageContent.create('  Hello World  ');
      const normalized = content.normalized();
      expect(normalized).toBe('hello world');
    });

    it('日本語は正規化される（小文字変換とトリム）', () => {
      const content = MessageContent.create('　こんにちは　');
      const normalized = content.normalized();
      expect(normalized).toBe('こんにちは'); // トリムされる
    });
  });

  describe('containsMention', () => {
    it('@付きのメンションを検出する', () => {
      const content = MessageContent.create('こんにちは @user123 さん');
      expect(content.containsMention()).toBe(true);
    });

    it('メンションがない場合は false を返す', () => {
      const content = MessageContent.create('普通のメッセージです');
      expect(content.containsMention()).toBe(false);
    });
  });

  describe('containsUrl', () => {
    it('HTTP URLを検出する', () => {
      const content = MessageContent.create('サイトはこちら http://example.com です');
      expect(content.containsUrl()).toBe(true);
    });

    it('HTTPS URLを検出する', () => {
      const content = MessageContent.create('サイトはこちら https://example.com です');
      expect(content.containsUrl()).toBe(true);
    });

    it('URLがない場合は false を返す', () => {
      const content = MessageContent.create('普通のメッセージです');
      expect(content.containsUrl()).toBe(false);
    });
  });

  describe('isWithinLimit', () => {
    it('制限内の場合は true を返す', () => {
      const content = MessageContent.create('短いメッセージ');
      expect(content.isWithinLimit()).toBe(true);
    });

    it('最大文字数ぴったりの場合は true を返す', () => {
      const content = MessageContent.create('a'.repeat(10000));
      expect(content.isWithinLimit()).toBe(true);
    });
  });

  describe('equals', () => {
    it('同じ内容の MessageContent は等しい', () => {
      const content1 = MessageContent.create('テスト');
      const content2 = MessageContent.create('テスト');
      expect(content1.equals(content2)).toBe(true);
    });

    it('異なる内容の MessageContent は等しくない', () => {
      const content1 = MessageContent.create('テスト1');
      const content2 = MessageContent.create('テスト2');
      expect(content1.equals(content2)).toBe(false);
    });
  });
});
