// app/multiplayer.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ref, set } from 'firebase/database';
import { database } from './firebase'
import { TILE_TYPES, type TileInstance } from './types';
import {
    createRoom,
    joinRoom,
    listenToRoom,
    setPlayerReady,
    startGame,
    deleteRoom
} from './utils/gameService';

import { createDeck, deal5 } from './playScreen';

export default function MultiplayerScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const params = useLocalSearchParams();
    const { roomCode, host, playerName } = params;

    const [roomData, setRoomData] = useState<any>(null);
    const [myPlayerIndex, setMyPlayerIndex] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initRoom = async () => {
            try {
                if (host === 'true') {
                    await createRoom(roomCode as string, playerName as string);
                    setMyPlayerIndex(0);
                } else {
                    const playerIndex = await joinRoom(roomCode as string, playerName as string);
                    setMyPlayerIndex(playerIndex);
                }

                const unsubscribe = listenToRoom(roomCode as string, (data) => {
                    console.log('📡 Room update:', data);
                    setRoomData(data);
                    setLoading(false);
                });

                return () => {
                    unsubscribe();
                };
            } catch (error: any) {
                Alert.alert('Алдаа', error.message);
                router.back();
            }
        };

        initRoom();
    }, []);

    const handleReady = async () => {
        const currentReady = roomData?.players?.[myPlayerIndex]?.isReady || false;
        await setPlayerReady(roomCode as string, myPlayerIndex, !currentReady);
    };

    // app/multiplayer.tsx

    const handleStartGame = async () => {
        const playersObj = roomData?.players || {};
        const playersArr = Object.values(playersObj) as any[];

        // зөвхөн хүн тоглогчид (bot биш)
        const humanPlayers = playersArr.filter(p => !p?.isBot);

        const allReady = humanPlayers.length > 0 && humanPlayers.every(p => p.isReady);

        if (!allReady) {
            Alert.alert('Анхаар', 'Бүх хүн тоглогч бэлэн болох хэрэгтэй');
            return;
        }

        if (humanPlayers.length < 2) {
            Alert.alert('Анхаар', 'Хамгийн багадаа 2 хүн тоглогч хэрэгтэй');
            return;
        }

        if (humanPlayers.length > 5) {
            Alert.alert('Анхаар', 'Хамгийн ихдээ 5 тоглогч байна');
            return;
        }

        // ===== BOT тооцоолол (5 хүртэл дүүргэнэ) =====
        const botsNeeded = 5 - humanPlayers.length;

        if (botsNeeded > 0) {
            console.log(`🤖 ${botsNeeded} бот нэмэж байна...`);

            // Bot нэрс (3 хүртэл хэрэгтэй тул хангалттай массив өгье)
            const botNames = ['ХАНДДОРЖ', 'ШИЖИР', 'ЭНХЛЭН', 'УЛАМБАЯР', 'БОТ'];

            // 0..4 дотор байгаа аль index-үүд хүн тоглогч / өөр bot-оор дүүрсэн бэ?
            const usedIndexes = new Set<number>();
            Object.keys(playersObj).forEach((k) => {
                const idx = Number(k);
                if (Number.isFinite(idx)) usedIndexes.add(idx);
            });

            // чөлөөтэй index-үүдийг олно (0..4)
            const freeIndexes: number[] = [];
            for (let i = 0; i < 5; i++) {
                if (!usedIndexes.has(i)) freeIndexes.push(i);
            }

            // freeIndexes дээр бот нэмнэ
            for (let i = 0; i < botsNeeded; i++) {
                const botIndex = freeIndexes[i];
                if (botIndex === undefined) break;

                await set(ref(database, `rooms/${roomCode}/players/${botIndex}`), {
                    name: botNames[i] || `БОТ ${i + 1}`,
                    isHost: false,
                    isReady: true,
                    connected: true,
                    index: botIndex,
                    isBot: true,
                    // онооны initial утгууд (дараа оноо/худалдаа хийхэд хэрэгтэй)
                    stars: 0,
                    tsai: 2,
                    avlaga: 0,
                    uglug: 0,
                });
            }
        }

        // ===== MOD хуваах (5 тоглогчид) =====
        const deck = createDeck();
        const hands = deal5(deck);

        await startGame(roomCode as string, hands);
    };


    const handleLeave = async () => {
        if (myPlayerIndex === 0) {
            await deleteRoom(roomCode as string);
        }
        router.back();
    };

    // Тоглоом эхэлсэн бол MultiplayerGame рүү шилжих
    useEffect(() => {
        if (roomData?.gameState?.started) {
            router.replace({
                pathname: '/multiplayerGame',
                params: {
                    roomCode,
                    playerIndex: myPlayerIndex,
                    playerName
                }
            });
        }
    }, [roomData?.gameState?.started]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text, fontSize: 18 }}>Ачаалж байна...</Text>
            </View>
        );
    }

    const players = Object.entries(roomData?.players || {}) as [string, any][];
    const allReady = players.every(([, p]) => p.isReady);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>
                Өрөө: #{roomCode}
            </Text>
            <Text style={[styles.subtitle, { color: colors.subText }]}>
                Та: {playerName}
            </Text>

            <View style={styles.playersList}>
                <Text style={[styles.playersTitle, { color: colors.text }]}>
                    Тоглогчид ({players.length}/5)
                </Text>
                <ScrollView style={styles.playersScroll}>
                    {players.map(([index, player]) => (
                        <View
                            key={index}
                            style={[
                                styles.playerItem,
                                { backgroundColor: colors.card },
                                parseInt(index) === myPlayerIndex && styles.myPlayer
                            ]}
                        >
                            <Text style={[styles.playerName, { color: colors.text }]}>
                                {player.name} {player.isHost && '👑'}
                                {parseInt(index) === myPlayerIndex && ' (Та)'}
                            </Text>
                            <Text style={{ color: colors.text }}>
                                {player.isReady ? '✅ Бэлэн' : '⏳'}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.buttonsContainer}>
                <Pressable
                    style={[
                        styles.button,
                        { backgroundColor: roomData?.players?.[myPlayerIndex]?.isReady ? '#ff9800' : '#4CAF50' }
                    ]}
                    onPress={handleReady}
                >
                    <Text style={styles.buttonText}>
                        {roomData?.players?.[myPlayerIndex]?.isReady ? '❌ Цуцлах' : '✅ Бэлэн'}
                    </Text>
                </Pressable>

                {myPlayerIndex === 0 && (
                    <Pressable
                        style={[
                            styles.button,
                            { backgroundColor: allReady ? '#2196F3' : '#ccc' }
                        ]}
                        onPress={handleStartGame}
                        disabled={!allReady}
                    >
                        <Text style={styles.buttonText}>🎮 Эхлүүлэх</Text>
                    </Pressable>
                )}

                <Pressable
                    style={[styles.button, { backgroundColor: '#f44336' }]}
                    onPress={handleLeave}
                >
                    <Text style={styles.buttonText}>🚪 Гарах</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        marginTop: 60
    },
    subtitle: {
        fontSize: 18,
        marginBottom: 30,
        textAlign: 'center'
    },
    playersTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 16
    },
    playersList: {
        flex: 1,
        marginBottom: 20
    },
    playersScroll: {
        flex: 1
    },
    playerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 18,
        marginBottom: 12,
        borderRadius: 16
    },
    myPlayer: {
        borderWidth: 3,
        borderColor: '#4CAF50'
    },
    playerName: {
        fontSize: 18,
        fontWeight: '600'
    },
    buttonsContainer: {
        gap: 12
    },
    button: {
        padding: 18,
        borderRadius: 14,
        alignItems: 'center'
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    }
});