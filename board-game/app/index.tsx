import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BlurredBackdrop from "../components/BlurredBackdrop";
import { useAppState } from "../context/AppStateContext";
import { usePresence } from "../context/PresenceContext";
import { useTheme } from "../context/ThemeContext";
import { PALETTE } from "../theme/colors";

const TILE_LEFT = require("../assets/objects/11.png");
const TILE_RIGHT = require("../assets/objects/12.png");

// Цэсний зурсан icon-ууд (menu-icons.png-ээс тасалсан)
const ICON_BOT = require("../assets/zurag/icon-bot.png");
const ICON_RANDOM = require("../assets/zurag/icon-random.png");
const ICON_FRIENDS = require("../assets/zurag/icon-friends.png");

export default function Menu() {
  const router = useRouter();
  const { colors } = useTheme();
  const { playerName, roomPrice } = useAppState();
  const { online, connected } = usePresence();

  const nameInitial = (playerName.trim()[0] ?? "Т").toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlurredBackdrop />

      {/* ПРОФАЙЛ */}
      <Pressable
        onPress={() => router.push("/profile")}
        style={({ pressed }) => [
          styles.profileBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && styles.pressedDown,
        ]}
      >
        <Text style={[styles.profileBtnText, { color: colors.text }]}>{nameInitial}</Text>
      </Pressable>

      {/* ЛОГО */}
      <View style={styles.logoBox}>
        <View style={styles.logoTiles}>
          <ExpoImage
            source={TILE_LEFT}
            style={[styles.logoTile, styles.logoTileLeft]}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
          <ExpoImage
            source={TILE_RIGHT}
            style={[styles.logoTile, styles.logoTileRight]}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
        </View>
        <Text style={styles.appTitle}>Цай хураах</Text>
        <Text style={styles.appSub}>Монгол даалуу · 5 тоглогч</Text>
      </View>

      {/* ГОРИМУУД */}
      <View style={styles.menu}>
        <ModeCard
          icon={ICON_BOT}
          title="Боттой тоглох"
          sub="Үнэгүй · 4 боттой уралдана"
          onPress={() => router.push("/playScreen")}
          colors={colors}
        />

        <ModeCard
          icon={ICON_RANDOM}
          title="Санамсаргүй хүнтэй"
          sub={connected ? `${online} хүн онлайн · хүлээнэ` : "Сервер холбогдож байна…"}
          onPress={() => router.push("/match")}
          colors={colors}
        />

        <ModeCard
          icon={ICON_FRIENDS}
          title="Өөрийн хүмүүстэй"
          sub="ID-гаар найзуудаа урина"
          badge={`🪙 ${roomPrice}`}
          onPress={() => router.push("/roomAdmin")}
          colors={colors}
        />
      </View>

      {/* ЗААВАР */}
      <Pressable
        onPress={() => router.push("/rules")}
        style={({ pressed }) => [
          styles.rulesBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && styles.pressedDown,
        ]}
      >
        <Text style={[styles.rulesBtnText, { color: colors.subText }]}>?</Text>
      </Pressable>
    </View>
  );
}

/* ========== MODE CARD ========== */

function ModeCard({
  icon,
  title,
  sub,
  badge,
  onPress,
  colors,
}: {
  icon: any;
  title: string;
  sub: string;
  badge?: string;
  onPress: () => void;
  colors: any;
}) {
  // Хулгана дээгүүр очих (эсвэл дарах) үед л хүрээ улбар шар болно
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.modeCard,
        {
          backgroundColor: colors.card,
          borderColor: hovered || pressed ? colors.accent : colors.border,
        },
        pressed && styles.pressedDown,
      ]}
    >
      <ExpoImage
        source={icon}
        style={styles.modeIcon}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={200}
      />
      <View style={styles.modeBody}>
        <View style={styles.modeTitleRow}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{title}</Text>
          {badge && (
            <View style={styles.coinBadge}>
              <Text style={styles.coinBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.modeSub, { color: colors.subText }]}>{sub}</Text>
      </View>
      <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
    </Pressable>
  );
}

/* ========== STYLES ========== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 34,
  },

  pressedDown: {
    transform: [{ translateY: 2 }],
  },

  profileBtn: {
    position: "absolute",
    top: 16,
    right: 22,
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  profileBtnText: {
    fontSize: 15,
    fontWeight: "900",
  },

  logoBox: {
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },

  logoTiles: {
    width: 120,
    height: 104,
  },

  logoTile: {
    position: "absolute",
    width: 62,
    height: 96,
  },

  logoTileLeft: {
    left: 4,
    top: 8,
    transform: [{ rotate: "-12deg" }],
  },

  logoTileRight: {
    right: 4,
    top: 2,
    transform: [{ rotate: "10deg" }],
  },

  appTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  appSub: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: -8,
    color: "rgba(255,255,255,0.85)",
  },

  menu: {
    gap: 10,
    marginTop: 26,
  },

  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 15,
    borderRadius: 20,
    borderWidth: 2,
  },

  modeIcon: {
    width: 48,
    height: 48,
  },

  modeBody: {
    flex: 1,
  },

  modeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  modeTitle: {
    fontSize: 16,
    fontWeight: "800",
  },

  coinBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: PALETTE.goldSoft,
  },

  coinBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: PALETTE.gold,
  },

  modeSub: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },

  chevron: {
    fontSize: 18,
    fontWeight: "800",
  },

  rulesBtn: {
    position: "absolute",
    bottom: 34,
    left: 24,
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  rulesBtnText: {
    fontSize: 20,
    fontWeight: "900",
  },
});
