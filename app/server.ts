/**
 * Express + React Router統合サーバー
 * チャット機能対応サーバー実装
 */

import 'reflect-metadata'; // DIコンテナ用
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import Redis from 'ioredis';
import { Server as SocketServer } from 'socket.io';
import { authenticateSession, optionalAuthentication } from './api/middlewares/auth';
import {
  commonSchemas,
  configureCors,
  configureHelmet,
  limitRequestSize,
  logSecurityEvents,
  rateLimit,
  sanitizeInput,
  validateContentType,
  validateSchema,
  validateSqlInjection,
  validateXSS,
} from './api/middlewares/security';
// ミドルウェア
import { configureSession, getSessionStats, validateSession } from './api/middlewares/session';

// 環境変数
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174', // 追加のViteポート
  'https://urban-doodle-5x75p64gqw7274qj-5173.app.github.dev', // GitHub Codespaces フロントエンド
  'https://urban-doodle-5x75p64gqw7274qj-3000.app.github.dev', // GitHub Codespaces バックエンド
];

const isDevelopment = NODE_ENV === 'development';

// Express アプリケーション作成
const app = express();

// Trust proxy (for reverse proxy environments)
if (!isDevelopment) {
  app.set('trust proxy', 1);
}

// セキュリティミドルウェア設定
app.use(logSecurityEvents);
app.use(configureCors(CORS_ORIGINS));
app.use(configureHelmet({ corsOrigins: CORS_ORIGINS, isDevelopment }));
app.use(rateLimit(10, 60 * 1000)); // 1分間で10リクエスト（テスト用厳しい制限）

// リクエストサイズ制限
app.use(limitRequestSize('10mb'));

// 入力検証とサニタイゼーション
app.use(validateXSS); // XSS検証を最初に実行
app.use(sanitizeInput);
app.use(validateSqlInjection);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// セッション設定
app.use(
  configureSession({
    secret: SESSION_SECRET,
    redisUrl: REDIS_URL,
    secure: !isDevelopment,
    maxAge: 24 * 60 * 60 * 1000, // 24時間
  })
);
app.use(validateSession);

// 静的ファイル配信
if (!isDevelopment) {
  app.use(
    express.static(path.join(process.cwd(), 'build/client'), {
      maxAge: '1h',
    })
  );
}

// API ヘルスチェック
app.get('/health', optionalAuthentication, (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    user: (req as any).user || null,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'nanika-game-api',
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// セッション統計情報
app.get('/api/session-stats', async (_req, res) => {
  try {
    const stats = await getSessionStats(REDIS_URL);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_STATS_ERROR',
        message: 'セッション統計の取得に失敗しました',
      },
    });
  }
});

// 認証API (ログイン/ログアウト)
app.post(
  '/api/auth/login',
  validateContentType,
  validateSchema(commonSchemas.userLogin),
  async (req, res) => {
    try {
      // TODO: 既存のログイン用例を統合
      // const loginUseCase = container.resolve<LoginUseCase>('LoginUseCase');
      // const result = await loginUseCase.execute(req.body);

      // 暫定的な実装 - テストユーザーの認証
      const { email, password } = req.body;

      // テストユーザーのデータ
      const testUsers = [
        { id: 1, email: 'admin@example.com', password: 'admin123', name: '管理者' },
        { id: 2, email: 'user1@example.com', password: 'password123', name: 'ユーザー1' },
        { id: 3, email: 'user2@example.com', password: 'password123', name: 'ユーザー2' },
        { id: 4, email: 'guest@example.com', password: 'guest123', name: 'ゲスト' },
      ];

      // ユーザー認証
      const user = testUsers.find((u) => u.email === email && u.password === password);

      if (user) {
        // セッションに認証情報を保存
        req.session.userId = String(user.id);
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.isAuthenticated = true;
        req.session.createdAt = new Date();
        req.session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        res.json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
          },
        });
      } else {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'メールアドレスまたはパスワードが間違っています',
          },
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'ログイン処理中にエラーが発生しました',
        },
      });
    }
  }
);

app.post('/api/auth/logout', authenticateSession, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'ログアウト処理中にエラーが発生しました',
        },
      });
    }

    res.clearCookie('nanika.session.id');
    res.json({
      success: true,
      message: 'ログアウトしました',
    });
  });
});

// ユーザー検索API
app.get(
  '/api/users/search',
  optionalAuthentication,
  validateXSS, // ユーザー検索に特別なXSS検証を追加
  validateSchema(commonSchemas.userSearch),
  async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: '検索クエリが必要です',
          },
        });
      }

      // 追加のXSSチェック（二重チェック）
      const xssPatterns = [/javascript:/i, /<iframe/i, /<script/i];
      for (const pattern of xssPatterns) {
        if (pattern.test(q)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'XSS_DETECTED',
              message: '不正な入力が検出されました',
            },
          });
        }
      }

      // 暫定的なユーザーデータ（実際はDBから取得）
      const mockUsers = [
        { id: 1, name: '管理者', email: 'admin@example.com' },
        { id: 2, name: 'ユーザー1', email: 'user1@example.com' },
        { id: 3, name: 'ユーザー2', email: 'user2@example.com' },
        { id: 4, name: 'ゲスト', email: 'guest@example.com' },
      ];

      // メールアドレスまたは名前で検索
      const results = mockUsers.filter(
        (user) =>
          user.email.toLowerCase().includes(q.toLowerCase()) ||
          user.name.toLowerCase().includes(q.toLowerCase())
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('User search error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'ユーザー検索中にエラーが発生しました',
        },
      });
    }
  }
);

