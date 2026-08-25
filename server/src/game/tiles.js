import crypto from "node:crypto";
import { query } from "../db.js";

/**
 * Модны лавлах. Сервер асахад DB-ээс нэг удаа уншаад санах ойд барина.
 * Клиентээс ирсэн rank/color-д ХЭЗЭЭ Ч итгэхгүй — бүгд эндээс.
 */
let byType = new Map();

export const loadTileTypes = async () => {
  const { rows } = await query(
    "select type_id, title, color, rank, copies from tile_types order by rank desc"
  );
  byType = new Map(rows.map((r) => [r.type_id, r]));
  return byType.size;
};

export const tileType = (typeId) => byType.get(typeId) ?? null;

export const SECRET_TYPE = "nuuts";
export const SECRET_RANK = 1;

/** "ulaan_daaluu_Даалуу_3" → "ulaan_daaluu_Даалуу" (сүүлийн _тоо-г л огтолно) */
export const typeOf = (tileId) => String(tileId).replace(/_(\d+)$/, "");

/** Модны бүрэн мэдээлэл. Танихгүй мод бол null — хуурсан гэсэн үг. */
export const describe = (tileId) => {
  const type = tileType(typeOf(tileId));
  if (!type) return null;
  return { id: tileId, typeId: type.type_id, title: type.title, color: type.color, rank: type.rank };
};

/** Мод жагсаалтыг бүрэн мэдээлэл болгоно. Аль нэг нь танигдахгүй бол null. */
export const describeAll = (tileIds) => {
  const out = [];
  for (const id of tileIds) {
    const t = describe(id);
    if (!t) return null;
    out.push(t);
  }
  return out;
};

/** 50 модны тавцан */
export const buildDeck = () => {
  const deck = [];
  for (const t of byType.values()) {
    for (let i = 1; i <= t.copies; i++) deck.push(`${t.type_id}_${i}`);
  }
  return deck;
};

/** Fisher–Yates, crypto санамсаргүйгээр — таамаглах боломжгүй */
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 50 модыг 5 суудалд 10-аар тараана */
export const dealHands = () => {
  const deck = shuffle(buildDeck());
  if (deck.length !== 50) throw new Error(`Тавцан ${deck.length} мод байна, 50 байх ёстой`);

  const hands = [[], [], [], [], []];
  for (let i = 0; i < 50; i++) hands[i % 5].push(deck[i]);
  return hands;
};

/** Хоёр мод хос мөн үү (ижил төрөл) */
export const isPair = (tiles) => tiles.length === 2 && tiles[0].typeId === tiles[1].typeId;

/**
 * Өнгө таарч байна уу.
 * Нохой (color null) ямар ч өнгөтэй таарна.
 */
export const colorMatches = (a, b) => !a || !b || a === b;
