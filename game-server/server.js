const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Өрөөнүүдийг хадгалах
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Шинэ хэрэглэгч холбогдлоо:', socket.id);

  // Өрөө үүсгэх
  socket.on('createRoom', ({ roomCode, playerName }) => {
    if (rooms.has(roomCode)) {
      socket.emit('error', { message: 'Энэ код аль хэдийн байна' });
      return;
    }

    const room = {
      code: roomCode,
      host: socket.id,
      players: [{
        id: socket.id,
        name: playerName,
        isHost: true
      }],
      gameState: null,
      isPlaying: false
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    
    socket.emit('roomCreated', { 
      roomCode, 
      players: room.players 
    });
    
    console.log(`Өрөө үүсгэсэн: ${roomCode}`);
  });

  // Өрөөнд холбогдох
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('error', { message: 'Өрөө олдсонгүй' });
      return;
    }

    if (room.isPlaying) {
      socket.emit('error', { message: 'Тоглоом аль хэдийн эхэлсэн байна' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Өрөө дүүрсэн байна' });
      return;
    }

    const newPlayer = {
      id: socket.id,
      name: playerName,
      isHost: false
    };

    room.players.push(newPlayer);
    socket.join(roomCode);

    // Бүх тоглогчдод мэдэгдэх
    io.to(roomCode).emit('playerJoined', {
      players: room.players,
      newPlayer
    });

    console.log(`${playerName} ${roomCode} өрөөнд орлоо`);
  });

  // Тоглоом эхлүүлэх
  socket.on('startGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    
    if (!room) return;
    if (room.host !== socket.id) {
      socket.emit('error', { message: 'Зөвхөн хост тоглоом эхлүүлнэ' });
      return;
    }

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Хоёр тоглогч хэрэгтэй' });
      return;
    }

    room.isPlaying = true;
    
    // Анхны тоглоомын state
    room.gameState = {
      board: Array(9).fill(null),
      currentPlayer: room.players[0].id,
      xIsNext: true
    };

    io.to(roomCode).emit('gameStarted', {
      gameState: room.gameState,
      players: room.players
    });
  });

  // Нүд дарах
  socket.on('makeMove', ({ roomCode, index }) => {
    const room = rooms.get(roomCode);
    
    if (!room || !room.gameState) return;
    
    const { board, currentPlayer, xIsNext } = room.gameState;
    
    // Дараалал шалгах
    if (currentPlayer !== socket.id) {
      socket.emit('error', { message: 'Таны дараалал биш' });
      return;
    }

    // Нүд эзэлсэн эсэхийг шалгах
    if (board[index]) {
      socket.emit('error', { message: 'Энэ нүд эзэлсэн байна' });
      return;
    }

    // Нүд дарах
    board[index] = xIsNext ? 'X' : 'O';
    
    // Хожигч шалгах
    const winner = calculateWinner(board);
    
    // Дараагийн тоглогч
    const nextPlayerIndex = room.players.findIndex(p => p.id === currentPlayer);
    const nextPlayer = room.players[(nextPlayerIndex + 1) % room.players.length];
    
    room.gameState = {
      board,
      currentPlayer: nextPlayer.id,
      xIsNext: !xIsNext,
      winner
    };

    // Бүх тоглогчдод мэдэгдэх
    io.to(roomCode).emit('gameUpdated', {
      gameState: room.gameState
    });
  });

  // Дахин тоглох
  socket.on('playAgain', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.gameState = {
      board: Array(9).fill(null),
      currentPlayer: room.players[0].id,
      xIsNext: true
    };

    io.to(roomCode).emit('gameReset', {
      gameState: room.gameState
    });
  });

  // Холболт тасрах
  socket.on('disconnect', () => {
    console.log('Хэрэглэгч тасарлаа:', socket.id);
    
    // Тоглогчийг бүх өрөөнөөс устгах
    rooms.forEach((room, roomCode) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // Өрөө хоосон бол устгах
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          // Бусад тоглогчдод мэдэгдэх
          io.to(roomCode).emit('playerLeft', {
            players: room.players
          });
        }
      }
    });
  });
});

// Хожигч тодорхойлох функц
function calculateWinner(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Хэвтээ
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Босоо
    [0, 4, 8], [2, 4, 6]             // Диагональ
  ];
  
  for (let [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ажиллаж байна port ${PORT} дээр`);
});