import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, setAuthToken } from "../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  playerCode: string;
  coins: number;
};

export type UserStats = {
  plays: number;
  wins: number;
  win_rate: number;
};

const SESSION_KEY = "daaluu.session";

type Session = { token: string; user: AuthUser };

type AuthState = {
  user: AuthUser | null;
  stats: UserStats | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<string | null>;
  /** Зоос/статистикийг серверээс дахин уншина */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  stats: null,
  loading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  updateName: async () => null,
  refresh: async () => {},
});

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : "Алдаа гарлаа. Дахин оролдоно уу.";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = async (session: Session | null) => {
    setAuthToken(session?.token ?? null);
    setUser(session?.user ?? null);
    try {
      if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else await AsyncStorage.removeItem(SESSION_KEY);
    } catch {
      // хадгалахгүй байсан ч энэ session-д нэвтэрсэн хэвээр
    }
  };

  // Өмнөх session-ийг сэргээж, серверээс баталгаажуулна
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) return;

        const session: Session = JSON.parse(raw);
        setAuthToken(session.token);

        // Токен хүчинтэй эсэхийг сервер шалгана — зоос ч шинэчлэгдэнэ
        const me = await api<{ user: AuthUser; stats: UserStats }>("/auth/me");
        setUser(me.user);
        setStats(me.stats);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user: me.user }));
      } catch (e) {
        // Сервер унтарсан бол хадгалсан хэрэглэгчээр үргэлжлүүлнэ,
        // токен хүчингүй бол л гаргана
        if (e instanceof ApiError && e.code !== "network") {
          await persist(null);
        } else {
          const raw = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
          if (raw) {
            const session: Session = JSON.parse(raw);
            setAuthToken(session.token);
            setUser(session.user);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    stats,
    loading,

    signIn: async (email, password) => {
      if (!email.trim() || !password) return "И-мэйл болон нууц үгээ оруулна уу.";
      try {
        const res = await api<Session>("/auth/login", {
          method: "POST",
          anonymous: true,
          body: { email: email.trim().toLowerCase(), password },
        });
        await persist(res);
        return null;
      } catch (e) {
        return errorText(e);
      }
    },

    signUp: async (name, email, password) => {
      try {
        const res = await api<Session>("/auth/register", {
          method: "POST",
          anonymous: true,
          body: { name: name.trim(), email: email.trim().toLowerCase(), password },
        });
        await persist(res);
        return null;
      } catch (e) {
        return errorText(e);
      }
    },

    signOut: async () => {
      setStats(null);
      await persist(null);
    },

    updateName: async (name) => {
      try {
        const res = await api<{ user: AuthUser }>("/auth/me", {
          method: "PATCH",
          body: { name: name.trim() },
        });
        setUser(res.user);
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const session: Session = JSON.parse(raw);
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user: res.user }));
        }
        return null;
      } catch (e) {
        return errorText(e);
      }
    },

    refresh: async () => {
      try {
        const me = await api<{ user: AuthUser; stats: UserStats }>("/auth/me");
        setUser(me.user);
        setStats(me.stats);
      } catch {
        // сервер унтарсан байж болно — хуучин утгаа хадгална
      }
    },
  }), [user, stats, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
