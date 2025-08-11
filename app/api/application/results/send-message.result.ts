export interface SendMessageResult {
  readonly id: number;
  readonly chatRoomId: number;
  readonly senderId: number;
  readonly content: string;
  readonly messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  readonly sentAt: Date;
  readonly editedAt: Date | null;
  readonly isDeleted: boolean;
  readonly isEdited: boolean;
}
