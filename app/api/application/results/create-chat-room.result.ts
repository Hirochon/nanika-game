export interface CreateChatRoomResult {
  readonly id: number;
  readonly type: 'DIRECT' | 'GROUP';
  readonly name: string | null;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly memberCount: number;
}
