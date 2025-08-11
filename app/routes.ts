import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('web/routes/home.tsx'),
  route('login', 'web/routes/login.tsx'),
  route('register', 'web/routes/register.tsx'),
  route('dashboard', 'web/routes/dashboard.tsx'),

  // チャット機能
  route('chat', 'web/routes/chat.tsx'),
  route('chat/new', 'web/routes/chat.new.tsx'),
  route('chat/:roomId', 'web/routes/chat.$roomId.tsx'),
] satisfies RouteConfig;
