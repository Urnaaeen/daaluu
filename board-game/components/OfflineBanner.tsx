import { useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

/**
 * Интернэтгүй үед доод талд гарах жижиг мэдэгдэл (вэб / PWA).
 *
 * navigator.onLine-д дангаар найдахгүй: утас WiFi-д холбогдсон ч интернэтгүй
 * үед тэр "онлайн" гэж хэлдэг. Тиймээс өөрийн сайт руу жижиг хүсэлт явуулж
 * (Service Worker cache-ийг тойрно) жинхэнэ холболтыг шалгана.
 */

// Тоглоомын ширээн дээр модны нэрийг дарахгүйн тулд харуулахгүй
const HIDDEN_ON = ["playScreen", "multiplayerGame"];
const PROBE_EVERY_MS = 15_000;

const probe = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;
  // Хуучин Safari-д AbortSignal.timeout байхгүй тул гараар
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    // HEAD хүсэлтийг SW cache-лдэггүй тул заавал сүлжээ рүү явна
    await fetch(`/__online?t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return true; // ямар ч HTTP хариу (404 ч) ирвэл интернэт байна
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
};

export default function OfflineBanner() {
  const segments = useSegments();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let alive = true;
    const check = async () => {
      const ok = await probe();
      if (alive) setOffline(!ok);
    };

    check();
    const timer = setInterval(check, PROBE_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!offline || HIDDEN_ON.includes(segments[0] ?? "")) return null;

  return (
    <View style={styles.bar} pointerEvents="none">
      <Text style={styles.text}>📴 Интернэтгүй байна · Боттой тоглох горим ажиллана</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 90,
    alignItems: "center",
  },
  text: {
    backgroundColor: "rgba(20,14,8,0.92)",
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    overflow: "hidden",
    textAlign: "center",
  },
});
