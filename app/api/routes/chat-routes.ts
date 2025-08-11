import { Router } from 'express';
import { ChatRoomController } from '../controllers/chat-room.controller';
import { MessageController } from '../controllers/message.controller';

const router = Router();
const chatRoomController = new ChatRoomController();
const messageController = new MessageController();

// チャットルーム関連のルート
router.get('/chat/rooms', (req, res) => chatRoomController.getChatRooms(req, res));
router.post('/chat/rooms', (req, res) => chatRoomController.createChatRoom(req, res));
router.get('/chat/rooms/:roomId', (req, res) => chatRoomController.getChatRoomById(req, res));
router.put('/chat/rooms/:roomId', (req, res) => chatRoomController.updateChatRoom(req, res));

// メッセージ関連のルート
router.get('/chat/rooms/:roomId/messages', (req, res) => messageController.getMessages(req, res));
router.post('/chat/rooms/:roomId/messages', (req, res) => messageController.sendMessage(req, res));
router.put('/chat/rooms/:roomId/messages/:messageId', (req, res) =>
  messageController.editMessage(req, res)
);
router.delete('/chat/rooms/:roomId/messages/:messageId', (req, res) =>
  messageController.deleteMessage(req, res)
);

// メンバー管理のルート（将来実装）
// router.post('/chat/rooms/:roomId/members', ...)
// router.delete('/chat/rooms/:roomId/members/:userId', ...)
// router.put('/chat/rooms/:roomId/members/:userId/role', ...)
// router.post('/chat/rooms/:roomId/leave', ...)

export { router as chatRoutes };
