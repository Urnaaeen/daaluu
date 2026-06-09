import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

const RULES = [
  {
    key: "janlii",
    title: "Цай",
    description: "Цай хураах тоглоомонд 10 модыг цай гэж нэрлэж тусад нь авах бөгөөд 5 тоглогч бүрт тэнцүү хувааж тоглоом эхлэнэ. Өөрөөр хэлбэл оноо бүртгэхэд ашиглагддаг моднууд",
    icon: "👑",
    images: [
      require("../assets/objects/9_1.png"),
    ],
  },
  {
    key: "chai",
    title: "Гарын мод",
    description: "Хар, цагаан нийлсэн 50 ширхэг модыг хольж, тоглогч бүр 10 модтойгоор тоглоомыг эхлүүлнэ.",
    icon: "☕",
    images: [
      require("../assets/objects/4_2.png"),
    ],
  },
  {
    key: "muumod",
    title: "Өнгө нэрлэх",
    description: "Хос жанлийтай тоглогч гарахдаа ямар өнгийн ус дуудахаа сонгох бөгөөд хамгийн том усыг дуудаж идэх боломжтой.",
    icon: "🚫",
    images: [
      require("../assets/objects/11.png"),
    ],
  },
  {
    key: "muumod",
    title: "Өнгө дагуулах",
    description: "Тоглогч хос гаргах үед дараа дараагийн тоглогчид гарч буй ижил өнгийн ус модоо өгнө.",
    icon: "🚫",
    images: [
      require("../assets/objects/11.png"),
    ],
  },
  {
    key: "muumod",
    title: "Мод гарах",
    description: "нэг модоор гарах бол 8 буюу түүнээс дээш нүдтэй модоор гарна. Хос мод буюу усаар гарах үед нүдний тоо үл хамаарна.",
    icon: "🚫",
    images: [
      require("../assets/objects/11.png"),
    ],
  },
  {
    key: "muumod",
    title: "Мод ахиулах",
    description: "Жанлийгаас бусад модыг заавал өнгө дагуу ахиулж тавих ёстой. Ахиулж идээгүй тохиолдолд тухайн том мод ямар ч хэрэггүй муу мод болж үхдэг.",
    icon: "🚫",
    images: [
      require("../assets/objects/11.png"),
    ],
  },
  {
    key: "muumod",
    title: "Муу мод өгөх",
    description: "Гарааг ахиулах модгүй тохиолдолд өнгө үл харгалзан муу мод өгч болно.",
    icon: "🚫",
    images: [
      require("../assets/objects/11.png"),
    ],
  },
  {
    key: "muumod",
    title: "Муу үхэх",
    description: "Гараа хос жанлийгаа гаргалгуй өнгөрвөл жанлий үхдэг. Мөн ус дуудах үед, өнгө дагасан хос авч үлдвэл үхдэг.",
    icon: "🚫",
    images: [
      require("../assets/objects/11.png"),
    ],
  },
];

const FINALLY = [
  {
    key: "janlii",
    title: "Ялагч",
    description: "Тоглолтын төгсгөлд хамгийн их цай хураасан тоглогч ялагч болно. Нийт цайг авлага оролцуулан тоооцно.",
    icon: "👑",
    images: [
      require("../assets/objects/9_1.png"),
    ],
  },
  {
    key: "chai",
    title: "Гэр авах",
    description: "Бүх мод дуусах үед гэр босгож чадаагүй бол 2-оос илүү гэртэй хүнээс өөрт буй цайгаар худалдаж авах эсвэл зээлнэ.",
    icon: "☕",
    images: [
      require("../assets/objects/4_2.png"),
    ],
  },
  {
    key: "chai",
    title: "Цай авах",
    description: "Бүх мод дуусах үед 2-оос их гэр барьсан тоглогч гэр бариагүй тоглогчид гэрээ цайгаар зарах эсвэл авлагатай болно.",
    icon: "☕",
    images: [
      require("../assets/objects/4_2.png"),
    ],
  }
];

const TSAGAAN_TILES = [
  {
    key: "uuluu",
    title: "Үүлүү",
    description: "Хуран цэргийн ханжин\nХурандаа цолтой хуутуу",
    image: require("../assets/objects/11.png"),
  },
  {
    key: "arav",
    title: "Бажгар арав",
    description: "Хар арав Хандын найз\nХанд хүүхэн миний найз",
    image: require("../assets/objects/10_1.png"),
  },
  {
    key: "ys",
    title: "Дэгээ ес",
    description: "Дэгээ есөнд дээлээ уруулж\nДэгжин хүүхэн нүүрээ маажуул",
    image: require("../assets/objects/9_1.png"),
  },
  {
    key: "naim",
    title: "Дөнгө найм",
    description: "Дөнгөн сээрийн мөнгөн хүзүү\nДөрвөн далайн тэлээгүй түшмэл",
    image: require("../assets/objects/8_1.png"),
  },
  {
    key: "naim",
    title: "Муруй найм",
    description: "Тэмээ наймын тэнгэр мэдэг\nТэнэсэн бандийн аз мэдэг",
    image: require("../assets/objects/8_1_1.png"),
  },
  {
    key: "doloo",
    title: "Сарлаг долоо",
    description: "Долоо уулын сарлаг\nДогшин газрын садваг",
    image: require("../assets/objects/7_1.png"),
  },
  {
    key: "zurgaa",
    title: "Чанс зургаа",
    description: "Ханан хээтэй чанс\nХаяа голын бургас",
    image: require("../assets/objects/6_1.png"),
  },
  {
    key: "tav",
    title: "Чүү тав",
    description: "Хайргүй хатгаж нойргүй\nХонуулдаг алтан чүү тав",
    image: require("../assets/objects/5.png"),
  },
    {
    key: "duruv",
    title: "Банд",
    description: "Вандан суудал\nЗандан ширээ",
    image: require("../assets/objects/4_1.png"),
  },
];

