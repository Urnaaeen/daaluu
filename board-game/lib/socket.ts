import { io, type Socket } from "socket.io-client";
import { API_URL, getAuthToken } from "./api";

/**
 * Тоглолтын realtime холболт.
 * Сервер тоглогч бүрт ӨӨРИЙНХ нь төлөвийг илгээдэг тул
 * энд ирсэн `myHand` нь зөвхөн тухайн хэрэглэгчийнх.
 */

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  const token = getAuthToken();

  // Токен солигдсон бол хуучин холболтыг таслана
  if (socket && socket.auth && (socket.auth as any).token !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }

  if (!socket.connected) socket.connect();
  return socket;
};

export const closeSocket = () => {
  socket?.disconnect();
  socket = null;
};

export type MatchPlayer = {
  seat: number;
  name: string;
  playerCode: string | null;
  isBot: boolean;
  isHost: boolean;
  isMe: boolean;
  tsai: number;
  avlaga: number;
  uglug: number;
  ger: number;
  tilesLeft: number;
  place: number | null;
  finalScore: number | null;
};

export type MatchMove = {
  seat: number;
  tiles: string[];
  isSecret: boolean;
};

export type MatchState = {
  match: {
    id: string;
    mode: "random" | "friends";
    status: "lobby" | "playing" | "finished" | "abandoned";
    roundNo: number;
    maikhanNo: number;
    endRule: "single" | "hands10" | "tsai10" | "uglug6";
    currentSeat: number | null;
    turnDeadline: string | null;
    turnSeconds: number;
  };
  players: MatchPlayer[];
  moves: MatchMove[];
  mySeat: number | null;
  myHand: string[];
};

/* ─────────── Санамсаргүй тоглогчийн дараалал ─────────── */

export type QueuePlayer = {
  userId: string;
  name: string;
  playerCode: string;
};

export type QueueState = {
  players: QueuePlayer[];
  size: number;
  needed: number;
  endRule: string;
  /** Дараалалд эхэлж орсон хүн — зөвхөн тэр дүрмээ сонгоно */
  ownerId: string | null;
};

const emitAck = <T,>(event: string, payload?: unknown): Promise<T | null> =>
  new Promise((resolve) => {
    const socket = getSocket();
    let done = false;
    socket.emit(event, payload ?? {}, (res: T) => {
      done = true;
      resolve(res);
    });
    setTimeout(() => !done && resolve(null), 6000);
  });

export const queueJoin = () => emitAck<{ ok: boolean; state?: QueueState }>("queue:join");
export const queueLeave = () => emitAck<{ ok: boolean }>("queue:leave");
export const queueSetRule = (endRule: string) =>
  emitAck<{ ok: boolean; error?: string; state?: QueueState }>("queue:setRule", { endRule });
export const queueFillWithBots = () =>
  emitAck<{ ok: boolean; matchId?: string; error?: string }>("queue:fillWithBots");

/**
 * Дарааллын төлөв, тоглолт бүрдэх, алдааг сонсоно.
 * @returns салгах функц
 */
export const subscribeToQueue = (handlers: {
  onUpdate: (state: QueueState) => void;
  onMatched: (matchId: string) => void;
  onError?: (message: string) => void;
}): (() => void) => {
  const socket = getSocket();

  const onUpdate = (state: QueueState) => handlers.onUpdate(state);
  const onMatched = (payload: { matchId: string }) => handlers.onMatched(payload.matchId);
  const onError = (payload: { message?: string }) =>
    handlers.onError?.(payload?.message ?? "Алдаа гарлаа.");

  socket.on("queue:update", onUpdate);
  socket.on("queue:matched", onMatched);
  socket.on("queue:error", onError);

  return () => {
    socket.off("queue:update", onUpdate);
    socket.off("queue:matched", onMatched);
    socket.off("queue:error", onError);
  };
};

/** Тоглолтын өрөөнд нэгдэж, төлөв өөрчлөгдөх бүрт дуудагдана */
export const subscribeToMatch = (
  matchId: string,
  onState: (state: MatchState) => void
): (() => void) => {
  const s = getSocket();

  const handleState = (state: MatchState) => {
    if (state?.match?.id === matchId) onState(state);
  };

  s.on("match:state", handleState);

  const join = () => s.emit("match:join", matchId);
  join();
  // Холболт тасарч сэргэвэл дахин нэгдэнэ
  s.on("connect", join);

  return () => {
    s.off("match:state", handleState);
    s.off("connect", join);
    s.emit("match:leave", matchId);
  };
};
