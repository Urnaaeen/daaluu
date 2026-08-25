import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "./AuthContext";

/** Серверээс ирэх өрөө */
export type Room = {
  id: string;
  name: string;
  code: string;
  member_count: number;
  created_at: string;
};

export type RoomMember = {
  id: string;
  name: string;
  player_code: string;
  status: "invited" | "joined" | "removed";
};

export type CoinPack = {
  id: string;
  coins: number;
  price: number;
  bonus: string | null;
  rooms: number;
};

export type HistoryEntry = {
  match_id: string;
  mode: "random" | "friends";
  ended_at: string;
  place: number;
  final_score: number;
  tsai: number;
  avlaga: number;
  uglug: number;
  room_name: string | null;
  player_count: number;
};

type AppState = {
  playerName: string;
  playerId: string;
  coins: number;
  roomPrice: number;
  rooms: Room[];
  packs: CoinPack[];
  history: HistoryEntry[];
  loadingRooms: boolean;

  refreshRooms: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  /** Амжилттай бол null, эс бөгөөс алдааны текст */
  buyRoom: (name: string) => Promise<string | null>;
  roomMembers: (roomId: string) => Promise<RoomMember[]>;
  inviteToRoom: (roomId: string, playerCode: string) => Promise<string | null>;
  removeFromRoom: (roomId: string, userId: string) => Promise<void>;
};

const noop = async () => {};

const AppStateContext = createContext<AppState>({
  playerName: "",
  playerId: "",
  coins: 0,
  roomPrice: 50,
  rooms: [],
  packs: [],
  history: [],
  loadingRooms: false,
  refreshRooms: noop,
  refreshHistory: noop,
  buyRoom: async () => null,
  roomMembers: async () => [],
  inviteToRoom: async () => null,
  removeFromRoom: noop,
});

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : "Алдаа гарлаа. Дахин оролдоно уу.";

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, refresh } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [roomPrice, setRoomPrice] = useState(50);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const refreshRooms = useCallback(async () => {
    if (!user) return;
    setLoadingRooms(true);
    try {
      const res = await api<{ rooms: Room[]; price: number }>("/rooms");
      setRooms(res.rooms);
      setRoomPrice(res.price);
    } catch {
      // сервер унтарсан байж болно
    } finally {
      setLoadingRooms(false);
    }
  }, [user]);

  const refreshHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api<{ history: HistoryEntry[] }>("/auth/me/history");
      setHistory(res.history);
    } catch {
      // түүх байхгүй байж болно
    }
  }, [user]);

  // Нэвтэрсний дараа өрөө, багц, түүхийг татна
  useEffect(() => {
    if (!user) {
      setRooms([]);
      setHistory([]);
      return;
    }
    refreshRooms();
    refreshHistory();
    api<{ packs: CoinPack[] }>("/coins/packs", { anonymous: true })
      .then((res) => setPacks(res.packs))
      .catch(() => {});
  }, [user, refreshRooms, refreshHistory]);

  const value = useMemo<AppState>(() => ({
    playerName: user?.name ?? "",
    playerId: user?.playerCode ?? "",
    coins: user?.coins ?? 0,
    roomPrice,
    rooms,
    packs,
    history,
    loadingRooms,

    refreshRooms,
    refreshHistory,

    buyRoom: async (name) => {
      try {
        await api("/rooms", { method: "POST", body: { name } });
        await Promise.all([refreshRooms(), refresh()]);
        return null;
      } catch (e) {
        return errorText(e);
      }
    },

    roomMembers: async (roomId) => {
      try {
        const res = await api<{ members: RoomMember[] }>(`/rooms/${roomId}/members`);
        return res.members;
      } catch {
        return [];
      }
    },

    inviteToRoom: async (roomId, playerCode) => {
      try {
        await api(`/rooms/${roomId}/invite`, { method: "POST", body: { playerCode } });
        await refreshRooms();
        return null;
      } catch (e) {
        return errorText(e);
      }
    },

    removeFromRoom: async (roomId, userId) => {
      try {
        await api(`/rooms/${roomId}/members/${userId}`, { method: "DELETE" });
        await refreshRooms();
      } catch {
        // алдаа гарвал жагсаалт хэвээр
      }
    },
  }), [user, roomPrice, rooms, packs, history, loadingRooms, refreshRooms, refreshHistory, refresh]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => useContext(AppStateContext);