// チャット API - メモリ内にルームとメッセージを保存（開発用）
const chatRooms = new Map();
const chatMessages = new Map(); // roomId -> messages[]

// デフォルトのチャットルームを追加
chatRooms.set('room1', {
  id: 'room1',
  name: 'General Chat',
  memberCount: 5,
  type: 'GROUP',
  members: [
    { userId: 1, user: { id: 1, name: '管理者', email: 'admin@example.com' } },
    { userId: 2, user: { id: 2, name: 'ユーザー1', email: 'user1@example.com' } },
  ],
});
chatRooms.set('room2', {
  id: 'room2',
  name: 'Game Discussion',
  memberCount: 12,
  type: 'GROUP',
  members: [
    { userId: 1, user: { id: 1, name: '管理者', email: 'admin@example.com' } },
    { userId: 3, user: { id: 3, name: 'ユーザー2', email: 'user2@example.com' } },
  ],
});

// デフォルトのメッセージを追加
chatMessages.set('room1', [
  {
    id: 'msg-1',
    chatRoomId: 'room1',
    senderId: 2,
    content: 'こんにちは！',
    messageType: 'TEXT',
    sentAt: new Date(Date.now() - 3600000),
    isDeleted: false,
    sender: { id: 2, name: 'ユーザー1', email: 'user1@example.com' },
  },
  {
    id: 'msg-2',
    chatRoomId: 'room1',
    senderId: 1,
    content: 'ようこそ！何かお手伝いできることはありますか？',
    messageType: 'TEXT',
    sentAt: new Date(Date.now() - 1800000),
    isDeleted: false,
    sender: { id: 1, name: '管理者', email: 'admin@example.com' },
  },
]);

chatMessages.set('room2', [
  {
    id: 'msg-3',
    chatRoomId: 'room2',
    senderId: 3,
    content: 'ゲームの話をしましょう！',
    messageType: 'TEXT',
    sentAt: new Date(Date.now() - 7200000),
    isDeleted: false,
    sender: { id: 3, name: 'ユーザー2', email: 'user2@example.com' },
  },
]);

app.get('/api/chat/rooms', optionalAuthentication, (_req, res) => {
  res.json({
    success: true,
    data: Array.from(chatRooms.values()),
  });
});

// チャットルームのメッセージ取得API
app.get('/api/chat/rooms/:roomId/messages', optionalAuthentication, (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = '50' } = req.query;

    console.log(`[API] Getting messages for room: ${roomId}, limit: ${limit}`);

    // ルームの存在確認
    if (!chatRooms.has(roomId)) {
      console.log(`[API] Room not found: ${roomId}`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'チャットルームが見つかりません',
        },
      });
    }

    // メッセージ取得
    const messages = chatMessages.get(roomId) || [];
    const limitNum = parseInt(limit as string, 10);
    const limitedMessages = messages.slice(-limitNum); // 最新のメッセージを取得

    console.log(`[API] Returning ${limitedMessages.length} messages for room ${roomId}`);

    res.json({
      success: true,
      data: limitedMessages,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_MESSAGES_ERROR',
        message: 'メッセージ取得中にエラーが発生しました',
      },
    });
  }
});

// チャットルーム作成API
app.post(
  '/api/chat/rooms',
  optionalAuthentication,
  validateContentType,
  validateSchema(commonSchemas.chatRoom),
  async (req, res) => {
    try {
      const { type, name, description, memberIds } = req.body;

      // バリデーション
      if (!type || !['DIRECT', 'GROUP'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: '無効なチャットタイプです',
          },
        });
      }

      if (type === 'GROUP' && !name) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NAME_REQUIRED',
            message: 'グループチャットには名前が必要です',
          },
        });
      }

      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MEMBERS_REQUIRED',
            message: 'メンバーを選択してください',
          },
        });
      }

      // 暫定的な実装（実際はDBに保存）
      const currentUserId = req.session?.userId || 'guest-user';
      const roomId = `room-${Date.now()}`;
      const newRoom = {
        id: roomId,
        type,
        name: name || (type === 'DIRECT' ? 'Direct Message' : 'New Group'),
        description: description || null,
        memberIds: [...memberIds, currentUserId],
        memberCount: memberIds.length + 1,
        createdAt: new Date(),
        createdBy: currentUserId,
      };

      // メモリ内のMapに保存
      chatRooms.set(roomId, newRoom);
      console.log('Created new chat room:', newRoom);
      console.log('Total chat rooms:', chatRooms.size);

      res.json({
        success: true,
        data: newRoom,
      });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ROOM_ERROR',
          message: 'チャットルーム作成中にエラーが発生しました',
        },
      });
    }
  }
);

