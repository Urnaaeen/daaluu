import { isEndRule } from "../game/endRules.js";

/**
 * Санамсаргүй тоглогчдын дараалал.
 * ЗӨВХӨН санах ойд — түр зуурын мэдээлэл тул DB-д бичихгүй.
 * Дараалал 5 хүрэхэд тоглолт үүсч, тэр нь л `matches` хүснэгтэд бүртгэгдэнэ.
 */

export const QUEUE_SIZE = 5;

/** [{ userId, name, playerCode, joinedAt }] — орсон дарааллаараа */
let queue = [];

/** Дараалалд хамгийн түрүүнд орсон хүн төгсгөлийн дүрмийг сонгоно */
let endRule = "single";

const isOwner = (userId) => queue.length > 0 && queue[0].userId === userId;

export const getQueue = () => ({
  players: queue.map((p) => ({
    userId: p.userId,
    name: p.name,
    playerCode: p.playerCode,
  })),
  size: queue.length,
  needed: QUEUE_SIZE,
  endRule,
  ownerId: queue[0]?.userId ?? null,
});

export const inQueue = (userId) => queue.some((p) => p.userId === userId);

/**
 * Дараалалд нэмнэ. Аль хэдийн байвал давхарлахгүй.
 * Хамгийн эхний хүн орж ирэхэд дүрэм анхны утга руугаа буцна.
 */
export const joinQueue = ({ userId, name, playerCode }) => {
  if (inQueue(userId)) return { changed: false, state: getQueue() };

  if (queue.length === 0) endRule = "single";
  queue.push({ userId, name, playerCode, joinedAt: Date.now() });

  return { changed: true, state: getQueue() };
};

export const leaveQueue = (userId) => {
  const before = queue.length;
  queue = queue.filter((p) => p.userId !== userId);
  return { changed: queue.length !== before, state: getQueue() };
};

/** Зөвхөн эхний хүн дүрмээ солино */
export const setQueueRule = (userId, rule) => {
  if (!isOwner(userId)) {
    return { changed: false, error: "not_owner", state: getQueue() };
  }
  if (!isEndRule(rule)) {
    return { changed: false, error: "bad_end_rule", state: getQueue() };
  }
  if (endRule === rule) return { changed: false, state: getQueue() };

  endRule = rule;
  return { changed: true, state: getQueue() };
};

/**
 * Дараалалд байгаа бүх хүнийг гаргаж авна (тоглолт үүсгэхэд).
 * Дараалал хоосорно.
 */
export const drainQueue = () => {
  const players = [...queue];
  const rule = endRule;
  queue = [];
  endRule = "single";
  return { players, endRule: rule };
};

/** Тест болон дахин эхлүүлэхэд */
export const clearQueue = () => {
  queue = [];
  endRule = "single";
};
