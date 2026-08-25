/**
 * Тоглоомын төгсгөлийн дүрмүүд.
 * Дизайны "Хэзээ дуусахыг сонго" дэлгэцтэй нэг мөр.
 */

export const END_RULES = [
  {
    id: "hands10",
    num: 1,
    title: "10 удаа мод хуваах",
    body: "50 модыг 5 тоглогчид 10-10-аар хувааж, 10 удаа хуваалт дуусмагц дүн гарна.",
    short: "10 хуваалт",
  },
  {
    id: "tsai10",
    num: 2,
    title: "10 цайд хүрэх",
    body: "Цай + авлага − өглөг нь 10 болсон тоглогч гармагц тоглоом дуусна.",
    short: "10 цай",
  },
  {
    id: "uglug6",
    num: 3,
    title: "6 өглөгтэй болох",
    body: "Ямар нэг тоглогч 6-аас дээш өглөгтэй болбол тоглоом тэр дор дуусна.",
    short: "6 өглөг",
  },
  {
    id: "single",
    num: 4,
    title: "Нэг л удаа хуваах",
    body: "Модоо нэг л удаа хувааж, тэр 10 модоо тоглож дуусаад тоглоомыг дүгнэнэ.",
    short: "Нэг хуваалт",
  },
];

/** Gamer хувилбар нээгдэх ялалтын тоо */
export const GAMER_UNLOCK_WINS = 20;

export const isEndRule = (id) => END_RULES.some((r) => r.id === id);

export const ruleShort = (id) => END_RULES.find((r) => r.id === id)?.short ?? id;

/** Эцсийн оноо: цай + авлага − өглөг */
const score = (p) => p.tsai + p.avlaga - p.uglug;

/**
 * Майхан (нэг хуваалт) дуусахад тоглоом төгсөх ёстой эсэх.
 * @param rule      end_rule
 * @param players   [{ tsai, avlaga, uglug }] — худалдаа хийгдсэний ДАРААХ утга
 * @param maikhanNo хэдэн удаа хуваасан
 */
export const shouldEnd = (rule, players, maikhanNo) => {
  switch (rule) {
    case "single":
      return { ended: true, reason: "single" };

    case "hands10":
      return maikhanNo >= 10
        ? { ended: true, reason: "hands10" }
        : { ended: false };

    case "tsai10":
      return players.some((p) => score(p) >= 10)
        ? { ended: true, reason: "tsai10" }
        : { ended: false };

    case "uglug6":
      // Дизайны дагуу "6-аас ДЭЭШ" — өөрөөр хэлбэл 7-оос эхэлнэ
      return players.some((p) => p.uglug > 6)
        ? { ended: true, reason: "uglug6" }
        : { ended: false };

    default:
      return { ended: true, reason: "unknown_rule" };
  }
};