// HTTP サーバー作成
const httpServer = createServer(app);

// WebSocket サーバー設定
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // 開発環境では全てのoriginを許可
      if (isDevelopment) {
        callback(null, true);
      } else if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['content-type', 'authorization'],
  },
  transports: ['websocket', 'polling'], // WebSocketとpollingの両方をサポート
});

// Redis WebSocket アダプター
try {
  const pubClient = new Redis(REDIS_URL);
  const subClient = new Redis(REDIS_URL);

  pubClient.on('error', (err) => console.error('Redis pub client error:', err));
  subClient.on('error', (err) => console.error('Redis sub client error:', err));

  // io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis adapter configured for WebSocket scaling');
} catch (error) {
  console.warn('Redis not available for WebSocket, running in single instance mode:', error);
}

// WebSocket 認証と接続処理
io.use(async (socket, next) => {
  console.log('[WebSocket Auth] New connection attempt from:', socket.handshake.address);
  console.log('[WebSocket Auth] Headers:', socket.handshake.headers);
  console.log('[WebSocket Auth] Auth data:', socket.handshake.auth);

  try {
    // 開発環境では認証をスキップ
    if (isDevelopment) {
      console.log('[WebSocket Auth] Development mode - skipping auth');
      return next();
    }

    // セッション確認 (簡易実装)
    const sessionId = socket.handshake.headers.cookie
      ?.split('; ')
      .find((c) => c.startsWith('nanika.session.id='))
      ?.split('=')[1];

    if (!sessionId) {
      console.log('[WebSocket Auth] No session ID found');
      return next(new Error('WEBSOCKET_AUTH_FAILED'));
    }

    // TODO: セッションストアから実際のセッション情報を取得
    console.log('[WebSocket Auth] Session ID found:', sessionId);
    next();
  } catch (error) {
    console.error('[WebSocket Auth] Authentication error:', error);
    next(new Error('WEBSOCKET_AUTH_FAILED'));
  }
});

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  console.log(`[WebSocket] Total connected clients: ${io.sockets.sockets.size}`);

  socket.on('room:join', (roomId: string) => {
    socket.join(roomId);
    socket.to(roomId).emit('room:joined', { roomId, member: { userId: socket.id } });
    console.log(`[WebSocket] Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('room:leave', (roomId: string) => {
    socket.leave(roomId);
    socket.to(roomId).emit('room:left', { roomId, userId: socket.id });
    console.log(`[WebSocket] Socket ${socket.id} left room ${roomId}`);
  });

  socket.on('message:send', (data) => {
    console.log(`[WebSocket] Message received from ${socket.id}:`, data);
    const { roomId, content, user } = data;

    // ユーザー情報が送信されていない場合のフォールバック
    const senderInfo = user || { id: 1, name: '不明なユーザー', email: 'unknown@example.com' };

    // メッセージを同じルームの他のユーザーに送信
    const message = {
      id: `msg-${Date.now()}`,
      chatRoomId: roomId,
      senderId: senderInfo.id,
      content,
      messageType: 'TEXT',
      sentAt: new Date(),
      isDeleted: false,
      sender: {
        id: senderInfo.id,
        name: senderInfo.name,
        email: senderInfo.email,
      },
    };

    // メッセージをメモリに保存
    if (!chatMessages.has(roomId)) {
      chatMessages.set(roomId, []);
    }
    chatMessages.get(roomId).push(message);
    console.log(
      `[WebSocket] Message saved to room ${roomId}, total messages: ${chatMessages.get(roomId).length}`
    );

    // 送信者を含む全員に送信
    io.to(roomId).emit('message:new', message);
    console.log(`[WebSocket] Message sent to room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`WebSocket client disconnected: ${socket.id}`);
  });
});

// React Router SSR ハンドラー（開発環境では Vite が処理）
if (!isDevelopment) {
  // プロダクション環境でのSSRハンドラー
  // const build = await import('../build/server/index.js');
  // const { createRequestHandler } = await import('@react-router/express');
  // app.all('*', createRequestHandler({ build: build as any }));

  // 開発環境では静的ファイルを提供
  app.use('*', (_req, res) => {
    res.status(404).send('Not found - production build not available');
  });
}

// エラーハンドリングミドルウェア
app.use(
  (error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express error:', error);

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isDevelopment ? error.message : 'サーバーエラーが発生しました',
      },
    });
  }
);

// サーバー起動
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 WebSocket ready on port ${PORT}`);
  console.log(`🍪 Session store: ${REDIS_URL ? 'Redis' : 'Memory'}`);
});

// グレースフルシャットダウン
const shutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
