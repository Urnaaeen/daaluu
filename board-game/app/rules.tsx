import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PushButton from "../components/ui/PushButton";
import { useTheme } from "../context/ThemeContext";
import { MONO } from "../theme/colors";
import ChatModule, { type ChatModuleRef } from "./ask";

type TabKey = "gunshin" | "rules" | "score";

// Модны гуншин — нүдний тоогоор нь эрэмбэлсэн
const GUNSHIN = [
  { key: "daaluu", title: "Даалуу", rank: "12 нүд", description: "Даа хамбан даалуу\nДахаа чирсэн хулгайч", image: require("../assets/objects/12.png") },
  { key: "uuluu", title: "Үүлүү", rank: "11 нүд", description: "Хуран цэргийн ханжин\nХурандаа цолтой хуутуу", image: require("../assets/objects/11.png") },
  { key: "arav1", title: "Бажгар арав", rank: "10 нүд", description: "Хар арав Хандын найз\nХанд хүүхэн миний найз", image: require("../assets/objects/10_1.png") },
  { key: "arav2", title: "Сийлүү арав", rank: "10 нүд", description: "Сэндэр модны хайлаас\nСэнтийж байвал сийлүү", image: require("../assets/objects/10_2.png") },
  { key: "ys1", title: "Дэгээ ес", rank: "9 нүд", description: "Дэгээ есөнд дээлээ уруулж\nДэгжин хүүхэн нүүрээ маажуул", image: require("../assets/objects/9_1.png") },
  { key: "ys2", title: "Гавал ес", rank: "9 нүд", description: "Толгой дээгүүр сэнгэнэдэг\nДоржсэндэн гавал", image: require("../assets/objects/9_2.png") },
  { key: "naim1", title: "Дөнгө найм", rank: "8 нүд", description: "Дөнгөн сээрийн мөнгөн хүзүү\nДөрвөн далайн тэлээгүй түшмэл", image: require("../assets/objects/8_1.png") },
  { key: "naim2", title: "Муруй найм", rank: "8 нүд", description: "Тэмээ наймын тэнгэр мэдэг\nТэнэсэн бандийн аз мэдэг", image: require("../assets/objects/8_1_1.png") },
  { key: "naim3", title: "Чавганц найм", rank: "8 нүд", description: "Наян жил насалсан\nНамбигар улаан чавганцаа", image: require("../assets/objects/8_2.png") },
  { key: "doloo1", title: "Сарлаг долоо", rank: "7 нүд", description: "Долоо уулын сарлаг\nДогшин газрын садваг", image: require("../assets/objects/7_1.png") },
  { key: "doloo2", title: "Шанага долоо", rank: "7 нүд", description: "Долоон бурхан шинжтэй\nДолнуур авгайн шанага", image: require("../assets/objects/7_2_1.png") },
  { key: "doloo3", title: "Шор долоо", rank: "7 нүд", description: "Гонзгор долоо гоохолзоно\nГовийн хүүхэн шоохолзоно", image: require("../assets/objects/7_2_2.png") },
  { key: "zurgaa1", title: "Чанс зургаа", rank: "6 нүд", description: "Ханан хээтэй чанс\nХаяа голын бургас", image: require("../assets/objects/6_1.png") },
  { key: "zurgaa2", title: "Нохой", rank: "6 нүд", description: "Зуудаг нохойн зулзага\nЗургаан нүхтэй даалуу", image: require("../assets/objects/6_2_1.png") },
  { key: "zurgaa3", title: "Булуу зургаа", rank: "6 нүд", description: "Булуу зургаа будантай\nБуцаад ирэхэд манантай", image: require("../assets/objects/6_2_2.png") },
  { key: "tav", title: "Чүү тав", rank: "5 нүд", description: "Хайргүй хатгаж нойргүй\nХонуулдаг алтан чүү тав", image: require("../assets/objects/5.png") },
  { key: "duruv1", title: "Банд", rank: "4 нүд", description: "Вандан суудал\nЗандан ширээ", image: require("../assets/objects/4_1.png") },
  { key: "duruv2", title: "Бөхөөн дөрөв", rank: "4 нүд", description: "Өөхий бөөхий дөрөв\nӨвчүү номин шаргал", image: require("../assets/objects/4_2.png") },
  { key: "hoyr", title: "Ёоз", rank: "2 нүд", description: "Хон хэрээний нүд\nХоёр нүдний дуран", image: require("../assets/objects/2.png") },
  { key: "nuuts", title: "Нууц мод", rank: "1 нүд", description: "Хосгүй 2 мод гаргахад\nнууц мод болж хаагдана", image: require("../assets/objects/secret.png") },
];

