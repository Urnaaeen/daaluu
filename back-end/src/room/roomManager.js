const Room = require('./room');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomCode() {
    // 4 оронтой код үүсгэх
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  createRoom(hostSocketId, hostName) {
    const code = this.generateRoomCode();
    const room = new Room(code, hostSocketId, hostName);
    
    this.rooms.set(code, room);
    
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  joinRoom(code, socketId, playerName) {
    const room = this.rooms.get(code);
    
    if (!room) {
      return { success: false, error: 'Room олдсонгүй' };
    }

    if (room.players.length >= 5) {
      return { success: false, error: 'Room дүүрсэн байна' };
    }

    if (room.gameStarted) {
      return { success: false, error: 'Тоглоом эхэлсэн байна' };
    }

    room.addPlayer(socketId, playerName);
    
    return { success: true, room };
  }

  removePlayer(socketId) {
    for (const [code, room] of this.rooms.entries()) {
      const player = room.players.find(p => p.socketId === socketId);
      
      if (player) {
        room.removePlayer(socketId);
        return room;
      }
    }
    
    return null;
  }

  deleteRoom(code) {
    this.rooms.delete(code);
  }

  getRoomCount() {
    return this.rooms.size;
  }
}

module.exports = RoomManager;