const ULAAN_TILES = [
  {
    key: "daaluu",
    title: "Даалуу",
    description: "Даа хамбан даалнн\nДахаа чирсэн хулгайч",
    image: require("../assets/objects/12.png"),
  },
  {
    key: "arav",
    title: "Сийлүү арав",
    description: "Сэндэр модны хайлаас\nСэнтийж байвал сийлүү",
    image: require("../assets/objects/10_2.png"),
  },
  {
    key: "ys",
    title: "Гавал ес",
    description: "Толгой дээгүүр сэнгэнэдэг\nДоржсэндэн гавал",
    image: require("../assets/objects/9_2.png"),
  },
  {
    key: "naim",
    title: "Чавганц найм",
    description: "Наян жил насалсан\nНамбигар улаан чавганцаа",
    image: require("../assets/objects/8_2.png"),
  },
  {
    key: "doloo",
    title: "Шанага долоо",
    description: "Долоон бурхан шинжтэй\nДолнуур авгайн шанага",
    image: require("../assets/objects/7_2_1.png"),
  },
  {
    key: "doloo",
    title: "Шор долоо",
    description: "Гонзгор долоо гоохолзоно\nГовийн хүүхэн шоохолзоно",
    image: require("../assets/objects/7_2_2.png"),
  },
  {
    key: "zurgaa",
    title: "Нохой",
    description: "Зуудаг нохойн зулзага\nЗургаан нүхтэй даалуу",
    image: require("../assets/objects/6_2_1.png"),
  },
  {
    key: "zurgaa",
    title: "Булуу зургаа",
    description: "Булуу зургаа будантай\nБуцаад ирэхэд манантай",
    image: require("../assets/objects/6_2_2.png"),
  },
  {
    key: "duruv",
    title: "Бөхөөн дөрөв",
    description: "Өөхий бөөхий дөрөв\nӨвчүү номин шаргал",
    image: require("../assets/objects/4_2.png"),
  },
  {
    key: "hoyr",
    title: "Ёоз",
    description: "Хон хэрээний нүд\nХоёр нүдний дуран",
    image: require("../assets/objects/2.png"),
  },
];

const CARD_WIDTH = 260;

/* ================= COMPONENT ================= */

export default function Rules() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >

      <Text style={[styles.header, { color: colors.text }]}>
        Цай хураах
      </Text>
      <Text style={[{ color: colors.text }]}>
        5 тоглогчтой, ганцаарчилсан стратеги
      </Text>
      <Text style={[{ color: colors.text }]}>
        Даалуу нь монголчуудын нийтлэг тоглоомнуудын нэг. 
        Цай хураах тоглоомын зорилго нь нэг тоглогч бүх цайг хураахад оршино.
      </Text>

      {/* ===== МОДНЫ ГУНШИН ===== */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Модны гуншин
        </Text>

        {/* ЦАГААН */}
        <Text style={[styles.subTitle, { color: colors.subText }]}>
          Цагаан
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TSAGAAN_TILES.map(item => (
            <View
              key={item.key}
              style={[
                styles.gunshinCard,
                { width: CARD_WIDTH, backgroundColor: colors.card },
              ]}
            >
              <Image source={item.image} style={styles.image} />

              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.description, { color: colors.subText }]}
                >
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* УЛААН */}
        <Text style={[styles.subTitle, { color: colors.subText }]}>
          Улаан
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ULAAN_TILES.map(item => (
            <View
              key={item.key}
              style={[
                styles.gunshinCard,
                { width: CARD_WIDTH, backgroundColor: colors.card },
              ]}
            >
              <Image source={item.image} style={styles.image} />

              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.description, { color: colors.subText }]}
                >
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ===== Дүрэм ===== */}
      <Text style={[styles.header, { color: colors.text }]}>
        Дүрэм
      </Text>

      <View style={{ height: 190 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {RULES.map(rule => (
            <View
              key={rule.key}
              style={[
                styles.card,
                { backgroundColor: colors.card },
              ]}
            >
              <View style={styles.textSection}>
                <View style={styles.titleRow}>
                  <Text style={styles.icon}>{rule.icon}</Text>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {rule.title}
                  </Text>
                </View>

                <Text
                  style={[styles.description, { color: colors.subText }]}
                >
                  {rule.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ===== Оноо тооцох ===== */}
      <Text style={[styles.header, { color: colors.text }]}>
        Оноо тооцох
      </Text>

      <View style={{ height: 190 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FINALLY.map(success => (
            <View
              key={success.key}
              style={[
                styles.card,
                { backgroundColor: colors.card },
              ]}
            >
              <View style={styles.textSection}>
                <View style={styles.titleRow}>
                  <Text style={styles.icon}>{success.icon}</Text>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {success.title}
                  </Text>
                </View>

                <Text
                  style={[styles.description, { color: colors.subText }]}
                >
                  {success.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

/* ================= STYLES (NO COLORS) ================= */

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingLeft: 16,
    flex: 1,
  },

  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },

  subTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  card: {
    width: 300,
    borderRadius: 24,
    padding: 16,
    marginRight: 14,
  },

  gunshinCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    padding: 14,
    marginRight: 14,
  },

  textSection: {
    marginBottom: 16,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  icon: {
    fontSize: 22,
    marginRight: 8,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
  },

  description: {
    fontSize: 14,
    lineHeight: 20,
  },

  imageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },

  image: {
    width: 44,
    height: 78,
    marginRight: 6,
    marginBottom: 8,
    borderRadius: 10,
  },

  textWrap: {
    flex: 1,
    justifyContent: "center",
  },
});