const RULES = [
  { num: "01", title: "Тоглогч эрэмбэлэх", description: "Тоглоом эхлэхийн өмнө тоглогчдийн байрлалыг өөрчлөх боломжтой." },
  { num: "02", title: "Тоглогчийн тоо", description: "Холбогдсон тоглогчийн тоо үл хамааран тоглолт эхлэх боломжтой." },
  { num: "03", title: "Цай", description: "Цай хураах тоглоомд 10 модыг цай гэж нэрлэж тусад нь авах бөгөөд 5 тоглогч бүрт тэнцүү тарааж өгнө." },
  { num: "04", title: "Гарын мод", description: "Тоглоомны үлдсэн модыг (50) хольж, тоглогчид 10 модтойгоор тоглоомыг эхлүүлнэ." },
  { num: "05", title: "Жанлий нэрлэх", description: "Жанлийд нэрлэгдсэн мод бүх модыг дийлэх бөгөөд тоглолт эхлүүлэгч модоо харахаас өмнө нэрлэх ёстой." },
  { num: "06", title: "Гараа булаах", description: "Хос жанлийтай бол гараа булаадаг, ингэснээр жанлий дуудсан тоглогч гараагаа үргэлжлүүлэн тоглоно." },
  { num: "07", title: "Өнгө нэрлэх", description: "Хос жанлийтай тоглогч гарахдаа ямар өнгийн ус дуудахаа сонгох бөгөөд хамгийн том усыг дуудах эрхтэй." },
  { num: "08", title: "Өнгө дагуулах", description: "Тоглогч хос гарах үед дараа дараагийн тоглогчид гарт буй ижил өнгийн ус модоо өгнө." },
  { num: "09", title: "Мод гарах", description: "Нэг модоор гарах бол 8 буюу түүнээс дээш нүдтэй модоор гарна. Хос мод буюу усаар гарах үед нүдний тоо үл хамаарна." },
  { num: "10", title: "Мод ахиулах", description: "Жанлийгаас бусад модыг заавал өнгө дагуу ахиулах ёстой бөгөөд жанлий болсон мод ямар ч модыг идэх эрхтэй." },
  { num: "11", title: "Муу мод өгөх", description: "Гарааг заавал ахиулах ёстой бөгөөд боломжгүй тохиолдолд өнгө үл харгалзан муу мод өгч болно." },
  { num: "12", title: "Мод үхэх", description: "Гараа хос жанлийгаа гаргалгүй өнгөрвөл жанлий үхдэг. Мөн ус дуудах үед, өнгө дагасан хос авч үлдвэл үхдэг." },
];

const FINALLY = [
  { key: "winner", title: "Ялагч", description: "Тоглолтын төгсгөлд хамгийн их цай хураасан тоглогч ялагч болно. Нийт цайг авлага оролцуулан тооцно." },
  { key: "ger", title: "Гэр авах", description: "Бүх мод дуусах үед гэр босгож чадаагүй бол 2-оос илүү гэртэй хүнээс өөрт буй цайгаар худалдаж авах эсвэл зээлнэ." },
  { key: "tsai", title: "Цай авах", description: "Бүх мод дуусах үед 2-оос их гэр барьсан тоглогч гэр бариагүй тоглогчид гэрээ цайгаар зарах эсвэл авлагатай болно." },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "gunshin", label: "Гуншин" },
  { key: "rules", label: "Дүрэм" },
  { key: "score", label: "Оноо" },
];

/* ================= COMPONENT ================= */

export default function Rules() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<TabKey>("gunshin");
  const chatModuleRef = useRef<ChatModuleRef>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.pressedDown,
            ]}
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>‹</Text>
          </Pressable>
          <View>
            <Text style={[styles.header, { color: colors.text }]}>Тоглоомын заавар</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>
              5 тоглогч · ганцаарчилсан стратеги
            </Text>
          </View>
        </View>

        {/* TABS */}
        <View style={[styles.tabs, { backgroundColor: colors.sunken }]}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tabBtn,
                tab === t.key && { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t.key ? colors.text : colors.muted },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {tab === "gunshin" &&
          GUNSHIN.map((item) => (
            <View
              key={item.key}
              style={[
                styles.gunshinCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Image source={item.image} style={styles.image} resizeMode="contain" />
              <View style={styles.textWrap}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.rank, { color: colors.muted }]}>{item.rank}</Text>
                </View>
                <Text style={[styles.description, { color: colors.subText }]}>
                  {item.description}
                </Text>
              </View>
            </View>
          ))}

        {tab === "rules" &&
          RULES.map((rule) => (
            <View
              key={rule.num}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.titleRowLeft}>
                <View style={[styles.numBox, { backgroundColor: colors.sunken }]}>
                  <Text style={[styles.numText, { color: colors.subText }]}>{rule.num}</Text>
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{rule.title}</Text>
              </View>
              <Text style={[styles.description, { color: colors.subText, marginTop: 8 }]}>
                {rule.description}
              </Text>
            </View>
          ))}

        {tab === "score" &&
          FINALLY.map((item) => (
            <View
              key={item.key}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.description, { color: colors.subText, marginTop: 6 }]}>
                {item.description}
              </Text>
            </View>
          ))}

        <PushButton
          label="Ойлгомжгүй байна уу? Дүрэм асуу"
          color={colors.accent}
          shadowColor={colors.accentDark}
          onPress={() => chatModuleRef.current?.open()}
          style={{ marginTop: 4 }}
        />
      </ScrollView>

      <ChatModule ref={chatModuleRef} />
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },

  pressedDown: {
    transform: [{ translateY: 2 }],
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  backBtnText: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: -2,
  },

  header: {
    fontSize: 19,
    fontWeight: "800",
  },

  headerSub: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },

  tabs: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 14,
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
  },

  tabText: {
    fontSize: 13,
    fontWeight: "800",
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    paddingTop: 6,
    gap: 12,
  },

  gunshinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
  },

  card: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },

  titleRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  numBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  numText: {
    fontSize: 12,
    fontFamily: MONO,
  },

  title: {
    fontSize: 16,
    fontWeight: "800",
  },

  rank: {
    fontSize: 12,
    fontFamily: MONO,
  },

  description: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 19,
  },

  image: {
    width: 46,
    height: 74,
  },

  textWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
});
