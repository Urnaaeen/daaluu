import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ExitConfirmModal from "../components/ExitConfirmModal";
import BlurredBackdrop from "../components/BlurredBackdrop";
import GameSeat from "../components/GameSeat";
import HistoryDrawer, { type HistoryRound } from "../components/HistoryDrawer";
import JanliiPicker from "../components/JanliiPicker";
import PauseModal from "../components/PauseModal";
import PeekModal from "../components/PeekModal";
import GerIcon from "../components/ui/GerIcon";
import PushButton from "../components/ui/PushButton";
import { useTheme } from "../context/ThemeContext";
import { api, ApiError } from "../lib/api";
import { endRuleShort } from "../lib/endRules";
import { janliiShort } from "../lib/janlii";
import { canSelectTile, currentLead, validateMove } from "../lib/rules";
import { subscribeToMatch, type MatchState } from "../lib/socket";
import { sortHand, tileViews } from "../lib/tiles";
import { AVATAR_COLORS, MONO, PALETTE } from "../theme/colors";

// Дууссан гар ширээн дээр харагдах хугацаа (сервер ROUND_PAUSE_MS = 2.5с хүлээнэ)
const ROUND_SHOW_MS = 2300;

export default function MultiplayerGame() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;

  const [state, setState] = useState<MatchState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [peekSeat, setPeekSeat] = useState(-1);
  const [showExit, setShowExit] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Realtime төлөв.
  // Бусад тоглогч мод гаргахад сонголтыг УСТГАХГҮЙ — зөвхөн гарт байхгүй
  // болсон модыг л хасна (миний хөдөлгөөн батлагдсан гэсэн үг).
  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId, (next) => {
      setState(next);
      setSelected((prev) => {
        const inHand = new Set(next.myHand);
        const kept = prev.filter((id) => inHand.has(id));
        return kept.length === prev.length ? prev : kept;
      });
    });
  }, [matchId]);

  // Ээлжийн үлдсэн хугацааг тоолно
  useEffect(() => {
    const deadline = state?.match.turnDeadline;
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state?.match.turnDeadline]);

  // Тоглоом дуусахад дүнгийн дэлгэц рүү
  useEffect(() => {
    if (state?.match.status !== "finished") return;

    const rows = [...state.players]
      .sort((a, b) => (a.place ?? 9) - (b.place ?? 9))
      .map((p) => ({
        place: String(p.place ?? ""),
        name: p.name,
        detail: `${p.tsai} цай · ${p.avlaga} авлага · ${p.uglug} өглөг`,
        score: String(p.finalScore ?? 0),
        seat: p.seat,
      }));

    const winner = rows[0];
    // Сүүлийн гарыг ширээн дээр харуулсны дараа дүн рүү шилжинэ
    const t = setTimeout(() => {
      router.replace({
        pathname: "/end",
        params: {
          scores: JSON.stringify(rows),
          winner: winner?.name ?? "",
          summary: `${winner?.score ?? 0} оноогоор түрүүллээ`,
        },
      });
    }, ROUND_SHOW_MS);
    return () => clearTimeout(t);
  }, [state?.match.status, state?.players, router]);

  /**
   * Гар дуусахад сервер ширээг шууд цэвэрлэдэг тул сүүлийн мод (ялангуяа ботын)
   * харагдахгүй өнгөрдөг. Шинэ дууссан гар ирэхэд түүнийг ширээн дээр
   * ROUND_SHOW_MS хугацаанд үлдээж, хэн идсэнийг харуулна (боттой горим шиг).
   */
  const seenRound = useRef<number | null>(null);
  const [recent, setRecent] = useState<NonNullable<MatchState["lastRound"]> | null>(null);
  useEffect(() => {
    const lr = state?.lastRound;
    if (!lr) return;
    if (seenRound.current === null) {
      // Анх ачаалахад хуучин гарыг дахин тоглуулахгүй
      seenRound.current = lr.roundNo;
      return;
    }
    if (lr.roundNo === seenRound.current) return;
    seenRound.current = lr.roundNo;
    setRecent(lr);
    const t = setTimeout(() => setRecent(null), ROUND_SHOW_MS);
    return () => clearTimeout(t);
  }, [state?.lastRound]);

  // Тухайн майхны жанлий — модны эрэмбэ, өнгө үүнээс хамаарна
  const janlii = state?.match.janlii ?? null;
  const choosingJanlii = state?.match.status === "playing" && state?.match.phase === "janlii";
  const [janliiBusy, setJanliiBusy] = useState(false);

  const myHand = useMemo(() => sortHand(state?.myHand ?? [], janlii), [state?.myHand, janlii]);

  // Голд байгаа хамгийн том мод
  const biggest = useMemo(() => {
    const moves = state?.moves ?? [];
    if (!moves.length) return null;

    const real = moves.filter((m) => !m.isSecret).map((m) => ({ ...m, view: tileViews(m.tiles, janlii) }));
    if (!real.length) return null;

    const refColor = real[0].view[0]?.color;
    const valid = real.filter((m) => {
      const c = m.view[0]?.color;
      return !c || !refColor || c === refColor;
    });

    const pool = valid.length ? valid : real;
    return pool.reduce((best, m) => (m.view[0].rank > best.view[0].rank ? m : best));
  }, [state?.moves, janlii]);

  const pickJanlii = async (typeId: string) => {
    if (!matchId) return;
    setJanliiBusy(true);
    setError("");
    try {
      await api(`/matches/${matchId}/janlii`, { method: "POST", body: { typeId } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Жанлий сонгож чадсангүй.");
    } finally {
      setJanliiBusy(false);
    }
  };

  const play = async () => {
    if (!matchId || !selected.length) return;
    setSending(true);
    setError("");
    try {
      await api(`/matches/${matchId}/play`, { method: "POST", body: { tiles: selected } });
      setSelected([]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Мод гаргаж чадсангүй.");
    } finally {
      setSending(false);
    }
  };

  const toggle = (id: string) => {
    setError("");
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  // Голд байгаа хамгийн том — дүрмийн шалгалтад ашиглана
  const lead = useMemo(() => currentLead(state?.moves ?? [], janlii), [state?.moves, janlii]);

  // Аль модыг сонгож болохыг урьдчилан тооцно (сервер эцсийн шүүлтийг хийнэ)
  const selectable = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const t of myHand) map.set(t.id, canSelectTile(myHand, selected, t.id, lead));
    return map;
  }, [myHand, selected, lead]);

  // Сонголт хүчинтэй юу — үгүй бол шалтгааныг товчны дээр харуулна
  const selectionProblem = useMemo(
    () => (selected.length ? validateMove(myHand, selected, lead) : null),
    [myHand, selected, lead]
  );

  if (!state || !matchId) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.feltTop }]}>
        <ActivityIndicator size="large" color={PALETTE.yellow} />
        <Text style={styles.loadingText}>Ширээ бэлдэж байна…</Text>
      </View>
    );
  }

  const me = state.players.find((p) => p.isMe);
  const mySeat = state.mySeat ?? 0;
  const myTurn =
    state.match.currentSeat === mySeat && state.match.status === "playing" && !choosingJanlii;
  const lowTime = myTurn && secondsLeft !== null && secondsLeft <= 5;
  const canPlay = myTurn && selected.length > 0 && !selectionProblem && !sending;

  // Бусад суудлыг минийхээс цагийн зүүний дагуу
  const others = state.players
    .filter((p) => p.seat !== mySeat)
    .sort((a, b) => a.seat - b.seat);
  const ordered = [
    ...others.filter((p) => p.seat > mySeat),
    ...others.filter((p) => p.seat < mySeat),
  ];

  // Шинэ гар хараахан эхлээгүй бол саяхан дууссан гарыг ширээн дээр үлдээнэ
  const showingRecent = !!recent && state.moves.length === 0;
  const boardMoves = showingRecent
    ? recent!.plays.flatMap((tiles, seat) =>
        tiles ? [{ seat, tiles, isSecret: tiles[0]?.startsWith("nuuts") ?? false }] : []
      )
    : state.moves;
  const biggestSeat = showingRecent ? recent!.winnerSeat : biggest?.seat;
  // Гол хэсэг: дууссан гарыг харуулж байх үед идсэн мод
  const centerBig = showingRecent
    ? (() => {
        const tiles = recent!.plays[recent!.winnerSeat];
        return tiles ? { seat: recent!.winnerSeat, view: tileViews(tiles, janlii) } : null;
      })()
    : biggest;
  const movesBySeat = new Map(boardMoves.map((m) => [m.seat, m]));

  const seatFor = (player: (typeof state.players)[number] | undefined) => {
    if (!player) return <View style={{ width: 86 }} />;
    const move = movesBySeat.get(player.seat);
    return (
      <GameSeat
        name={player.name}
        color={AVATAR_COLORS[player.seat % 5]}
        isTurn={state.match.currentSeat === player.seat && state.match.status === "playing"}
        timeLeft={secondsLeft}
        ger={player.ger}
        tiles={move ? tileViews(move.tiles, janlii) : null}
        isBiggest={biggestSeat === player.seat}
        onLongPress={() => setPeekSeat(player.seat)}
      />
    );
  };

  const seatNameOf = (seat: number) => {
    const p = state.players.find((x) => x.seat === seat);
    return p?.isMe ? "Та" : p?.name ?? "";
  };
  const turnName = state.players.find((p) => p.seat === state.match.currentSeat)?.name ?? "";
  const iChooseJanlii = choosingJanlii && state.match.currentSeat === mySeat;
  const recentWinner = showingRecent ? seatNameOf(recent!.winnerSeat) : "";
  const turnLabel = showingRecent
    ? `${recentWinner} идлээ`
    : choosingJanlii
    ? iChooseJanlii
      ? "Жанлий сонгоно уу"
      : `${turnName} жанлий сонгож байна…`
    : myTurn
      ? secondsLeft === null
        ? "Таны ээлж"
        : `Таны ээлж · ${secondsLeft} сек`
      : `${turnName} бодож байна…`;

  const peekPlayer = state.players.find((p) => p.seat === peekSeat);

  // Гарын түүх: суудлын дугаараар (0–4) нэр, гаргасан мод
  const seatNames = [0, 1, 2, 3, 4].map((seat) => {
    const p = state.players.find((x) => x.seat === seat);
    return p?.isMe ? "Чи" : p?.name ?? "";
  });
  const historyRounds: HistoryRound[] = (state.history ?? []).map((h) => ({
    winner: h.winnerSeat,
    plays: h.plays.map((tiles) => (tiles ? tileViews(tiles, janlii) : null)),
  }));

  return (
    <View style={[styles.safe, { backgroundColor: colors.feltTop }]}>
      <BlurredBackdrop />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => setPaused(true)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedDown]}
        >
          <Text style={styles.iconBtnText}>❙❙</Text>
        </Pressable>

        <View style={styles.turnPillWrap}>
          <View
            style={[
              styles.turnPill,
              {
                backgroundColor: myTurn
                  ? lowTime
                    ? PALETTE.red
                    : PALETTE.yellow
                  : "rgba(255,255,255,0.14)",
              },
            ]}
          >
            <Text
              style={[
                styles.turnPillText,
                {
                  color: myTurn
                    ? lowTime
                      ? "#fff"
                      : PALETTE.yellowText
                    : "rgba(255,255,255,0.85)",
                },
              ]}
            >
              {turnLabel}
            </Text>
          </View>
          {!!janlii && !choosingJanlii && (
            <View style={styles.janliiBadge}>
              <Text style={styles.janliiBadgeText}>Жанлий · {janliiShort(janlii)}</Text>
            </View>
          )}
        </View>

        {/* Гарын түүх — боттой горимтой ижил */}
        <Pressable
          onPress={() => setShowHistory(true)}
          accessibilityLabel="Гарын түүх"
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedDown]}
        >
          <Text style={styles.iconBtnText}>☰</Text>
        </Pressable>
      </View>

      <View style={styles.spread} />
      {/* ДЭЭД СУУДЛУУД */}
      <View style={styles.topSeats}>
        {seatFor(ordered[1])}
        {seatFor(ordered[2])}
      </View>

      {/* ЗҮҮН · ГОЛ · БАРУУН */}
      <View style={styles.middleRow}>
        {seatFor(ordered[0])}

        <View style={styles.centerArea}>
          {centerBig ? (
            <>
              <Text style={styles.centerLabel}>ХАМГИЙН ТОМ</Text>
              <View style={styles.centerTilesRow}>
                {centerBig.view.map((t, i) => (
                  <ExpoImage
                    key={t.id}
                    source={t.image}
                    style={[styles.centerTile, i === 1 && styles.centerTileOverlap]}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                ))}
              </View>
              <View style={styles.centerOwnerPill}>
                <Text style={styles.centerOwnerText}>
                  {state.players.find((p) => p.seat === centerBig.seat)?.name} · {centerBig.view[0].title}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.centerEmpty}>
              <Text style={styles.centerEmptyText}>
                Гол хоосон{"\n"}8-аас дээш мод эсвэл хосоор эхэл
              </Text>
            </View>
          )}
        </View>

        {seatFor(ordered[3])}
      </View>

      {/* МИНИЙ ГАРГАСАН МОД */}
      <View style={styles.mySlotRow}>
        {movesBySeat.has(mySeat) ? (
          <View style={styles.myPlayedRow}>
            {tileViews(movesBySeat.get(mySeat)!.tiles, janlii).map((t, i) => (
              <ExpoImage
                key={t.id}
                source={t.image}
                contentFit="contain"
                cachePolicy="memory-disk"
                style={[
                  styles.myPlayedTile,
                  i === 1 && styles.myPlayedTileSecond,
                  biggestSeat === mySeat && styles.myPlayedTileWin,
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.mySlotEmpty}>
            <Text style={styles.mySlotEmptyText}>Чи</Text>
          </View>
        )}
      </View>

      <View style={styles.spread} />
      {/* МИНИЙ МӨР */}
      <View style={styles.myRow}>
        <View
          style={[
            styles.myRing,
            { backgroundColor: myTurn ? (lowTime ? PALETTE.red : PALETTE.yellow) : "rgba(255,255,255,0.10)" },
          ]}
        >
          <Pressable onLongPress={() => setPeekSeat(mySeat)} delayLongPress={380}>
            <View style={[styles.myAvatar, { backgroundColor: AVATAR_COLORS[mySeat % 5] }]}>
              <Text style={styles.myAvatarText}>
                {(me?.name.trim()[0] ?? "Ч").toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>ЦАЙ</Text>
            <Text style={[styles.chipValue, { color: PALETTE.yellow }]}>{me?.tsai ?? 0}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>АВЛАГА</Text>
            <Text style={[styles.chipValue, { color: PALETTE.green }]}>{me?.avlaga ?? 0}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>ӨГЛӨГ</Text>
            <Text style={[styles.chipValue, { color: PALETTE.orange }]}>{me?.uglug ?? 0}</Text>
          </View>
        </View>

        <View style={styles.gerChip}>
          <Text style={styles.chipLabel}>ГЭР</Text>
          <View style={styles.gerValueRow}>
            <GerIcon size={15} />
            <Text style={[styles.chipValue, { color: PALETTE.yellow }]}>{me?.ger ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* ЗӨВЛӨМЖ / АЛДАА — сонголт дүрэмд нийцээгүй бол шалтгааныг харуулна */}
      {(!!error || !!selectionProblem) && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error || selectionProblem}</Text>
        </View>
      )}

      {/* ҮЙЛДЭЛ */}
      <View style={styles.actionRow}>
        <PushButton
          label={sending ? "Илгээж байна…" : selected.length ? `Мод гаргах (${selected.length})` : "Мод гаргах"}
          color={canPlay ? PALETTE.green : "rgba(255,255,255,0.10)"}
          shadowColor={canPlay ? PALETTE.greenDark : "transparent"}
          textColor={canPlay ? "#fff" : "rgba(255,255,255,0.45)"}
          disabled={!canPlay}
          onPress={play}
          radius={15}
          style={{ flex: 1 }}
          faceStyle={{ paddingVertical: 14 }}
          textStyle={{ fontSize: 16 }}
        />

        {selected.length > 0 && (
          <PushButton
            label="✕"
            color={PALETTE.red}
            shadowColor={PALETTE.redDark}
            onPress={() => setSelected([])}
            radius={15}
            faceStyle={{ width: 48, paddingVertical: 14, paddingHorizontal: 0 }}
            textStyle={{ fontSize: 16 }}
          />
        )}
      </View>

      <View style={styles.spread} />
      {/* МИНИЙ ГАР */}
      <View style={styles.handWrap}>
        <FlatList
          horizontal
          data={myHand}
          keyExtractor={(t) => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 9 }}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);
            // Ээлж биш эсвэл дүрмээр гаргах боломжгүй бол бүдгэрнэ
            const usable = myTurn && (selectable.get(item.id) ?? false);
            return (
              <Pressable
                style={[
                  styles.handItem,
                  item.isJanlii && styles.handItemJanlii,
                  isSelected && styles.handItemSelected,
                  !isSelected && !usable && styles.handItemDim,
                ]}
                onPress={() => toggle(item.id)}
                disabled={!usable}
              >
                <ExpoImage
                  source={item.image}
                  style={styles.handTile}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
                <Text style={styles.handLabel} numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* ЖАНЛИЙ СОНГОХ — майхны эхэнд, мод харагдахаас өмнө */}
      {choosingJanlii && (
        <JanliiPicker
          key={`janlii-${state.match.maikhanNo}-${error}`}
          canChoose={iChooseJanlii}
          chooserName={turnName}
          deadline={state.match.turnDeadline ? new Date(state.match.turnDeadline).getTime() : null}
          onPick={pickJanlii}
          busy={janliiBusy}
        />
      )}

      <HistoryDrawer
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        rounds={historyRounds}
        names={seatNames}
      />

      {/* MODALS */}
      {peekPlayer && (
        <PeekModal
          visible={peekSeat >= 0}
          onClose={() => setPeekSeat(-1)}
          name={peekPlayer.name}
          color={AVATAR_COLORS[peekPlayer.seat % 5]}
          stats={{
            tsai: peekPlayer.tsai,
            ger: peekPlayer.ger,
            avlaga: peekPlayer.avlaga,
            uglug: peekPlayer.uglug,
          }}
        />
      )}

      <PauseModal
        visible={paused}
        turnLimit={state.match.turnSeconds}
        endRuleShort={endRuleShort(state.match.endRule)}
        allowTimerChange={false}
        onPickLimit={() => {}}
        onResume={() => setPaused(false)}
        onExit={() => {
          setPaused(false);
          setShowExit(true);
        }}
      />

      <ExitConfirmModal
        visible={showExit}
        ger={me?.ger ?? 0}
        onConfirm={() => {
          setShowExit(false);
          router.replace("/");
        }}
        onCancel={() => setShowExit(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Өндөр дэлгэцэд илүү зайг хэсгүүдийн хооронд тараана; намхан дэлгэцэд 0
  spread: { flexGrow: 0.22, flexShrink: 1, flexBasis: 0 },

  safe: { flex: 1, paddingTop: 8, paddingBottom: 12 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.85)" },

  pressedDown: { transform: [{ translateY: 2 }] },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  iconBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  turnPillWrap: { flex: 1, alignItems: "center", gap: 4 },
  janliiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#F5A524",
    backgroundColor: "rgba(245,165,36,0.16)",
  },
  janliiBadgeText: { color: "#F5C056", fontSize: 11, fontWeight: "900" },
  handItemJanlii: {
    borderColor: "#F5A524",
    backgroundColor: "rgba(245,165,36,0.14)",
  },
  turnPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  turnPillText: { fontSize: 13, fontWeight: "800" },


  topSeats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 44,
    paddingTop: 2,
  },

  middleRow: { flexGrow: 1, flexShrink: 1, flexBasis: "auto", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },

  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 210,
  },

  centerLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.78)",
  },

  centerTilesRow: { flexDirection: "row", alignItems: "center" },
  centerTile: { width: 96, height: 152 },
  centerTileOverlap: { marginLeft: -60 },

  centerOwnerPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  centerOwnerText: { fontSize: 12, fontWeight: "800", color: PALETTE.yellow },

  centerEmpty: {
    width: 150,
    minHeight: 170,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },

  centerEmptyText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
  },

  mySlotRow: { alignItems: "center", paddingVertical: 4 },
  myPlayedRow: { flexDirection: "row", alignItems: "center" },
  myPlayedTile: { width: 46, height: 70, borderRadius: 8 },
  myPlayedTileSecond: { marginLeft: -30 },
  myPlayedTileWin: { borderWidth: 3, borderColor: PALETTE.yellow, borderRadius: 10 },

  mySlotEmpty: {
    width: 46,
    height: 70,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },

  mySlotEmptyText: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.72)" },

  myRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: "visible",
  },

  myRing: { width: 50, height: 50, borderRadius: 16, padding: 5, overflow: "visible" },

  myAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  myAvatarText: { fontSize: 14, fontWeight: "900", color: "#fff" },

  chipsRow: { flex: 1, flexDirection: "row", gap: 5 },

  chip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: "center",
  },

  gerChip: {
    backgroundColor: "rgba(255,200,61,0.16)",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: "center",
  },

  gerValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  chipLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.78)",
  },

  chipValue: { fontSize: 13, fontFamily: MONO, marginTop: 1 },

  errorRow: { paddingHorizontal: 14, paddingBottom: 4 },
  errorText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: PALETTE.red,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    textAlign: "center",
    overflow: "hidden",
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },

  handWrap: { paddingTop: 12 },

  handItem: {
    width: 70,
    alignItems: "center",
    gap: 5,
    paddingTop: 7,
    paddingBottom: 8,
    paddingHorizontal: 5,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },

  handItemSelected: {
    borderColor: PALETTE.green,
    backgroundColor: "rgba(70,201,58,0.22)",
    transform: [{ translateY: -10 }],
  },

  handItemDim: { opacity: 0.55 },

  handTile: { width: 53, height: 84 },

  handLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    maxWidth: 66,
  },
});
