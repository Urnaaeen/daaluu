const TILE_TYPES = [
    { typeId: "ulaan_zurgaa_Нохой", color: "", title: "Нохой", rank: 16, count: 2, image: require("../assets/objects/6_2_1.png"), description: "Зуудаг нохойн зулзага\nЗургаан нүхтэй даалуу" },
    { typeId: "ulaan_daaluu_Даалуу", color: "ulaan", title: "Даалуу", rank: 12, count: 2, image: require("../assets/objects/12.png"), description: "Даа хамбан даалнн\nДахаа чирсэн хулгайч" },
    { typeId: "tsagaan_uuluu_Үүлүү", color: "tsagaan", title: "Үүлүү", rank: 11, count: 2, image: require("../assets/objects/11.png"), description: "Хуран цэргийн ханжин\nХурандаа цолтой хуутуу" },
    { typeId: "tsagaan_arav_Бажгар арав", color: "tsagaan", title: "Бажгар арав", rank: 10, count: 2, image: require("../assets/objects/10_1.png"), description: "Хар арав Хандын найз\nХанд хүүхэн миний найз" },
    { typeId: "ulaan_arav_Сийлүү арав", color: "ulaan", title: "Сийлүү арав", rank: 10, count: 2, image: require("../assets/objects/10_2.png"), description: "Сэндэр модны хайлаас\nСэнтийж байвал сийлүү" },
    { typeId: "tsagaan_ys_Дэгээ ес", color: "tsagaan", title: "Дэгээ ес", rank: 9, count: 2, image: require("../assets/objects/9_1.png"), description: "Дэгээ есөнд дээлээ уруулж\nДэгжин хүүхэн нүүрээ маажуул" },
    { typeId: "ulaan_ys_Гавал ес", color: "ulaan", title: "Гавал ес", rank: 9, count: 2, image: require("../assets/objects/9_2.png"), description: "Толгой дээгүүр сэнгэнэдэг\nДоржсэндэн гавал" },
    { typeId: "tsagaan_naim_Дөнгө найм", color: "tsagaan", title: "Дөнгө найм", rank: 8, count: 2, image: require("../assets/objects/8_1.png"), description: "Дөнгөн сээрийн мөнгөн хүзүү\nДөрвөн далайн тэлээгүй түшмэл" },
    { typeId: "tsagaan_naim2_Муруй найм", color: "tsagaan", title: "Муруй найм", rank: 8, count: 2, image: require("../assets/objects/8_1_1.png"), description: "Тэмээ наймын тэнгэр мэдэг\nТэнэсэн бандийн аз мэдэг" },
    { typeId: "ulaan_naim_Чавганц найм", color: "ulaan", title: "Чавганц найм", rank: 8, count: 2, image: require("../assets/objects/8_2.png"), description: "Наян жил насалсан\nНамбигар улаан чавганцаа" },
    { typeId: "tsagaan_doloo_Сарлаг долоо", color: "tsagaan", title: "Сарлаг долоо", rank: 7, count: 2, image: require("../assets/objects/7_1.png"), description: "Долоо уулын сарлаг\nДогшин газрын садваг" },
    { typeId: "ulaan_doloo_Шанага долоо", color: "ulaan", title: "Шанага долоо", rank: 7, count: 2, image: require("../assets/objects/7_2_1.png"), description: "Долоон бурхан шинжтэй\nДолнуур авгайн шанага" },
    { typeId: "ulaan_doloo2_Шор долоо", color: "ulaan", title: "Шор долоо", rank: 7, count: 4, image: require("../assets/objects/7_2_2.png"), description: "Гонзгор долоо гоохолзоно\nГовийн хүүхэн шоохолзоно" },

    { typeId: "tsagaan_zurgaa_Чанс зургаа", color: "tsagaan", title: "Чанс зургаа", rank: 6, count: 4, image: require("../assets/objects/6_1.png"), description: "Ханан хээтэй чанс\nХаяа голын бургас" },
    { typeId: "ulaan_zurgaa2_Булуу зургаа", color: "ulaan", title: "Булуу зургаа", rank: 6, count: 4, image: require("../assets/objects/6_2_2.png"), description: "Булуу зургаа будантай\nБуцаад ирэхэд манантай" },
    { typeId: "tsagaan_tav_Чүү тав", color: "tsagaan", title: "Чүү тав", rank: 5, count: 2, image: require("../assets/objects/5.png"), description: "Хайргүй хатгаж нойргүй\nХонуулдаг алтан чүү тав" },
    { typeId: "tsagaan_duruv_Банд", color: "tsagaan", title: "Банд", rank: 4, count: 4, image: require("../assets/objects/4_1.png"), description: "Вандан суудал\nЗандан ширээ" },
    { typeId: "ulaan_duruv_Бөхөөн дөрөв", color: "ulaan", title: "Бөхөөн дөрөв", rank: 4, count: 4, image: require("../assets/objects/4_2.png"), description: "Өөхий бөөхий дөрөв\nӨвчүү номин шаргал" },
    { typeId: "ulaan_hoyr_Ёоз", color: "ulaan", title: "Ёоз", rank: 2, count: 4, image: require("../assets/objects/2.png"), description: "Хон хэрээний нүд\nХоёр нүдний дуран" },
    { typeId: "nuuts", color: "ulaantsagaan", title: "Нууц", rank: -1, count: 0, image: require("../assets/objects/secret.png"), description: "" },
]

function createDeck() {
  const deck = [];
  for (const t of TILE_TYPES) {
    for (let i = 1; i <= t.count; i++) {
      deck.push({ ...t, id: `${t.typeId}_${i}`, copyIndex: i });
    }
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal5(deck) {
  const shuffled = shuffle(deck);
  const hands = [[], [], [], [], []];
  for (let i = 0; i < 50; i++) hands[i % 5].push(shuffled[i]);
  return hands;
}

module.exports = { createDeck, shuffle, deal5 };