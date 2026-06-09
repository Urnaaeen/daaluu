import io from 'socket.io-client';

const SOCKET_URL = 'http://YOUR_IP:3000'; // Өөрийн IP-ээ оруулах

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};