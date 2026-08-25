import { validateMove } from "./rules.js";
import { colorMatches } from "./tiles.js";

/**
 * Ботын мод сонголт. app/botlogic.ts-ийн стратегийг сервер рүү буулгав.
 * Сонголтоо буцаахаасаа өмнө өөрийгөө validateMove-оор шалгана —
 * бот ч дүрэм зөрчсөн мод гаргах боломжгүй.
 */

const LEAD_MIN_RANK = 8;

/** Гарт байгаа бүх хосыг олно */
const findPairs = (hand) => {
  const byType = new Map();
  for (const t of hand) {
    const arr = byType.get(t.typeId) ?? [];
    arr.push(t);
    byType.set(t.typeId, arr);
  }
  return [...byType.values()].filter((a) => a.length >= 2).map((a) => [a[0], a[1]]);
};

const byRankDesc = (a, b) => b.rank - a.rank;
const byRankAsc = (a, b) => a.rank - b.rank;

/** Гар нээх: хос байвал хамгийн том хос, үгүй бол 8+ модны хамгийн том нь */
const selectLead = (hand) => {
  const pairs = findPairs(hand);
  if (pairs.length) return [...pairs].sort((x, y) => y[0].rank - x[0].rank)[0];

  const strong = hand.filter((t) => t.rank >= LEAD_MIN_RANK);
  if (strong.length) return [[...strong].sort(byRankDesc)[0]];

  // Эхлэх эрхгүй — хамгийн том модоо гаргана (дүрмээр татгалзана)
  return [[...hand].sort(byRankDesc)[0]];
};

/** Нэгээр дагах: ахиулж чадвал хамгийн том, үгүй бол хамгийн жижгээ хаяна */
const selectSingle = (hand, lead) => {
  const ref = lead.tiles[0];
  const beats = hand.filter((t) => colorMatches(t.color, ref.color) && t.rank > ref.rank);
  if (beats.length) return [[...beats].sort(byRankDesc)[0]];
  return [[...hand].sort(byRankAsc)[0]];
};

/** Хосоор дагах */
const selectPair = (hand, lead) => {
  const ref = lead.tiles[0];
  const pairs = findPairs(hand);

  const higher = pairs.filter((p) => colorMatches(p[0].color, ref.color) && p[0].rank > ref.rank);
  if (higher.length) return [...higher].sort((x, y) => y[0].rank - x[0].rank)[0];

  const lower = pairs.filter((p) => colorMatches(p[0].color, ref.color) && p[0].rank < ref.rank);
  if (lower.length) return [...lower].sort((x, y) => y[0].rank - x[0].rank)[0];

  // Ижил өнгийн хосгүй — хамгийн жижиг 2 мод (нууц мод болно)
  const sorted = [...hand].sort(byRankAsc);
  return sorted.length >= 2 ? [sorted[0], sorted[1]] : [sorted[0]];
};

/**
 * Ботын хөдөлгөөнийг сонгоно.
 * @returns мод id-ийн массив, эсвэл null (гаргах мод байхгүй)
 */
export const chooseBotMove = (hand, lead) => {
  if (!hand.length) return null;

  const pick = !lead ? selectLead(hand) : lead.isPair ? selectPair(hand, lead) : selectSingle(hand, lead);
  const ids = pick.filter(Boolean).map((t) => t.id);

  if (validateMove({ hand, tileIds: ids, lead }).ok) return ids;

  // Сонголт дүрэмд нийцээгүй бол бүх боломжийг шалгаж хүчинтэйг нь олно
  return firstLegalMove(hand, lead);
};

/**
 * Хүчинтэй ямар нэг хөдөлгөөн олно.
 * Ээлжийн хугацаа дуусахад автоматаар мод гаргахад мөн ашиглана —
 * хамгийн бага үнэтэй хувилбарыг сонгоно.
 */
export const firstLegalMove = (hand, lead) => {
  const asc = [...hand].sort(byRankAsc);

  // Эхлээд нэг мод
  for (const t of asc) {
    if (validateMove({ hand, tileIds: [t.id], lead }).ok) return [t.id];
  }

  // Дараа нь хос / хоёр мод
  for (const p of findPairs(hand)) {
    const ids = [p[0].id, p[1].id];
    if (validateMove({ hand, tileIds: ids, lead }).ok) return ids;
  }

  for (let i = 0; i < asc.length; i++) {
    for (let j = i + 1; j < asc.length; j++) {
      const ids = [asc[i].id, asc[j].id];
      if (validateMove({ hand, tileIds: ids, lead }).ok) return ids;
    }
  }

  return null;
};
