/**
 * 統合テスト用の簡易サーバー
 * Express + React Router統合の動作確認用
 */

import { createServer } from 'node:http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { configureHelmet, logSecurityEvents, rateLimit } from './api/middlewares/security';
// ミドルウェア
import { configureSession } from './api/middlewares/session';

// 環境変数
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
// Codespaces環境の検出
const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  // Codespaces URLs
  ...(CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? [
        `https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        `https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        `https://${CODESPACE_NAME}-3002.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        `https://${CODESPACE_NAME}-3003.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        `https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        `https://${CODESPACE_NAME}-5174.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
      ]
    : []),
];

const isDevelopment = NODE_ENV === 'development';

// Express アプリケーション作成
const app = express();

// セキュリティミドルウェア設定（統合テスト用に緩和）
app.use(logSecurityEvents);

// CORS設定（セキュリティ強化版）
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://urban-doodle-5x75p64gqw7274qj-5173.app.github.dev',
  'https://urban-doodle-5x75p64gqw7274qj-3000.app.github.dev',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`[CORS] Request from origin: ${origin}, method: ${req.method}, path: ${req.path}`);

  // セキュリティ強化：固定値のみを使用
  let corsOrigin: string | undefined;
  
  if (!origin) {
    // originがない場合は固定値を設定
    corsOrigin = 'null';
  } else {
    // 許可リストから一致するオリジンを検索
    for (const allowedOrigin of ALLOWED_ORIGINS) {
      if (origin === allowedOrigin) {
        corsOrigin = allowedOrigin; // 固定値を使用
        break;
      }
    }
    
    // 開発環境で許可リストに含まれていない場合
    if (!corsOrigin && process.env.NODE_ENV === 'development') {
      // localhost の場合はデフォルトの開発用オリジンを使用
      if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
        corsOrigin = 'http://localhost:5173'; // 固定値
      }
    }
  }

  if (corsOrigin) {
    res.header('Access-Control-Allow-Origin', corsOrigin);
  } else {
    console.warn(`[CORS] Blocked unauthorized origin: ${origin}`);
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie, Set-Cookie'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling preflight request');
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(configureHelmet({ corsOrigins: CORS_ORIGINS, isDevelopment }));
app.use(rateLimit(100, 15 * 60 * 1000));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// セッション設定
app.use(
  configureSession({
    secret: SESSION_SECRET,
    redisUrl: REDIS_URL,
    secure: !isDevelopment,
    maxAge: 24 * 60 * 60 * 1000,
  })
);

// API ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    session: req.session ? 'initialized' : 'not-initialized',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'nanika-game-integration-server',
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// 認証APIテスト
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === 'admin@example.com' && password === 'admin123') {
      // セッションに認証情報を保存
      if (req.session) {
        req.session.userId = 'user1';
        req.session.email = email;
        req.session.isAuthenticated = true;
        req.session.createdAt = new Date();
        req.session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      res.json({
        success: true,
        data: {
          user: { id: 'user1', email },
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
});

app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
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
  } else {
    res.json({
      success: true,
      message: 'セッションが見つかりませんでした',
    });
  }
});

// セッション確認API
app.get('/api/auth/me', (req, res) => {
  if (req.session?.isAuthenticated) {
    res.json({
      success: true,
      data: {
        user: {
          id: req.session.userId,
          email: req.session.email,
        },
      },
    });
  } else {
    res.status(401).json({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: '認証が必要です',
      },
    });
  }
});

// チャット API (認証チェック簡易版)
app.get('/api/chat/rooms', (req, res) => {
  if (!req.session?.isAuthenticated) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: '認証が必要です',
      },
    });
  }

  res.json({
    success: true,
    data: [
      { id: 'room1', name: 'General Chat', memberCount: 5 },
      { id: 'room2', name: 'Game Discussion', memberCount: 12 },
    ],
  });
});

// HTTP サーバー作成
const httpServer = createServer(app);

// WebSocket サーバー設定
const io = new SocketServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// WebSocket 認証と接続処理（統合テスト用に簡略化）
io.use(async (socket, next) => {
  try {
    // 統合テスト用に認証を簡略化
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.log('WebSocket: No auth token provided');
      return next(new Error('WEBSOCKET_AUTH_FAILED'));
    }

    // 簡単なトークン検証（テスト用）
    if (typeof token === 'string' && token.length > 0) {
      console.log(`WebSocket: Auth successful for token: ${token}`);
      socket.userId = token; // ユーザーIDをソケットに保存
      next();
    } else {
      console.log('WebSocket: Invalid token format');
      return next(new Error('WEBSOCKET_AUTH_FAILED'));
    }
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    next(new Error('WEBSOCKET_AUTH_FAILED'));
  }
});

io.on('connection', (socket) => {
  console.log(`WebSocket client connected: ${socket.id}, userId: ${socket.userId}`);

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { userId: socket.userId || socket.id });
    console.log(`Socket ${socket.id} (user: ${socket.userId}) joined room ${roomId}`);
  });

  socket.on('send-message', (data) => {
    const { roomId, message, userId } = data;
    const messageData = {
      id: Date.now(),
      content: message,
      userId: userId || socket.userId,
      timestamp: new Date().toISOString(),
    };

    console.log(`Message sent to room ${roomId}:`, messageData);

    // ルーム内の他のクライアントにメッセージを送信
    socket.to(roomId).emit('new-message', messageData);

    // 送信者にも確認メッセージ（オプション）
    socket.emit('message-sent', { success: true, message: messageData });
  });

  socket.on('disconnect', () => {
    console.log(`WebSocket client disconnected: ${socket.id} (user: ${socket.userId})`);
  });
});

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
  console.log(`🚀 Integration Server running on port ${PORT}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 WebSocket ready on port ${PORT}`);
  console.log(`🍪 Session store: ${REDIS_URL ? 'Redis' : 'Memory'}`);
  console.log(`🌐 CORS Origins:`);
  CORS_ORIGINS.forEach((origin) => console.log(`   - ${origin}`));
  console.log(`🧪 Test endpoints:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   GET  /api/chat/rooms`);

  if (CODESPACE_NAME) {
    console.log(`\n📱 Codespaces URLs:`);
    console.log(
      `   🖥️  Frontend: https://${CODESPACE_NAME}-5174.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    );
    console.log(
      `   🔧 Backend:  https://${CODESPACE_NAME}-3003.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    );
    console.log(
      `   🧪 Test:     https://${CODESPACE_NAME}-5174.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}/simple-test.html`
    );
  }
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
