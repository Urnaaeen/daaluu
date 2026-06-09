// app/multiplayerGame.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { TopStatsBar } from '../components/aTopStatsBar';
import PlayerScore from '../components/PlayerScore';

import {
    calculateWinner,
    checkGameEnd,
    executeTradingSystem,
    type FinalScorePlayer,
} from './trading';
import GameEndModal from '../components/GameEndModal';

import {
    listenToRoom,
    updateCenter,
    updateCurrentPlayer,
    updateHands,
    addRoundMove,
    resetRound,
    updateAllScores,
    setGameEnded,
    updatePlayerScore,
} from './utils/gameService';

import { TILE_TYPES, type TileInstance } from './types';
import { colorMatches } from './playScreen';
import { selectBotMove } from './botlogic';

export default function MultiplayerGameScreen() {
    const router = useRouter();
    const { colors } = useTheme();

    const params = useLocalSearchParams();
    const { roomCode, playerIndex } = params;

    const [gameEnded, setGameEndedState] = useState(false);
    const [finalScores, setFinalScores] = useState<{
        winner: FinalScorePlayer;
        allScores: FinalScorePlayer[];
    } | null>(null);

    const roomCodeStr = useMemo(() => {
        const v = roomCode;
        return Array.isArray(v) ? v[0] : v;
    }, [roomCode]);

    const playerIndexStr = useMemo(() => {
        const v = playerIndex;
        return Array.isArray(v) ? v[0] : v;
    }, [playerIndex]);

    const myIndex = useMemo(() => {
        const n = Number(playerIndexStr);
        return Number.isFinite(n) ? n : 0;
    }, [playerIndexStr]);

    const [roomData, setRoomData] = useState<any>(null);
    const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);

    const ROUND_SIZE = 5;

    // ✅ listen
    useEffect(() => {
        if (!roomCodeStr) return;
        const unsubscribe = listenToRoom(roomCodeStr, (data) => setRoomData(data));
        return () => unsubscribe();
    }, [roomCodeStr]);

    const started = !!roomData?.gameState?.started;

    const gameState = roomData?.gameState ?? {
        hands: {},
        center: [],
        currentPlayerIndex: 0,
        roundMoves: [],
        gameEnded: false,
    };

    const players = roomData?.players ?? {};

    const center: any[] = gameState.center ?? [];
    const currentPlayerIndex: number = gameState.currentPlayerIndex ?? 0;
    const firebaseGameEnded = !!gameState.gameEnded;

    const myHand: TileInstance[] = useMemo(() => {
        const hand = gameState.hands?.[myIndex] ?? [];

        const handWithImages = hand.map((tile: any) => {
            const tileType = TILE_TYPES.find(t => t.typeId === tile.typeId);
            if (!tileType) return tile;

            return {
                ...tile,
                image: tileType.image,  // ⬅️ Image нэмэх
                title: tile.title || tileType.title,
                color: tile.color || tileType.color
            };
        });

        return [...hand].sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return a.typeId.localeCompare(b.typeId);
        });
    }, [gameState.hands, myIndex]);

    const me = players?.[myIndex] || {};
    const isHost = !!me?.isHost;

    // Firebase gameEnded sync (өөр тоглогч дуусгасан байж болно)
    useEffect(() => {
        if (!firebaseGameEnded) return;

        if (!gameEnded) setGameEndedState(true);

        if (!finalScores) {
            const myScore = {
                name: me.name ?? `Player ${myIndex}`,
                stars: me.stars ?? 0,
                tsai: me.tsai ?? 2,
                avlaga: me.avlaga ?? 0,
                uglug: me.uglug ?? 0,
            };

            const opps = Object.entries(players)
                .filter(([idx]) => Number(idx) !== myIndex)
                .map(([idx, p]: [string, any]) => ({
                    name: p.name ?? `Player ${idx}`,
                    stars: p.stars ?? 0,
                    tsai: p.tsai ?? 2,
                    avlaga: p.avlaga ?? 0,
                    uglug: p.uglug ?? 0,
                    id: `p${idx}`,
                }));

            const winnerData = calculateWinner(myScore as any, opps as any);
            setFinalScores(winnerData);
        }
    }, [firebaseGameEnded, gameEnded, finalScores, players, myIndex, me]);

    // ===== CENTER TILES PROCESS =====
    const allCenterTiles: TileInstance[] = useMemo(() => {
        const all: TileInstance[] = [];
        for (const entry of center) {
            if (Array.isArray(entry)) all.push(...entry);
            else all.push(entry);
        }
        return all;
    }, [center]);

    const currentEntry = useMemo(() => {
        return center.length > 0 ? center[center.length - 1] : null;
    }, [center]);

    const isLastEntryPair = Array.isArray(currentEntry);

    const currentTiles: TileInstance[] = useMemo(() => {
        if (center.length === 0) return [];

        const firstEntry = center[0];
        const referenceColor = Array.isArray(firstEntry) ? firstEntry[0].color : firstEntry.color;

        const pairEntries = center.filter((entry: any) => Array.isArray(entry)) as TileInstance[][];

        if (pairEntries.length > 0) {
            const validPairs = pairEntries.filter((pair) => {
                if (pair[0].typeId === 'nuuts') return false;
                const pairColor = pair[0].color;
                return !pairColor || !referenceColor || pairColor === referenceColor;
            });

            if (validPairs.length === 0) return [];

            const highestValidPair = validPairs.reduce((maxPair, pair) => {
                return pair[0].rank > maxPair[0].rank ? pair : maxPair;
            });

            return highestValidPair;
        } else {
            if (allCenterTiles.length === 0) return [];

            const validTiles = allCenterTiles.filter((tile) => {
                const tileColor = tile.color;
                return !tileColor || !referenceColor || tileColor === referenceColor;
            });

            if (validTiles.length === 0) return [];

            return [validTiles.reduce((max, tile) => (tile.rank > max.rank ? tile : max))];
        }
    }, [center, allCenterTiles]);

    const lastTile = currentTiles.length > 0 ? currentTiles[0] : null;

    const previousTiles: TileInstance[] = useMemo(() => {
        const filtered = allCenterTiles.filter((tile) => !currentTiles.some((ct) => ct.id === tile.id));
        const secretTiles = filtered.filter((t) => t.typeId === 'nuuts');
        const nonSecretTiles = filtered.filter((t) => t.typeId !== 'nuuts');

        const secretGroups = new Map<string, TileInstance>();
        for (const tile of secretTiles) {
            const baseId = tile.id.split('_').slice(0, 2).join('_');
            if (!secretGroups.has(baseId)) secretGroups.set(baseId, tile);
        }

        const finalSecrets = Array.from(secretGroups.values());
        return [...nonSecretTiles, ...finalSecrets].slice(-4);
    }, [allCenterTiles, currentTiles]);

    const opponents = useMemo(() => {
        return Object.entries(players)
            .filter(([index]) => Number(index) !== myIndex)
            .map(([index, player]: [string, any]) => ({
                id: `p${index}`,
                name: player.name,
                stars: player.stars || 0,
                tsai: player.tsai || 2,
                avlaga: player.avlaga || 0,
                uglug: player.uglug || 0,
            }));
    }, [players, myIndex]);

    const isMyTurn = currentPlayerIndex === myIndex;

    // ===== START CHECK =====
    const checkCanStartGame = (hand: TileInstance[]): boolean => {
        if (!hand || hand.length === 0) return false;

        const hasHighRank = hand.some((t) => t.rank >= 8);
        if (hasHighRank) return true;

        const pairCounts = new Map<string, number>();
        hand.forEach((t) => pairCounts.set(t.typeId, (pairCounts.get(t.typeId) || 0) + 1));
        const hasPair = Array.from(pairCounts.values()).some((count) => count >= 2);

        return hasPair;
    };

    // ===== TRADING =====
    const executeTrading = useCallback(async () => {
        if (!roomCodeStr) return;

        console.log('💰 Худалдаа эхлүүлж байна...');

        const currentScores: any = {};
        Object.entries(players).forEach(([index, player]: [string, any]) => {
            currentScores[index] = {
                stars: player.stars || 0,
                tsai: player.tsai || 2,
                avlaga: player.avlaga || 0,
                uglug: player.uglug || 0,
                name: player.name || `Player ${index}`,
                id: `p${index}`,
            };
        });

        const myScoreData = currentScores[String(myIndex)] || {
            stars: 0,
            tsai: 2,
            avlaga: 0,
            uglug: 0,
            name: me?.name || `Player ${myIndex}`,
            id: `p${myIndex}`,
        };

        const opponentsData = Object.entries(currentScores)
            .filter(([index]) => Number(index) !== myIndex)
            .map(([index, score]: [string, any]) => ({
                id: `p${index}`,
                name: score.name,
                stars: score.stars,
                tsai: score.tsai,
                avlaga: score.avlaga,
                uglug: score.uglug,
            }));

        const result = executeTradingSystem(myScoreData, opponentsData);

        const newScores: any = {};
        newScores[myIndex] = {
            stars: result.myScore.stars,
            tsai: result.myScore.tsai,
            avlaga: result.myScore.avlaga,
            uglug: result.myScore.uglug,
        };

        result.opponents.forEach((opp: any) => {
            const idxStr = String(opp.id).replace('p', '');
            const idxNum = Number(idxStr);
            if (Number.isFinite(idxNum)) {
                newScores[idxNum] = {
                    stars: opp.stars,
                    tsai: opp.tsai,
                    avlaga: opp.avlaga,
                    uglug: opp.uglug,
                };
            }
        });

        await updateAllScores(roomCodeStr, newScores);

        setTimeout(async () => {
            const endCheck = checkGameEnd(result.myScore, result.opponents);

            if (endCheck.gameEnded) {
                console.log('🏆 ТОГЛООМ ДУУСЛАА!');
                const winnerData = calculateWinner(result.myScore, result.opponents);
                setFinalScores(winnerData);
                setGameEndedState(true);
                await setGameEnded(roomCodeStr, true);
            } else {
                console.log('🔄 Шинэ round эхэллээ (stars reset)');

                const resetScores: any = {};
                Object.keys(newScores).forEach((idx) => {
                    resetScores[Number(idx)] = {
                        ...newScores[Number(idx)],
                        stars: 0,
                    };
                });

                await updateAllScores(roomCodeStr, resetScores);
            }
        }, 2000);
    }, [roomCodeStr, players, myIndex, me]);

    // ===== ROUND SCORE CALC =====
    const calculateRoundScore = useCallback(
        async (currentHands: any, roundMovesParam?: any[]) => {
            if (!roomCodeStr) return;
            if (firebaseGameEnded) return;

            const roundMoves = roundMovesParam ?? gameState.roundMoves ?? [];

            console.log('💰 calculateRoundScore() дуудагдлаа | roundMoves:', roundMoves.length);

            if (!roundMoves || roundMoves.length < ROUND_SIZE) {
                console.log(`⏳ RoundMoves ${roundMoves?.length || 0}/${ROUND_SIZE} - дутуу байна`);
                return;
            }

            const referenceColor = currentTiles.length > 0 ? currentTiles[0].color : null;
            console.log(`🎲 Өнгө: ${referenceColor || 'хоосон'}`);

            let maxRank = -999;
            let winnerIndex = -1;

            for (const move of roundMoves) {
                const tiles: TileInstance[] = move.tiles || [];
                if (!tiles || tiles.length === 0) continue;

                const isActualPair = tiles.length === 2 && tiles[0].typeId === tiles[1].typeId;
                const isSecret = tiles.length === 2 && !isActualPair;

                let tileRank: number;
                let tileColor: string | undefined;

                if (isSecret) {
                    tileRank = 1;
                    tileColor = undefined;
                } else {
                    tileRank = tiles[0].rank;
                    tileColor = tiles[0].color;
                }

                let isValid = true;
                if (!isSecret && referenceColor) {
                    if (!colorMatches(tileColor, referenceColor)) {
                        isValid = false;
                        console.log(`❌ Тоглогч ${move.playerIndex}: Өнгө таарахгүй`);
                    }
                }

                if (isValid && tileRank > maxRank) {
                    maxRank = tileRank;
                    winnerIndex = move.playerIndex;
                }
            }

            if (winnerIndex === -1) {
                console.log('❌ Валид мод байхгүй!');
                return;
            }

            const winnerMove = roundMoves.find((m: any) => m.playerIndex === winnerIndex);
            const isPairRound =
                winnerMove &&
                winnerMove.tiles &&
                winnerMove.tiles.length === 2 &&
                winnerMove.tiles[0].typeId === winnerMove.tiles[1].typeId;

            const scoreToAdd = isPairRound ? 2 : 1;

            console.log(`🏆 Ялагч: ${winnerIndex} | Rank: ${maxRank} | Оноо: ${scoreToAdd}`);

            const currentStars = players?.[winnerIndex]?.stars || 0;
            await updatePlayerScore(roomCodeStr, winnerIndex, 'stars', currentStars + scoreToAdd);

            // 2 сек дараа: reset + startPlayer шалгах / trade
            setTimeout(async () => {
                await resetRound(roomCodeStr);

                // 🔥 ЭХЛЭЭД гар дуусаагүй эсэхийг шалгах
                const allHandsEmpty = Object.values(currentHands || {}).every(
                    (hand: any) => !hand || hand.length === 0
                );

                if (allHandsEmpty) {
                    // ✅ Бүх гар дууссан → ХУДАЛДАА дуудах
                    console.log('🎯 Бүх тоглогчийн гар дууслаа! Худалдаа эхлүүлж байна...');
                    await executeTrading();
                    return; // ⬅️ Худалдаа дуудсан бол дуусгах
                }

                // ❌ Гар дуусаагүй → StartPlayer шалгаад үргэлжлүүлэх
                console.log('🔄 Гар дуусаагүй, дараагийн тоглогч эхлүүлэх...');

                let startPlayer = winnerIndex;
                let attempts = 0;
                let canAnyoneStart = false;

                const playerCount = Object.keys(players).length || ROUND_SIZE;

                while (attempts < playerCount) {
                    const hand = currentHands?.[startPlayer] || [];
                    const canStart = checkCanStartGame(hand);

                    if (canStart) {
                        console.log(`✅ Тоглогч ${startPlayer} эхлэх эрхтэй`);
                        canAnyoneStart = true;
                        await updateCurrentPlayer(roomCodeStr, startPlayer);
                        break;
                    }

                    startPlayer = (startPlayer + 1) % playerCount;
                    attempts++;
                }

                if (!canAnyoneStart) {
                    console.log('⚠️ Хэн ч эхлэх эрхгүй! Худалдаа эхлүүлж байна...');
                    await executeTrading();
                }
            }, 2000);
        },
        [
            roomCodeStr,
            firebaseGameEnded,
            gameState.roundMoves,
            currentTiles,
            players,
            executeTrading,
        ]
    );

    // ✅ RoundMoves 5 болсон мөчийг listener-ээр trigger хийх (HOST only)
    const scoringRef = useRef(false);

    useEffect(() => {
        if (!started) return;
        if (firebaseGameEnded) return;

        const roundMoves = gameState.roundMoves || [];
        const len = roundMoves.length;

        // reset болсон үед дахин зөвшөөрөх
        if (len === 0) scoringRef.current = false;

        // зөвхөн host тооцоолно (давхардахгүй)
        if (!isHost) return;

        if (len === ROUND_SIZE && !scoringRef.current) {
            scoringRef.current = true;
            console.log('✅ RoundMoves 5 боллоо! Оноо тооцож байна (HOST trigger)...');

            // хамгийн шинэ hands + roundMoves
            calculateRoundScore(gameState.hands, roundMoves);
        }
    }, [
        started,
        firebaseGameEnded,
        isHost,
        gameState.roundMoves,
        gameState.hands,
        calculateRoundScore,
    ]);

    // ===== БОТ helper =====
    const calculateHasHigherPair = useCallback(
        (botHand: TileInstance[]) => {
            if (!lastTile || !isLastEntryPair) return false;

            const pairCounts = new Map<string, number>();
            for (const tile of botHand) {
                pairCounts.set(tile.typeId, (pairCounts.get(tile.typeId) || 0) + 1);
            }

            for (const tile of botHand) {
                if (
                    (pairCounts.get(tile.typeId) || 0) >= 2 &&
                    colorMatches(tile.color, lastTile.color) &&
                    tile.rank > lastTile.rank
                ) {
                    return true;
                }
            }
            return false;
        },
        [lastTile, isLastEntryPair]
    );

    const calculateHasLowerPair = useCallback(
        (botHand: TileInstance[]) => {
            if (!lastTile || !isLastEntryPair) return false;

            const pairCounts = new Map<string, number>();
            for (const tile of botHand) {
                pairCounts.set(tile.typeId, (pairCounts.get(tile.typeId) || 0) + 1);
            }

            for (const tile of botHand) {
                if (
                    (pairCounts.get(tile.typeId) || 0) >= 2 &&
                    colorMatches(tile.color, lastTile.color) &&
                    tile.rank < lastTile.rank
                ) {
                    return true;
                }
            }
            return false;
        },
        [lastTile, isLastEntryPair]
    );

    // ===== BOT MOVE =====
    const playBotMove = useCallback(
        async (botIndex: number) => {
            if (!roomCodeStr) return;
            if (firebaseGameEnded) return;

            const botHand: TileInstance[] = gameState.hands?.[botIndex] || [];

            // ✅ энэ round-д бот тоглосон эсэх
            const roundMoves = gameState.roundMoves || [];
            const alreadyPlayed = roundMoves.some((m: any) => m.playerIndex === botIndex);
            if (alreadyPlayed) return;

            const selectedTiles: TileInstance[] = selectBotMove(
                botHand,
                center,
                currentTiles,
                isLastEntryPair,
                lastTile,
                calculateHasHigherPair(botHand),
                calculateHasLowerPair(botHand)
            );

            if (!selectedTiles || selectedTiles.length === 0) return;

            const newCenter = [...center];

            if (selectedTiles.length === 2) {
                const isPair = selectedTiles[0].typeId === selectedTiles[1].typeId;

                if (isPair) {
                    if (isLastEntryPair) {
                        const lastPair = currentEntry as TileInstance[];
                        const newPair = selectedTiles;

                        if (newPair[0].rank > lastPair[0].rank) {
                            const updatedCenter = newCenter.slice(0, -1);
                            updatedCenter.push(lastPair[0]);
                            updatedCenter.push(newPair);
                            await updateCenter(roomCodeStr, updatedCenter);
                        } else {
                            newCenter.push([newPair[0]]);
                            await updateCenter(roomCodeStr, newCenter);
                        }
                    } else {
                        newCenter.push(selectedTiles);
                        await updateCenter(roomCodeStr, newCenter);
                    }
                } else {
                    const secretTile = TILE_TYPES.find((t) => t.typeId === 'nuuts');
                    if (secretTile) {
                        const timestamp = Date.now();
                        newCenter.push([
                            { ...secretTile, id: `nuuts_${timestamp}`, copyIndex: 1 },
                            { ...secretTile, id: `nuuts_${timestamp}_2`, copyIndex: 2 },
                        ]);
                        await updateCenter(roomCodeStr, newCenter);
                    }
                }
            } else if (selectedTiles.length === 1) {
                newCenter.push(selectedTiles[0]);
                await updateCenter(roomCodeStr, newCenter);
            } else {
                return;
            }

            // HANDS update
            const selectedIds = selectedTiles.map((t) => t.id);
            const newHands = { ...gameState.hands };
            newHands[botIndex] = botHand.filter((t) => !selectedIds.includes(t.id));
            await updateHands(roomCodeStr, newHands);

            // ROUND MOVE хадгалах
            const moveCount = await addRoundMove(roomCodeStr, botIndex, selectedTiles);

            // ✅ Round дууссан бол эндээс зогсоно (оноог HOST trigger тооцно)
            if (moveCount >= ROUND_SIZE) {
                console.log('✅ Round дууслаа (бот) — score trigger listener ажиллана');
                return;
            }

            // Next player
            const playerCount = Object.keys(players).length || 1;
            const nextPlayer = (currentPlayerIndex + 1) % playerCount;
            await updateCurrentPlayer(roomCodeStr, nextPlayer);
        },
        [
            roomCodeStr,
            firebaseGameEnded,
            gameState.hands,
            gameState.roundMoves,
            center,
            currentTiles,
            isLastEntryPair,
            lastTile,
            calculateHasHigherPair,
            calculateHasLowerPair,
            currentEntry,
            players,
            currentPlayerIndex,
        ]
    );

    // BOT useEffect
    useEffect(() => {
        if (!started) return;
        if (firebaseGameEnded) return;
        if (currentPlayerIndex === myIndex) return;

        const currentPlayer = players[currentPlayerIndex];
        if (!currentPlayer?.isBot) return;

        const timer = setTimeout(() => {
            playBotMove(currentPlayerIndex);
        }, 1200);

        return () => clearTimeout(timer);
    }, [started, firebaseGameEnded, currentPlayerIndex, myIndex, players, playBotMove]);

    // ===== HUMAN MOVE =====
    const handlePlayTile = useCallback(async () => {
        if (!roomCodeStr) return;
        if (firebaseGameEnded) return;
        if (selectedTileIds.length === 0) return;

        const tilesToPlay = myHand.filter((t) => selectedTileIds.includes(t.id));
        if (tilesToPlay.length === 0) return;

        const newCenter = [...center];

        if (tilesToPlay.length === 2) {
            const isPair = tilesToPlay[0].typeId === tilesToPlay[1].typeId;

            if (isPair) {
                if (isLastEntryPair) {
                    const lastPair = currentEntry as TileInstance[];
                    const newPair = tilesToPlay;

                    if (newPair[0].rank > lastPair[0].rank) {
                        const updatedCenter = newCenter.slice(0, -1);
                        updatedCenter.push(lastPair[0]);
                        updatedCenter.push(newPair);
                        await updateCenter(roomCodeStr, updatedCenter);
                    } else {
                        newCenter.push([newPair[0]]);
                        await updateCenter(roomCodeStr, newCenter);
                    }
                } else {
                    newCenter.push(tilesToPlay);
                    await updateCenter(roomCodeStr, newCenter);
                }
            } else {
                const secretTile = TILE_TYPES.find((t) => t.typeId === 'nuuts');
                if (!secretTile) return;

                const timestamp = Date.now();
                newCenter.push([
                    { ...secretTile, id: `nuuts_${timestamp}`, copyIndex: 1 },
                    { ...secretTile, id: `nuuts_${timestamp}_2`, copyIndex: 2 },
                ]);
                await updateCenter(roomCodeStr, newCenter);
            }
        } else if (tilesToPlay.length === 1) {
            newCenter.push(tilesToPlay[0]);
            await updateCenter(roomCodeStr, newCenter);
        } else {
            return;
        }

        // HANDS update
        const newHands = { ...gameState.hands };
        newHands[myIndex] = myHand.filter((t) => !selectedTileIds.includes(t.id));
        await updateHands(roomCodeStr, newHands);

        // ROUND MOVE хадгалах
        const moveCount = await addRoundMove(roomCodeStr, myIndex, tilesToPlay);

        // ✅ Round дууссан бол ээлж солихгүй (оноог HOST trigger тооцно)
        if (moveCount >= ROUND_SIZE) {
            console.log('✅ Round дууслаа (human) — score trigger listener ажиллана');
            setSelectedTileIds([]);
            return;
        }

        // Next player
        const playerCount = Object.keys(players).length || 1;
        const nextPlayer = (currentPlayerIndex + 1) % playerCount;
        await updateCurrentPlayer(roomCodeStr, nextPlayer);

        setSelectedTileIds([]);
    }, [
        roomCodeStr,
        firebaseGameEnded,
        selectedTileIds,
        myHand,
        center,
        isLastEntryPair,
        currentEntry,
        gameState.hands,
        myIndex,
        players,
        currentPlayerIndex,
    ]);

    if (!started) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text, fontSize: 18 }}>Тоглоом эхлүүлж байна...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <TopStatsBar
                avlaga={me.avlaga || 0}
                uglug={me.uglug || 0}
                tsai={me.tsai || 2}
                tsaiTotal={10}
                ger={me.stars || 0}
            />

            <View style={styles.gameArea}>
                <View style={styles.centerWrap}>
                    <View style={[styles.centerBoard, { backgroundColor: colors.card }]}>
                        {previousTiles.length > 0 && (
                            <View style={styles.previousTilesRow}>
                                {previousTiles.map((tile, idx) => (
                                    <View key={`${tile.id}_${idx}`} style={styles.previousTileItem}>
                                        <ExpoImage
                                            source={tile.image}
                                            style={styles.previousTileImage}
                                            contentFit="contain"
                                            cachePolicy="memory-disk"
                                        />
                                    </View>
                                ))}
                            </View>
                        )}

                        {currentTiles.length > 0 ? (
                            <View style={styles.currentTilesWrap}>
                                {currentTiles.map((tile, idx) => (
                                    <View
                                        key={tile.id}
                                        style={[
                                            styles.centerTileContainer,
                                            currentTiles.length === 2 && idx === 1 && styles.centerTileOverlap,
                                        ]}
                                    >
                                        <ExpoImage
                                            source={tile.image}
                                            style={styles.centerTile}
                                            contentFit="contain"
                                            priority="high"
                                            cachePolicy="memory-disk"
                                        />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={[styles.emptyText, { color: colors.text }]}>
                                {isMyTurn ? '🎯 Таны ээлж!' : 'Гол хоосон'}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <Pressable
                        style={[
                            styles.actionBtn,
                            { backgroundColor: isMyTurn && selectedTileIds.length > 0 && !firebaseGameEnded ? '#4CAF50' : '#ccc' },
                        ]}
                        onPress={handlePlayTile}
                        disabled={!isMyTurn || selectedTileIds.length === 0 || firebaseGameEnded}
                    >
                        <Text style={styles.actionText}>Гарах ({selectedTileIds.length})</Text>
                    </Pressable>

                    {selectedTileIds.length > 0 && !firebaseGameEnded && (
                        <Pressable style={styles.clearBtn} onPress={() => setSelectedTileIds([])}>
                            <Text style={styles.clearBtnText}>✕</Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.handWrap}>
                    <FlatList
                        horizontal
                        data={myHand}
                        keyExtractor={(t: TileInstance) => t.id}
                        renderItem={({ item }) => {
                            const isSelected = selectedTileIds.includes(item.id);

                            return (
                                <Pressable
                                    style={[
                                        styles.handItem,
                                        isSelected && styles.handItemSelected,
                                        (!isMyTurn || firebaseGameEnded) && styles.handItemDisabled,
                                    ]}
                                    onPress={() => {
                                        if (!isMyTurn || firebaseGameEnded) return;

                                        if (isSelected) {
                                            setSelectedTileIds(selectedTileIds.filter((id) => id !== item.id));
                                        } else {
                                            setSelectedTileIds([...selectedTileIds, item.id]);
                                        }
                                    }}
                                    disabled={!isMyTurn || firebaseGameEnded}
                                >
                                    <ExpoImage
                                        source={item.image}
                                        style={styles.handTile}
                                        contentFit="contain"
                                        cachePolicy="memory-disk"
                                    />
                                    <Text style={[styles.handLabel, { color: colors.text }]}>{item.title}</Text>
                                </Pressable>
                            );
                        }}
                    />
                </View>

                <View style={styles.playersOverlay}>
                    <PlayerScore
                        opponents={opponents}
                        showOpponentScores={true}
                        currentPlayerIndex={currentPlayerIndex}
                        timeLeft={0}
                    />
                </View>
            </View>

            {finalScores && (
                <GameEndModal
                    visible={gameEnded}
                    winner={finalScores.winner}
                    allScores={finalScores.allScores}
                    onRestart={async () => {
                        if (!roomCodeStr) return;

                        setGameEndedState(false);
                        setFinalScores(null);

                        await setGameEnded(roomCodeStr, false);
                        await resetRound(roomCodeStr);

                        const resetScores: any = {};
                        Object.entries(players).forEach(([idx, p]: [string, any]) => {
                            resetScores[Number(idx)] = {
                                stars: 0,
                                tsai: p.tsai || 2,
                                avlaga: p.avlaga || 0,
                                uglug: p.uglug || 0,
                            };
                        });
                        await updateAllScores(roomCodeStr, resetScores);

                        await updateCurrentPlayer(roomCodeStr, 0);
                    }}
                    onExit={() => {
                        setGameEndedState(false);
                        setFinalScores(null);
                        router.push('/');
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gameArea: { flex: 1, position: 'relative' },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centerBoard: { width: 240, height: 320, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

    previousTilesRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        gap: 4,
    },
    previousTileItem: {
        width: 48,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffffaa',
        borderRadius: 8,
    },
    previousTileImage: { width: 44, height: 60, opacity: 0.8 },

    currentTilesWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    centerTileContainer: { alignItems: 'center', justifyContent: 'center' },
    centerTileOverlap: { marginLeft: -40 },
    centerTile: { width: 120, height: 200 },
    emptyText: { fontSize: 14, opacity: 0.5 },

    actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, gap: 12 },
    actionBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 18 },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    clearBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ff4444', alignItems: 'center', justifyContent: 'center' },
    clearBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },

    handWrap: { paddingVertical: 10 },
    handItem: { marginRight: 12, alignItems: 'center', width: 84, padding: 4, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
    handItemSelected: { borderColor: '#4CAF50', backgroundColor: '#e8f5e9' },
    handItemDisabled: { opacity: 0.5 },
    handTile: { width: 70, height: 110 },
    handLabel: { fontSize: 11, marginTop: 4 },

    playersOverlay: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 999, pointerEvents: 'box-none' },
});
