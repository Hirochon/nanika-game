export type CreateChatRoomCommand = {
  readonly type: 'DIRECT' | 'GROUP';
  readonly creatorId: number;
  readonly memberIds: number[];
  readonly name?: string;
  readonly description?: string;
};
