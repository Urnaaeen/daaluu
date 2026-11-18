import { useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

/**
 * Интернэтгүй үед доод талд гарах жижиг мэдэгдэл (вэб / PWA).
 * Service Worker-ийн ачаар апп нээгдэх ч онлайн горимууд ажиллахгүйг сануулна.
 */
// Тоглоомын ширээн дээр модны нэрийг дарахгүйн тулд харуулахгүй
const HIDDEN_ON = ["playScreen", "multiplayerGame"];

export default function OfflineBanner() {
  const segments = useSegments();
  const [offline, setOffline] = useState(
    Platform.OS === "web" && typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
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
