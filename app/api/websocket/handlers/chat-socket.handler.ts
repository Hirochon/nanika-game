import type { Server as SocketIOServer } from 'socket.io';
import type { IChatRoomRepository } from '../../../../domain/repositories/chat-room.repository';
import type { IMessageRepository } from '../../../../domain/repositories/message.repository';
import { ChatRoomId } from '../../../../domain/value-objects/chat-room-id.vo';
import { MessageId } from '../../../../domain/value-objects/message-id.vo';
import { UserId } from '../../../../domain/value-objects/user-id.vo';
import type { SendMessageUseCase } from '../../../application/use-cases/send-message.use-case';

export class ChatSocketHandler {
  constructor(
    private readonly chatRoomRepository: IChatRoomRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly sendMessageUseCase: SendMessageUseCase
  ) {}

  async handleJoinRoom(socket: any, data: { roomId: number }, _io: SocketIOServer): Promise<void> {
    const { roomId } = data;
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    // チャットルームの存在確認
    const chatRoom = await this.chatRoomRepository.findById(ChatRoomId.create(roomId));
    if (!chatRoom) {
      socket.emit('error', {
        code: 'ROOM_NOT_FOUND',
        message: 'チャットルームが見つかりません',
      });
      return;
    }

    // アクセス権限の確認
    if (!chatRoom.canSendMessage(UserId.create(userId))) {
      socket.emit('error', {
        code: 'ROOM_ACCESS_DENIED',
        message: 'このチャットルームへのアクセス権限がありません',
      });
      return;
    }

    // Socket.ioのルームに参加
    await socket.join(`room_${roomId}`);

    // 最新メッセージの取得（最新20件）
    const recentMessages = chatRoom.messages
      .filter((m) => !m.isDeleted)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .slice(-20)
      .map((message) => ({
        id: message.id.value,
        content: message.getDisplayContent(),
        messageType: message.messageType,
        sender: {
          id: message.senderId.value,
          name: 'Unknown User', // 実際の実装では送信者名を取得
        },
        sentAt: message.sentAt.toISOString(),
        editedAt: message.editedAt?.toISOString(),
        isDeleted: message.isDeleted,
      }));

    // メンバー一覧の取得
    const members = chatRoom.members
      .filter((m) => m.isActive)
      .map((member) => ({
        id: member.id.value,
        userId: member.userId.value,
        userName: 'Unknown User', // 実際の実装ではユーザー名を取得
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        lastReadAt: member.lastReadAt?.toISOString(),
        isActive: member.isActive,
      }));

    // 参加成功をクライアントに通知
    socket.emit('join_room_success', {
      roomId,
      members,
      recentMessages,
    });

    // 他のメンバーにユーザー参加を通知
    socket.to(`room_${roomId}`).emit('user_joined', {
      roomId,
      member: {
        userId,
        userName,
        joinedAt: new Date().toISOString(),
      },
    });

    console.log(`User ${userName} (${userId}) joined room ${roomId}`);
  }

  async handleLeaveRoom(socket: any, data: { roomId: number }, _io: SocketIOServer): Promise<void> {
    const { roomId } = data;
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    // Socket.ioのルームから退出
    await socket.leave(`room_${roomId}`);

    // 他のメンバーにユーザー退出を通知
    socket.to(`room_${roomId}`).emit('user_left', {
      roomId,
      userId,
    });

    console.log(`User ${userName} (${userId}) left room ${roomId}`);
  }

  async handleSendMessage(
    socket: any,
    data: {
      roomId: number;
      content: string;
      messageType?: 'TEXT' | 'IMAGE' | 'FILE';
      tempId?: string;
    },
    _io: SocketIOServer
  ): Promise<void> {
    const { roomId, content, messageType = 'TEXT', tempId } = data;
    const userId = socket.data.userId;

    try {
      // メッセージ送信ユースケースを実行
      const result = await this.sendMessageUseCase.execute({
        chatRoomId: roomId,
        senderId: userId,
        content,
        messageType,
      });

      // 送信者にメッセージ送信成功を通知
      socket.emit('message_sent', {
        tempId,
        message: {
          id: result.id,
          content: result.content,
          messageType: result.messageType,
          sender: {
            id: result.senderId,
            name: socket.data.userName,
          },
          sentAt: result.sentAt.toISOString(),
          editedAt: result.editedAt?.toISOString(),
          isDeleted: result.isDeleted,
        },
      });

      // ルーム内の他のメンバーにメッセージを配信
      socket.to(`room_${roomId}`).emit('message_received', {
        roomId,
        message: {
          id: result.id,
          content: result.content,
          messageType: result.messageType,
          sender: {
            id: result.senderId,
            name: socket.data.userName,
          },
          sentAt: result.sentAt.toISOString(),
          editedAt: result.editedAt?.toISOString(),
          isDeleted: result.isDeleted,
        },
      });

      console.log(`Message sent in room ${roomId} by user ${userId}`);
    } catch (error) {
      // エラーを送信者に通知
      socket.emit('message_error', {
        tempId,
        error: {
          code: 'SEND_MESSAGE_FAILED',
          message: error instanceof Error ? error.message : 'メッセージの送信に失敗しました',
        },
      });

      throw error;
    }
  }

