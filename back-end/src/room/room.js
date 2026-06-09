const { createDeck, shuffle, deal5 } = require('../game/deck');

class Room {
  constructor(code, hostSocketId, hostName) {
    this.code = code;
    this.players = [
      {
        socketId: hostSocketId,
        name: hostName,
        index: 0,
        isHost: true,
        stars: 0,
        tsai: 2,
        avlaga: 0,
        uglug: 0
      }
    ];
    this.gameStarted = false;
    this.gameState = null;
  }

  addPlayer(socketId, playerName) {
    const index = this.players.length;
    
    this.players.push({
      socketId,
      name: playerName,
      index,
      isHost: false,
      stars: 0,
      tsai: 2,
      avlaga: 0,
      uglug: 0
    });
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.socketId !== socketId);
  }

  startGame() {
    if (this.players.length !== 5) {
      return { success: false, error: '5 тоглогч шаардлагатай' };
    }

    this.gameStarted = true;
    
    // Модууд хуваах
    const deck = createDeck();
    const hands = deal5(deck);
    
    this.gameState = {
      hands: hands.map((hand, index) => ({
        playerIndex: index,
        tiles: hand
      })),
      center: [],
      roundMoves: [],
      currentPlayerIndex: 0,
      roundInProgress: true
    };

    return { success: true };
  }

  playTiles(socketId, tiles) {
    if (!this.gameStarted) {
      return { success: false, error: 'Тоглоом эхлээгүй байна' };
    }

    const player = this.players.find(p => p.socketId === socketId);
    
    if (!player) {
      return { success: false, error: 'Тоглогч олдсонгүй' };
    }

    if (player.index !== this.gameState.currentPlayerIndex) {
      return { success: false, error: 'Таны ээлж биш байна' };
    }

    // TODO: Validate move, update game state
    // Энэ хэсгийг PlayScreen.tsx логикоор бичнэ

    return { success: true };
  }

  toJSON() {
    return {
      code: this.code,
      players: this.players,
      gameStarted: this.gameStarted,
      gameState: this.gameState
    };
  }
}

module.exports = Room;