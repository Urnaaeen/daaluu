const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { instrument } = require('@socket.io/admin-ui');
const cors = require('cors');
const RoomManager = require('./src/room/roomManager');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://admin.socket.io"],
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// ⬇️⬇️⬇️ ADMIN UI ⬇️⬇️⬇️
instrument(io, {
  auth: false,
  mode: 'development'
});

const roomManager = new RoomManager();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: roomManager.getRoomCount(),
    uptime: process.uptime()
  });
});

// Get all rooms
app.get('/rooms', (req, res) => {
  const rooms = [];
  for (const [code, room] of roomManager.rooms.entries()) {
    rooms.push({
      code: code,
      players: room.players.length,
      gameStarted: room.gameStarted
    });
  }
  res.json({ rooms });
});

io.on('connection', (socket) => {
  console.log(`🟢 Тоглогч холбогдлоо: ${socket.id}`);

  socket.on('createRoom', (playerName, callback) => {
    try {
      const room = roomManager.createRoom(socket.id, playerName);
      socket.join(room.code);
      
      console.log(`🎲 Room үүсгэгдлээ: ${room.code} (${playerName})`);
      
      callback({
        success: true,
        roomCode: room.code,
        roomData: room.toJSON()
      });
    } catch (error) {
      console.error('❌ createRoom алдаа:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // ========== ROOM-Д ОРОХ ==========
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    try {
      const result = roomManager.joinRoom(roomCode, socket.id, playerName);
      
      if (result.success) {
        socket.join(roomCode);
        
        io.to(roomCode).emit('roomUpdated', result.room.toJSON());
        
        console.log(`✅ ${playerName} room-д орлоо: ${roomCode} (${result.room.players.length}/5)`);
        
        callback({
          success: true,
          roomData: result.room.toJSON()
        });

        // 5 тоглогч болсон эсэх
        if (result.room.players.length === 5) {
          console.log(`🎮 5 тоглогч бүрэн! Тоглоом эхэллээ: ${roomCode}`);
          
          // Тоглоом эхлүүлэх
          setTimeout(() => {
            result.room.startGame();
            io.to(roomCode).emit('gameStarted', result.room.toJSON());
          }, 2000);
        }
      } else {
        callback({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('❌ joinRoom алдаа:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // ========== МОД ГАРГАХ ==========
  socket.on('playTiles', ({ roomCode, tiles }, callback) => {
    try {
      const room = roomManager.getRoom(roomCode);
      
      if (!room) {
        return callback({ success: false, error: 'Room олдсонгүй' });
      }

      const result = room.playTiles(socket.id, tiles);
      
      if (result.success) {
        // Бүх тоглогчдод broadcast
        io.to(roomCode).emit('gameStateUpdated', room.toJSON());
        
        console.log(`🎴 Мод гарсан: Room ${roomCode}`);
        
        callback({ success: true });
      } else {
        callback({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('❌ playTiles алдаа:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // ========== ROUND ДУУССАН ==========
  socket.on('roundEnd', ({ roomCode, winner, scores }, callback) => {
    try {
      const room = roomManager.getRoom(roomCode);
      
      if (!room) {
        return callback({ success: false, error: 'Room олдсонгүй' });
      }

      // Оноо шинэчлэх
      room.updateScores(scores);
      
      // Бүх тоглогчдод мэдэгдэх
      io.to(roomCode).emit('roundEnded', {
        winner,
        scores: room.players
      });

      console.log(`🏆 Round дууслаа: Room ${roomCode}, Ялагч: ${winner}`);
      
      callback({ success: true });
    } catch (error) {
      console.error('❌ roundEnd алдаа:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // ========== ТОГЛООМ ДУУССАН ==========
  socket.on('gameEnd', ({ roomCode, finalScores }, callback) => {
    try {
      const room = roomManager.getRoom(roomCode);
      
      if (!room) {
        return callback({ success: false, error: 'Room олдсонгүй' });
      }

      // Бүх тоглогчдод мэдэгдэх
      io.to(roomCode).emit('gameEnded', { finalScores });

      console.log(`🎊 Тоглоом дууслаа: Room ${roomCode}`);
      
      callback({ success: true });

      // Room устгах (30 секундын дараа)
      setTimeout(() => {
        roomManager.deleteRoom(roomCode);
        console.log(`🗑️ Room устгагдлаа: ${roomCode}`);
      }, 30000);
    } catch (error) {
      console.error('❌ gameEnd алдаа:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // ========== DISCONNECT ==========
  socket.on('disconnect', () => {
    console.log(`🔴 Тоглогч салсан: ${socket.id}`);
    
    const room = roomManager.removePlayer(socket.id);
    
    if (room) {
      console.log(`👋 Room ${room.code}-аас тоглогч салсан`);
      
      io.to(room.code).emit('playerLeft', {
        playerId: socket.id,
        roomData: room.toJSON()
      });
      
      // Room хоослосон бол устгах
      if (room.players.length === 0) {
        roomManager.deleteRoom(room.code);
        console.log(`🗑️ Room устгагдлаа: ${room.code} (хоосон)`);
      }
    }
  });

  // ========== PING/PONG (Connection check) ==========
  socket.on('ping', (callback) => {
    callback({ pong: true, timestamp: Date.now() });
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`

║  🚀 MONGOLIAN CARD GAME SERVER             ║
║  📡 http://localhost:${PORT}                ║
║  🎮 Admin: https://admin.socket.io        ║
║  ✅ Status: Running                        ║
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️  SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
});