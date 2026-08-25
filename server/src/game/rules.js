import { colorMatches, describeAll, isPair, SECRET_RANK } from "./tiles.js";

/**
 * Дүрмийн цэвэр функцууд. DB-д хандахгүй — зөвхөн тооцоолол.
 * Апп доторх playScreen.tsx-ийн логиктой ижил, гэхдээ эндхийг л эрх мэдэлтэй гэж үзнэ.
 */

const LEAD_MIN_RANK = 8;

/** Гарт хэдэн ижил төрлийн мод байгааг тоолно */
const typeCounts = (hand) => {
  const counts = new Map();
  for (const t of hand) counts.set(t.typeId, (counts.get(t.typeId) ?? 0) + 1);
  return counts;
};

/** Тухайн гараар эхлэх (гарааг нээх) эрхтэй юу */
export const canLead = (hand) => {
  if (!hand.length) return false;
  if (hand.some((t) => t.rank >= LEAD_MIN_RANK)) return true;
  return [...typeCounts(hand).values()].some((n) => n >= 2);
};

/** Гар нээх хөдөлгөөн зөв үү */
const validateLead = (tiles) => {
  if (tiles.length === 1) {
    return tiles[0].rank >= LEAD_MIN_RANK
      ? null
      : "Нэг модоор гарахад 8-аас дээш нүдтэй мод хэрэгтэй.";
  }
  if (tiles.length === 2) {
    return isPair(tiles) ? null : "Хосоор гарахад ижил хоёр мод хэрэгтэй.";
  }
  return "Нэг мод эсвэл хос гаргана.";
};

/** Гарт ижил өнгийн, өгөгдсөн эрэмбээс дээш/доош хос байна уу */
const findColorPair = (hand, refColor, wantHigher, refRank) => {
  const counts = typeCounts(hand);
  return hand.some(
    (t) =>
      (counts.get(t.typeId) ?? 0) >= 2 &&
      colorMatches(t.color, refColor) &&
      (wantHigher ? t.rank > refRank : t.rank < refRank)
  );
};

/**
 * Гарааг дагаж мод гаргах хөдөлгөөнийг шалгана.
 * @param hand     тоглогчийн гар (бүрэн мэдээлэлтэй)
 * @param tiles    гаргах гэж буй мод
 * @param lead     { tiles, isPair } — голд байгаа одоогийн хамгийн том
 */
const validateFollow = (hand, tiles, lead) => {
  const refColor = lead.tiles[0].color;
  const refRank = lead.tiles[0].rank;

  if (lead.isPair) {
    if (tiles.length !== 2) return "Хос гарсан тул хоёр мод гаргана.";

    const hasHigher = findColorPair(hand, refColor, true, refRank);
    const hasLower = findColorPair(hand, refColor, false, refRank);

    // Ижил өнгийн хос байвал заавал түүнийг гаргана
    if (hasHigher || hasLower) {
      if (!isPair(tiles)) return "Ижил өнгийн хостой тул хосоо гаргах ёстой.";
      if (!colorMatches(tiles[0].color, refColor)) return "Гарсан өнгийг дагах ёстой.";
      if (hasHigher && tiles[0].rank <= refRank) return "Дээш ахиулж хосоо гаргана.";
      if (!hasHigher && hasLower && tiles[0].rank >= refRank) return "Доогуур хосоо гаргана.";
      return null;
    }

    // Ижил өнгийн хосгүй бол ямар ч 2 мод — нууц мод болно
    return null;
  }

  if (tiles.length !== 1) return "Нэг мод гаргана.";

  // Өнгө дагаж ахиулах мод байвал заавал ахиулна
  const mustBeat = hand.some((t) => colorMatches(t.color, refColor) && t.rank > refRank);
  if (mustBeat) {
    if (!colorMatches(tiles[0].color, refColor)) return "Гарсан өнгийг дагах ёстой.";
    if (tiles[0].rank <= refRank) return "Ахиулж том мод гаргах ёстой.";
  }

  // Ахиулах мод байхгүй бол өнгө үл харгалзан муу мод өгч болно
  return null;
};

