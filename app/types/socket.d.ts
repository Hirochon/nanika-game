import 'socket.io';

declare module 'socket.io' {
  interface Socket {
    userId?: number;
    userEmail?: string;
    userName?: string;
  }
}

declare module 'socket.io-client' {
  interface Socket {
    connecting?: boolean;
  }
}
