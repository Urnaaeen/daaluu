/**
 * Төгсгөлийн дүрмийн товч нэрс.
 * Эрх мэдэлтэй жагсаалт нь server/src/game/endRules.js —
 * энд зөвхөн дэлгэц дээр богиноор бичихэд ашиглана.
 */
export const END_RULE_SHORT: Record<string, string> = {
  hands10: "10 хуваалт",
  tsai10: "10 цай",
  uglug6: "6 өглөг",
  single: "Нэг хуваалт",
};

export const endRuleShort = (id?: string) => (id ? END_RULE_SHORT[id] ?? id : "");
