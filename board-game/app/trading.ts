// app/trading.ts

export type PlayerScore = {
    stars: number;
    tsai: number;
    avlaga: number;
    uglug: number;
};

export type OpponentScore = {
    id: string;
    name: string;
    stars: number;
    tsai: number;
    avlaga: number;
    uglug: number;
};

type PlayerWithIndex = {
    index: number;
    name?: string;
    stars: number;
    tsai: number;
    avlaga: number;
    uglug: number;
    id?: string;
};

type Trade = {
    from: number;
    to: number;
    amount: number;
};

export type FinalScorePlayer = {
    index: number;
    name: string;
    tsai: number;
    avlaga: number;
    uglug: number;
    finalScore: number;  // цай + авлага - өглөг
};

export function executeTradingSystem(
    myScore: PlayerScore,
    opponents: OpponentScore[]
): {
    myScore: PlayerScore;
    opponents: OpponentScore[];
} {
    console.log("💰 Худалдаа эхэллээ");

    const allPlayers: PlayerWithIndex[] = [
        { index: 0, ...myScore },
        ...opponents.map((opp, i) => ({ index: i + 1, ...opp }))
    ];

    const sellers = allPlayers.filter(p => p.stars > 2);
    const buyers = allPlayers.filter(p => p.stars < 2);
    const balanced = allPlayers.filter(p => p.stars === 2);

    console.log("🔴 Зарагчид:", sellers.length);
    console.log("🟢 Авагчид:", buyers.length);
    console.log("⚪ Тэнцсэн:", balanced.length);

    const trades: Trade[] = [];

    let sellerIdx = 0;
    let buyerIdx = 0;

    while (sellerIdx < sellers.length && buyerIdx < buyers.length) {
        const seller = sellers[sellerIdx];
        const buyer = buyers[buyerIdx];

        const sellerExtra = seller.stars - 2;
        const buyerNeed = 2 - buyer.stars;

        const tradeAmount = Math.min(sellerExtra, buyerNeed);

        trades.push({
            from: seller.index,
            to: buyer.index,
            amount: tradeAmount
        });

        seller.stars -= tradeAmount;
        buyer.stars += tradeAmount;

        if (seller.stars === 2) sellerIdx++;
        if (buyer.stars === 2) buyerIdx++;
    }

    console.log("🔄 Худалдааны тоо:", trades.length);

    for (const trade of trades) {
        const seller = allPlayers[trade.from];
        const buyer = allPlayers[trade.to];

        console.log(`💸 ${seller.name || 'Та'} -> ${buyer.name || 'Та'}: ${trade.amount} stars`);

        for (let i = 0; i < trade.amount; i++) {
            if (buyer.tsai > 0) {
                buyer.tsai--;
                seller.tsai++;
                console.log(`  ✅ Цай шилжсэн`);
            } else {
                buyer.uglug++;
                seller.avlaga++;
                console.log(`  📝 Өглөг бүртгэгдсэн`);
            }
        }
    }

    const updatedMyScore: PlayerScore = {
        stars: allPlayers[0].stars,
        tsai: allPlayers[0].tsai,
        avlaga: allPlayers[0].avlaga,
        uglug: allPlayers[0].uglug
    };

    const updatedOpponents: OpponentScore[] = opponents.map((opp, i) => {
        const botData = allPlayers[i + 1];
        return {
            ...opp,
            stars: botData.stars,
            tsai: botData.tsai,
            avlaga: botData.avlaga,
            uglug: botData.uglug
        };
    });

    return {
        myScore: updatedMyScore,
        opponents: updatedOpponents
    };
}

/**
 * Тоглоом дууссан эсэхийг шалгах - 2 НӨХЦӨЛ
 */
export function checkGameEnd(
    myScore: PlayerScore,
    opponents: OpponentScore[]
): {
    gameEnded: boolean;
    reason?: 'tsai' | 'uglug'; 
} {
    if (myScore.tsai >= 4) {
        return { gameEnded: true, reason: 'tsai' };
    }
    
    for (const bot of opponents) {
        if (bot.tsai >= 4) {
            return { gameEnded: true, reason: 'tsai' };
        }
    }

    if (myScore.uglug >= 10) {
        return { gameEnded: true, reason: 'uglug' };
    }
    
    for (const bot of opponents) {
        if (bot.uglug >= 10) {
            return { gameEnded: true, reason: 'uglug' };
        }
    }

    return { gameEnded: false };
}

/**
 * Ялагчийг тодорхойлох: цай + авлага - өглөг (хамгийн их)
 */
export function calculateWinner(
    myScore: PlayerScore,
    opponents: OpponentScore[]
): {
    winner: FinalScorePlayer;
    allScores: FinalScorePlayer[];
} {
    const allPlayers: FinalScorePlayer[] = [
        {
            index: 0,
            name: 'Та',
            tsai: myScore.tsai,
            avlaga: myScore.avlaga,
            uglug: myScore.uglug,
            finalScore: myScore.tsai + myScore.avlaga - myScore.uglug
        },
        ...opponents.map((opp, i) => ({
            index: i + 1,
            name: opp.name,
            tsai: opp.tsai,
            avlaga: opp.avlaga,
            uglug: opp.uglug,
            finalScore: opp.tsai + opp.avlaga - opp.uglug
        }))
    ];

    // Эрэмбэлэх: finalScore их → бага
    const sorted = [...allPlayers].sort((a, b) => b.finalScore - a.finalScore);

    return {
        winner: sorted[0],
        allScores: sorted
    };
}