/**
 * Хөдөлгөөнийг бүрэн шалгана.
 * @returns { ok: true, tiles, isSecret } эсвэл { ok: false, reason }
 */
export const validateMove = ({ hand, tileIds, lead }) => {
  if (!Array.isArray(tileIds) || tileIds.length < 1 || tileIds.length > 2) {
    return { ok: false, reason: "Нэг эсвэл хоёр мод сонгоно." };
  }

  if (new Set(tileIds).size !== tileIds.length) {
    return { ok: false, reason: "Нэг модыг хоёр удаа сонгож болохгүй." };
  }

  // Гартаа байгаа мод мөн эсэх — хамгийн чухал шалгалт
  const handIds = new Set(hand.map((t) => t.id));
  if (!tileIds.every((id) => handIds.has(id))) {
    return { ok: false, reason: "Тухайн мод гарт тань байхгүй байна." };
  }

  const tiles = describeAll(tileIds);
  if (!tiles) return { ok: false, reason: "Мод танигдахгүй байна." };

  const reason = lead ? validateFollow(hand, tiles, lead) : validateLead(tiles);
  if (reason) return { ok: false, reason };

  // Хосгүй 2 мод — нууц мод болж хаагдана
  const isSecret = tiles.length === 2 && !isPair(tiles);

  return { ok: true, tiles, isSecret };
};

/**
 * Голд байгаа хамгийн том хөдөлгөөнийг олно.
 * @param moves [{ seat, tiles, isSecret }] — гарын дарааллаар
 */
export const currentLead = (moves) => {
  if (!moves.length) return null;

  const refColor = moves[0].isSecret ? null : moves[0].tiles[0].color;
  let best = null;

  for (const m of moves) {
    if (m.isSecret) continue; // нууц мод хэзээ ч тэргүүлэхгүй
    if (!colorMatches(m.tiles[0].color, refColor)) continue;
    if (!best || m.tiles[0].rank > best.tiles[0].rank) best = m;
  }

  if (!best) best = moves[0];

  return {
    seat: best.seat,
    tiles: best.tiles,
    isPair: isPair(best.tiles),
    refColor,
  };
};

/**
 * Гарын ялагчийг тодорхойлно.
 * @returns { seat, gained } — gained нь авах гэрийн тоо (хос бол 2)
 */
export const roundWinner = (moves) => {
  const refColor = moves[0].isSecret ? null : moves[0].tiles[0].color;

  let bestSeat = moves[0].seat;
  let bestRank = -Infinity;
  let bestIsPair = false;

  for (const m of moves) {
    const rank = m.isSecret ? SECRET_RANK : m.tiles[0].rank;
    const color = m.isSecret ? null : m.tiles[0].color;

    // Нууц мод болон өнгө дагаагүй мод хожихгүй
    if (m.isSecret) continue;
    if (!colorMatches(color, refColor)) continue;

    if (rank > bestRank) {
      bestRank = rank;
      bestSeat = m.seat;
      bestIsPair = isPair(m.tiles);
    }
  }

  return { seat: bestSeat, gained: bestIsPair ? 2 : 1, wasPair: bestIsPair };
};

/**
 * Гар дуусахад хэн эхлэхийг олно.
 * Ялагч эхлэх эрхгүй бол дараагийн суудал руу шилжинэ.
 * @returns { seat } эсвэл { seat: null, highestSeat } — хэн ч эхлэх эрхгүй
 */
export const nextLeader = (winnerSeat, handsBySeat) => {
  for (let i = 0; i < 5; i++) {
    const seat = (winnerSeat + i) % 5;
    if (canLead(handsBySeat[seat] ?? [])) return { seat };
  }

  // Хэн ч эхлэх эрхгүй — хамгийн том модтой нь гэр авна
  let highestSeat = null;
  let highestRank = -Infinity;
  for (let seat = 0; seat < 5; seat++) {
    for (const t of handsBySeat[seat] ?? []) {
      if (t.rank > highestRank) {
        highestRank = t.rank;
        highestSeat = seat;
      }
    }
  }

  return { seat: null, highestSeat };
};