  async handleEditMessage(
    socket: any,
    data: {
      roomId: number;
      messageId: number;
      content: string;
    },
    io: SocketIOServer
  ): Promise<void> {
    const { roomId, messageId, content } = data;
    const userId = socket.data.userId;

    // メッセージの取得
    const message = await this.messageRepository.findById(MessageId.create(messageId));
    if (!message) {
      socket.emit('error', {
        code: 'MESSAGE_NOT_FOUND',
        message: 'メッセージが見つかりません',
      });
      return;
    }

    // 編集権限の確認
    if (!message.canEdit(UserId.create(userId))) {
      socket.emit('error', {
        code: 'MESSAGE_EDIT_DENIED',
        message: 'このメッセージを編集する権限がありません',
      });
      return;
    }

    // メッセージ編集
    message.edit(content, UserId.create(userId));
    await this.messageRepository.save(message);

    // ルーム内の全メンバーに編集を通知
    io.to(`room_${roomId}`).emit('message_edited', {
      roomId,
      message: {
        id: message.id.value,
        content: message.getDisplayContent(),
        messageType: message.messageType,
        sender: {
          id: message.senderId.value,
          name: socket.data.userName,
        },
        sentAt: message.sentAt.toISOString(),
        editedAt: message.editedAt?.toISOString(),
        isDeleted: message.isDeleted,
      },
    });

    console.log(`Message ${messageId} edited by user ${userId}`);
  }

  async handleDeleteMessage(
    socket: any,
    data: {
      roomId: number;
      messageId: number;
    },
    io: SocketIOServer
  ): Promise<void> {
    const { roomId, messageId } = data;
    const userId = socket.data.userId;

    // メッセージの取得
    const message = await this.messageRepository.findById(MessageId.create(messageId));
    if (!message) {
      socket.emit('error', {
        code: 'MESSAGE_NOT_FOUND',
        message: 'メッセージが見つかりません',
      });
      return;
    }

    // 削除権限の確認
    if (!message.canDelete(UserId.create(userId))) {
      socket.emit('error', {
        code: 'MESSAGE_DELETE_DENIED',
        message: 'このメッセージを削除する権限がありません',
      });
      return;
    }

    // メッセージ削除（論理削除）
    message.delete(UserId.create(userId));
    await this.messageRepository.save(message);

    // ルーム内の全メンバーに削除を通知
    io.to(`room_${roomId}`).emit('message_deleted', {
      roomId,
      messageId,
      deletedAt: new Date().toISOString(),
    });

    console.log(`Message ${messageId} deleted by user ${userId}`);
  }

  // Phase 2 機能
  async handleTypingStart(
    socket: any,
    data: { roomId: number },
    _io: SocketIOServer
  ): Promise<void> {
    const { roomId } = data;
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    // ルーム内の他のメンバーにタイピング開始を通知
    socket.to(`room_${roomId}`).emit('user_typing', {
      roomId,
      userId,
      userName,
      isTyping: true,
    });
  }

  async handleTypingStop(
    socket: any,
    data: { roomId: number },
    _io: SocketIOServer
  ): Promise<void> {
    const { roomId } = data;
    const userId = socket.data.userId;
    const userName = socket.data.userName;

    // ルーム内の他のメンバーにタイピング停止を通知
    socket.to(`room_${roomId}`).emit('user_typing', {
      roomId,
      userId,
      userName,
      isTyping: false,
    });
  }

  async handleMarkAsRead(
    socket: any,
    data: {
      roomId: number;
      messageId: number;
    },
    _io: SocketIOServer
  ): Promise<void> {
    const { roomId, messageId } = data;
    const userId = socket.data.userId;

    // 実装は Phase 2 で詳細化
    // 既読機能の実装

    // ルーム内の他のメンバーに既読を通知
    socket.to(`room_${roomId}`).emit('message_read', {
      roomId,
      userId,
      lastReadMessageId: messageId,
      readAt: new Date().toISOString(),
    });
  }

  async handleUserDisconnected(socket: any, _io: SocketIOServer): Promise<void> {
    const userId = socket.data.userId;

    // ユーザーが参加していた全ルームから退出通知を送信
    const rooms = Array.from(socket.rooms);

    for (const room of rooms) {
      if (room.startsWith('room_')) {
        const roomId = room.replace('room_', '');
        socket.to(room).emit('user_left', {
          roomId: parseInt(roomId),
          userId,
        });
      }
    }
  }
}
