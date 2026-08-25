import type { MatchMove } from "./socket";
import { tileViews, type TileView } from "./tiles";

/**
 * Дүрмийн шалгалтын ХУУЛБАР — зөвхөн дэлгэц дээр урьдчилан харуулахад.
 * Эрх мэдэлтэй нь server/src/game/rules.js хэвээр: энд зөвшөөрөгдсөн ч
 * сервер татгалзаж болно. Хоёуланг нь зэрэг өөрчилж байх ёстой.
 */

const LEAD_MIN_RANK = 8;

/** Нохой (color "") ямар ч өнгөтэй таарна */
const colorMatches = (a?: string, b?: string) => !a || !b || a === b;

const isPairTiles = (tiles: TileView[]) =>
  tiles.length === 2 && tiles[0].typeId === tiles[1].typeId;

const typeCounts = (hand: TileView[]) => {
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.typeId, (counts.get(t.typeId) ?? 0) + 1);
  return counts;
};

export type Lead = {
  seat: number;
  tiles: TileView[];
  isPair: boolean;
  refColor?: string;
};

/** Голд байгаа хамгийн том хөдөлгөөнийг олно */
export const currentLead = (moves: MatchMove[]): Lead | null => {
  if (!moves.length) return null;

  const withViews = moves.map((m) => ({ ...m, view: tileViews(m.tiles) }));
  const first = withViews[0];
  const refColor = first.isSecret ? undefined : first.view[0]?.color;

  let best: (typeof withViews)[number] | null = null;
  for (const m of withViews) {
    if (m.isSecret) continue; // нууц мод хэзээ ч тэргүүлэхгүй
    if (!colorMatches(m.view[0]?.color, refColor)) continue;
    if (!best || m.view[0].rank > best.view[0].rank) best = m;
  }
  if (!best) best = first;

  return {
    seat: best.seat,
    tiles: best.view,
    isPair: isPairTiles(best.view),
    refColor,
  };
};

const findColorPair = (
  hand: TileView[],
  refColor: string | undefined,
  wantHigher: boolean,
  refRank: number
) => {
  const counts = typeCounts(hand);
  return hand.some(
    (t) =>
      (counts.get(t.typeId) ?? 0) >= 2 &&
      colorMatches(t.color, refColor) &&
      (wantHigher ? t.rank > refRank : t.rank < refRank)
  );
};

const validateLead = (tiles: TileView[]): string | null => {
  if (tiles.length === 1) {
    return tiles[0].rank >= LEAD_MIN_RANK
      ? null
      : "Нэг модоор гарахад 8-аас дээш нүдтэй мод хэрэгтэй.";
  }
  if (tiles.length === 2) {
    return isPairTiles(tiles) ? null : "Хосоор гарахад ижил хоёр мод хэрэгтэй.";
  }
  return "Нэг мод эсвэл хос гаргана.";
};

const validateFollow = (hand: TileView[], tiles: TileView[], lead: Lead): string | null => {
  const refColor = lead.tiles[0].color;
  const refRank = lead.tiles[0].rank;

  if (lead.isPair) {
    if (tiles.length !== 2) return "Хос гарсан тул хоёр мод гаргана.";

    const hasHigher = findColorPair(hand, refColor, true, refRank);
    const hasLower = findColorPair(hand, refColor, false, refRank);

    if (hasHigher || hasLower) {
      if (!isPairTiles(tiles)) return "Ижил өнгийн хостой тул хосоо гаргах ёстой.";
      if (!colorMatches(tiles[0].color, refColor)) return "Гарсан өнгийг дагах ёстой.";
      if (hasHigher && tiles[0].rank <= refRank) return "Дээш ахиулж хосоо гаргана.";
      if (!hasHigher && hasLower && tiles[0].rank >= refRank) return "Доогуур хосоо гаргана.";
      return null;
    }

    // Ижил өнгийн хосгүй — ямар ч 2 мод (нууц мод болно)
    return null;
  }

  if (tiles.length !== 1) return "Нэг мод гаргана.";

  const mustBeat = hand.some((t) => colorMatches(t.color, refColor) && t.rank > refRank);
  if (mustBeat) {
    if (!colorMatches(tiles[0].color, refColor)) return "Гарсан өнгийг дагах ёстой.";
    if (tiles[0].rank <= refRank) return "Ахиулж том мод гаргах ёстой.";
  }

  return null;
};

/** @returns null бол зөв, эс бөгөөс шалтгаан */
export const validateMove = (
  hand: TileView[],
  tileIds: string[],
  lead: Lead | null
): string | null => {
  if (tileIds.length < 1 || tileIds.length > 2) return "Нэг эсвэл хоёр мод сонгоно.";
  if (new Set(tileIds).size !== tileIds.length) return "Нэг модыг хоёр удаа сонгож болохгүй.";

  const handIds = new Set(hand.map((t) => t.id));
  if (!tileIds.every((id) => handIds.has(id))) return "Тухайн мод гарт тань байхгүй байна.";

  const tiles = tileIds
    .map((id) => hand.find((t) => t.id === id))
    .filter((t): t is TileView => !!t);

  return lead ? validateFollow(hand, tiles, lead) : validateLead(tiles);
};

/**
 * Тухайн модыг сонгож болох уу.
 * Одоогийн сонголттой хамт ХУУЧИНТЭЙ хөдөлгөөн үүсгэх боломж байвал true.
 */
export const canSelectTile = (
  hand: TileView[],
  selected: string[],
  tileId: string,
  lead: Lead | null
): boolean => {
  // Сонгосон модоо буцааж тайлах үргэлж боломжтой
  if (selected.includes(tileId)) return true;

  if (selected.length === 0) {
    // Ганцаараа хүчинтэй юу
    if (validateMove(hand, [tileId], lead) === null) return true;
    // Эсвэл өөр модтой хослоод хүчинтэй болох уу
    return hand.some(
      (t) => t.id !== tileId && validateMove(hand, [tileId, t.id], lead) === null
    );
  }

  if (selected.length === 1) {
    return validateMove(hand, [selected[0], tileId], lead) === null;
  }

  return false;
};
