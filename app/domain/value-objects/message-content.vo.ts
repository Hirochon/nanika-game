import { ChatDomainError } from '../../shared/errors/chat.error';

export class MessageContent {
  private static readonly MAX_LENGTH = 10000;
  private static readonly MIN_LENGTH = 1;

  private constructor(private readonly _value: string) {
    this.validate();
  }

  static create(value: string): MessageContent {
    return new MessageContent(value);
  }

  get value(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  private validate(): void {
    if (!this._value || typeof this._value !== 'string') {
      throw new ChatDomainError('メッセージ内容は文字列である必要があります');
    }

    const trimmed = this._value.trim();
    if (trimmed.length < MessageContent.MIN_LENGTH) {
      throw new ChatDomainError('メッセージは空にできません');
    }

    if (this._value.length > MessageContent.MAX_LENGTH) {
      throw new ChatDomainError(
        `メッセージは${MessageContent.MAX_LENGTH}文字以内で入力してください`
      );
    }
  }

  // HTMLエスケープされたコンテンツを取得
  sanitized(): string {
    return this._value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 検索用の正規化されたコンテンツ
  normalized(): string {
    return this._value.toLowerCase().trim();
  }

  // メンション、URL、絵文字などを含むかチェック
  containsMention(): boolean {
    return /@\w+/.test(this._value);
  }

  containsUrl(): boolean {
    return /https?:\/\/[^\s]+/.test(this._value);
  }

  // 文字数制限チェック
  isWithinLimit(): boolean {
    return this._value.length <= MessageContent.MAX_LENGTH;
  }

  equals(other: MessageContent): boolean {
    return this._value === other._value;
  }
}
