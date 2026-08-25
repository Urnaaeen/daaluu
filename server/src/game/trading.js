/**
 * Майхан дуусахад хийгдэх худалдаа.
 * app/trading.ts-ийн логикийг сервер тал руу буулгав.
 *
 * 2-оос дээш гэртэй нь илүүгээ зарна, 2-оос доош нь дутуугаа авна.
 * Худалдан авагч цайтай бол цайгаар төлнө, үгүй бол өглөг үүснэ.
 */

export const TARGET_GER = 2;

/** Тоглоом дуусах босго */
export const WIN_TSAI = 10;
export const MAX_UGLUG = 10;

/**
 * @param players [{ seat, ger, tsai, avlaga, uglug }] — 5 ширхэг
 * @returns { players, trades }
 */
export const runTrading = (players) => {
  const state = players.map((p) => ({ ...p }));
  const bySeat = new Map(state.map((p) => [p.seat, p]));

  const sellers = state.filter((p) => p.ger > TARGET_GER);
  const buyers = state.filter((p) => p.ger < TARGET_GER);

  const trades = [];
  let si = 0;
  let bi = 0;

  while (si < sellers.length && bi < buyers.length) {
    const seller = sellers[si];
    const buyer = buyers[bi];

    const amount = Math.min(seller.ger - TARGET_GER, TARGET_GER - buyer.ger);
    if (amount <= 0) break;

    trades.push({ from: seller.seat, to: buyer.seat, amount });
    seller.ger -= amount;
    buyer.ger += amount;

    if (seller.ger === TARGET_GER) si++;
    if (buyer.ger === TARGET_GER) bi++;
  }

  // Гэр тус бүрийг цайгаар төлнө, цай дуусвал өглөг болно
  for (const trade of trades) {
    const seller = bySeat.get(trade.from);
    const buyer = bySeat.get(trade.to);

    for (let i = 0; i < trade.amount; i++) {
      if (buyer.tsai > 0) {
        buyer.tsai--;
        seller.tsai++;
      } else {
        buyer.uglug++;
        seller.avlaga++;
      }
    }
  }

  return { players: state, trades };
};

/** Тоглоом дуусах ёстой юу */
export const checkGameEnd = (players) => {
  if (players.some((p) => p.tsai >= WIN_TSAI)) return { ended: true, reason: "tsai" };
  if (players.some((p) => p.uglug >= MAX_UGLUG)) return { ended: true, reason: "uglug" };
  return { ended: false };
};

/** Эцсийн оноо: цай + авлага − өглөг */
export const finalScore = (p) => p.tsai + p.avlaga - p.uglug;

/** Байр эрэмбэлнэ (1-ээс эхэлнэ) */
export const rankPlayers = (players) =>
  [...players]
    .map((p) => ({ ...p, final_score: finalScore(p) }))
    .sort((a, b) => b.final_score - a.final_score)
    .map((p, i) => ({ ...p, place: i + 1 }));
