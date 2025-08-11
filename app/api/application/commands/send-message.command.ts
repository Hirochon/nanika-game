export interface SendMessageCommand {
  readonly chatRoomId: number;
  readonly senderId: number;
  readonly content: string;
  readonly messageType?: 'TEXT' | 'IMAGE' | 'FILE';
}
