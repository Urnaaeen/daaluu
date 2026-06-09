// app/utils/gameService.ts
import { ref, set, get, onValue, update } from 'firebase/database';
import { database } from '../firebase';
import type { TileInstance } from '../types';

// ===== ROOM ҮҮСГЭХ =====
export const createRoom = async (roomCode: string, hostName: string) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  
  await set(roomRef, {
    host: hostName,
    players: {
      0: {
        name: hostName,
        isHost: true,
        isReady: false,
        connected: true,
        index: 0
      }
    },
    gameState: {
      started: false,
      currentPlayerIndex: 0,
      center: [],
      roundMoves: [],
      hands: {}
    },
    createdAt: Date.now()
  });
  
  console.log('✅ Room үүслээ:', roomCode);
  return roomCode;
};

// ===== ROOM-Д ХОЛБОГДОХ =====
export const joinRoom = async (roomCode: string, playerName: string) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  
  // Өрөө байгаа эсэхийг шалгах
  const snapshot = await get(roomRef);
  
  if (!snapshot.exists()) {
    throw new Error('Өрөө олдсонгүй');
  }
  
  const roomData = snapshot.val();
  const players = roomData.players || {};
  const playerCount = Object.keys(players).length;
  
  if (playerCount >= 5) {
    throw new Error('Өрөө дүүрсэн (5 тоглогч)');
  }
  
  // Шинэ тоглогч нэмэх
  const playerIndex = playerCount;
  await set(ref(database, `rooms/${roomCode}/players/${playerIndex}`), {
    name: playerName,
    isHost: false,
    isReady: false,
    connected: true,
    index: playerIndex
  });
  
  console.log('✅ Холбогдлоо:', playerName, 'Index:', playerIndex);
  return playerIndex;
};

// ===== REAL-TIME LISTENER =====
export const listenToRoom = (roomCode: string, callback: (data: any) => void) => {
  const roomRef = ref(database, `rooms/${roomCode}`);
  
  return onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
};

// ===== БЭЛЭН БОЛОХ =====
export const setPlayerReady = async (roomCode: string, playerIndex: number, ready: boolean) => {
  await set(
    ref(database, `rooms/${roomCode}/players/${playerIndex}/isReady`),
    ready
  );
  console.log(`✅ Тоглогч ${playerIndex} ${ready ? 'бэлэн' : 'бэлэн биш'}`);
};

// ===== ТОГЛООМ ЭХЛҮҮЛЭХ =====
export const startGame = async (roomCode: string, hands: TileInstance[][]) => {
  // Hands-г Firebase-д хадгалах формат руу хөрвүүлэх
  const handsObj: any = {};
  hands.forEach((hand, index) => {
    handsObj[index] = hand;
  });
  
  await update(ref(database, `rooms/${roomCode}/gameState`), {
    started: true,
    hands: handsObj
  });
  
  console.log('✅ Тоглоом эхэлсэн!');
};

// ===== МОД ГАРГАХ =====
export const playMove = async (
  roomCode: string,
  playerIndex: number,
  tiles: TileInstance[]
) => {
  const moveRef = ref(database, `rooms/${roomCode}/gameState/roundMoves/${Date.now()}`);
  
  await set(moveRef, {
    playerIndex,
    tiles,
    timestamp: Date.now()
  });
  
  console.log(`✅ Тоглогч ${playerIndex} мод гаргалаа`);
};

// ===== CENTER UPDATE =====
export const updateCenter = async (
  roomCode: string,
  newCenter: (TileInstance | TileInstance[])[]
) => {
  await set(
    ref(database, `rooms/${roomCode}/gameState/center`),
    newCenter
  );
};

// ===== CURRENT PLAYER UPDATE =====
export const updateCurrentPlayer = async (
  roomCode: string,
  playerIndex: number
) => {
  await set(
    ref(database, `rooms/${roomCode}/gameState/currentPlayerIndex`),
    playerIndex
  );
};

// ===== ROOM УСТГАХ =====
export const deleteRoom = async (roomCode: string) => {
  await set(ref(database, `rooms/${roomCode}`), null);
  console.log('🗑️ Room устгагдлаа:', roomCode);
};

// ===== HANDS UPDATE =====
export const updateHands = async (roomCode: string, hands: any) => {
  await set(
    ref(database, `rooms/${roomCode}/gameState/hands`),
    hands
  );
  console.log('✅ Hands update хийгдлээ');
};

// ===== ROUND MOVES UPDATE =====
export const addRoundMove = async (
  roomCode: string, 
  playerIndex: number, 
  tiles: TileInstance[]
) => {
  const moveRef = ref(database, `rooms/${roomCode}/gameState/roundMoves`);
  const snapshot = await get(moveRef);
  const currentMoves = snapshot.val() || [];
  
  const newMoves = [...currentMoves, { playerIndex, tiles }];
  
  await set(moveRef, newMoves);
  console.log(`✅ Round move ${newMoves.length}/5 хадгалагдлаа`);
  
  return newMoves.length;
};

export async function resetRound(roomCode: string) {
    try {
        await update(ref(database, `rooms/${roomCode}/gameState`), {
            center: [],        // ⬅️ null биш EMPTY ARRAY
            roundMoves: []     // ⬅️ null биш EMPTY ARRAY
        });
        console.log('✅ Round reset хийгдлээ');
    } catch (error) {
        console.error('❌ resetRound алдаа:', error);
    }
}

// ===== SCORE UPDATE =====
export const updatePlayerScore = async (
  roomCode: string,
  playerIndex: number,
  scoreType: 'stars' | 'tsai' | 'avlaga' | 'uglug',
  value: number
) => {
  const scoreRef = ref(database, `rooms/${roomCode}/players/${playerIndex}/${scoreType}`);
  await set(scoreRef, value);
};

export const updateAllScores = async (
  roomCode: string,
  scores: { [playerIndex: number]: { stars: number; tsai: number; avlaga: number; uglug: number } }
) => {
  const updates: any = {};
  
  Object.entries(scores).forEach(([index, score]) => {
    updates[`rooms/${roomCode}/players/${index}/stars`] = score.stars;
    updates[`rooms/${roomCode}/players/${index}/tsai`] = score.tsai;
    updates[`rooms/${roomCode}/players/${index}/avlaga`] = score.avlaga;
    updates[`rooms/${roomCode}/players/${index}/uglug`] = score.uglug;
  });
  
  await update(ref(database), updates);
  console.log('✅ Бүх оноо update хийгдлээ');
};

// ===== GAME END =====
export const setGameEnded = async (roomCode: string, ended: boolean) => {
  await set(ref(database, `rooms/${roomCode}/gameState/gameEnded`), ended);
};

function cleanTileData(tile: any): any {
    const cleaned: any = {};
    Object.keys(tile).forEach(key => {
        const value = tile[key];
        if (value !== undefined && typeof value !== 'function') {
            cleaned[key] = value;
        }
    });
    return cleaned;
}