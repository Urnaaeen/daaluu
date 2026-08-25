import { createContext, useContext, useEffect, useState } from "react";
import { closeSocket, getSocket } from "../lib/socket";
import { useAuth } from "./AuthContext";

/**
 * Онлайн байгаа тоглогчдын тоо.
 * Нэвтэрмэгц socket холбогдож, тоо өөрчлөгдөх бүрт серверээс шинэчлэгдэнэ.
 */
type PresenceState = {
  online: number;
  connected: boolean;
};

const PresenceContext = createContext<PresenceState>({ online: 0, connected: false });

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      closeSocket();
      setOnline(0);
      setConnected(false);
      return;
    }

    const socket = getSocket();

    const onPresence = (payload: { online?: number }) => setOnline(payload?.online ?? 0);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("presence", onPresence);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off("presence", onPresence);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [user]);

  return (
    <PresenceContext.Provider value={{ online, connected }}>{children}</PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);
