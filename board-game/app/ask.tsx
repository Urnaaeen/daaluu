import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Avatar from '../components/ui/Avatar';
import { useTheme } from '../context/ThemeContext';
import { PALETTE } from '../theme/colors';
// import OpenAI from 'openai';   // ⬅️ GPT API түлхүүр тавихдаа энэ мөрийг буцааж нээ

export interface ChatMessage {
  id: string;
  sender: 'player' | 'bot';
  text: string;
  timestamp: number;
}

export interface ChatModuleRef {
  open: () => void;
  close: () => void;
  addMessage: (sender: 'player' | 'bot', text: string) => void;
}

/* ===== GPT API ТҮР ХААСАН =====
   API түлхүүр байхгүй тул OpenAI дуудлагыг комментод оруулав.
   Түлхүүрээ .env дэх EXPO_PUBLIC_OPENAI_API_KEY-д тавьсны дараа:
     1) дээрх `import OpenAI from 'openai';` мөрийг нээ
     2) доорх getOpenAI-г нээ
     3) handleSendMessage доторх "GPT ДУУДЛАГА" блокийг нээж, offline хариултыг хаа

let openaiClient: OpenAI | null = null;
const getOpenAI = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "",
      dangerouslyAllowBrowser: true,
    });
  }
  return openaiClient;
};
*/

// API-гүй үед дүрмээс түлхүүр үгээр нь хариулна
const OFFLINE_ANSWERS: { keys: string[]; answer: string }[] = [
  { keys: ['жанлий нэрлэ', 'жанлий дууд', 'жанлий сонго'], answer: 'Жанлийд нэрлэгдсэн мод бүх модыг дийлнэ. Тоглолт эхлүүлэгч нь модоо харахаас ӨМНӨ жанлийгаа нэрлэх ёстой.' },
  { keys: ['гараа булаа', 'булаах'], answer: 'Хос жанлийтай бол гараа булаадаг. Ингэснээр жанлий дуудсан тоглогч гараагаа үргэлжлүүлэн тоглоно.' },
  { keys: ['жанлий', 'janlii'], answer: 'Жанлий бол бүх модыг идэх боломжтой мод. Тоглолт эхлүүлэгч модоо харахаас өмнө нэрлэдэг. Хос жанлийтай тоглогч гарахдаа ямар өнгийн ус дуудахаа сонгох эрхтэй. Хос жанлийгаа гаргалгүй өнгөрвөл жанлий үхнэ.' },
  { keys: ['үх', 'муу мод'], answer: 'Ахиулж идээгүй том мод муу мод болж үхнэ. Мөн хос жанлийгаа гаргалгүй өнгөрвөл, эсвэл ус дуудах үед өнгө дагасан хос авч үлдвэл үхнэ.' },
  { keys: ['гэр'], answer: 'Гарын хамгийн том мод гаргасан тоглогч гэр авна, хосоор ялвал 2 гэр. Бүх мод дуусахад гэр бариагүй бол 2-оос илүү гэртэй хүнээс цайгаар худалдаж авах эсвэл зээлнэ.' },
  { keys: ['цай'], answer: '10 модыг цай гэж тусад нь авч, 5 тоглогчид тэнцүү хуваана. Төгсгөлд хамгийн их цай хураасан тоглогч ялна — нийт цайг авлага оролцуулан тооцно.' },
  { keys: ['өнгө'], answer: 'Модны цэгийн нэг нь улаан бол улаан мод, бүгд цагаан бол цагаан мод. Хос гарсны дараа дараагийн тоглогчид ижил өнгийн ус модоо өгнө.' },
  { keys: ['гарах', 'эхл'], answer: 'Нэг модоор гарах бол 8 буюу түүнээс дээш нүдтэй модоор гарна. Хос буюу усаар гарахад нүдний тоо үл хамаарна.' },
  { keys: ['нохой'], answer: 'Нохой бол 6 цэгтэй ч бүх модны хамгийн том нь бөгөөд ямар ч өнгийн модыг иддэг.' },
  { keys: ['нууц'], answer: 'Хосгүй 2 мод гаргахад тэр нь нууц мод болж хаагдана. Нууц модны rank 1 тул тухайн гарыг авахгүй.' },
];

const offlineAnswer = (q: string) => {
  const lower = q.toLowerCase();
  const hit = OFFLINE_ANSWERS.find(a => a.keys.some(k => lower.includes(k)));
  return hit
    ? hit.answer
    : 'GPT туслах одоогоор идэвхгүй байна (API түлхүүр тавиагүй). Заавар дэлгэцийн "Дүрэм" таб дээрээс бүрэн дүрмийг харна уу.';
};

// Түгээмэл асуултын чипүүд
const SUGGESTIONS = ['Жанлий гэж юу вэ?', 'Хэзээ мод үхэх вэ?', 'Гэр яаж барих вэ?'];

// Тоглоомын дүрэм
const GAME_RULES = `Та "Цай хураах" тоглоомын дүрэм мэргэжилтэн бот мөн.
Тоглогчид танаас тоглоомын дүрмийн талаар асуух болно.

=== ЦАЙ ХУРААХ ТОГЛООМЫН ДҮРЭМ ===

📌 ҮНДСЭН МЭДЭЭЛЭЛ:
- Тоглогчдын тоо: 5 тоглогч
- Нийт мод: 60 ширхэг (10 жанлий + 50 гарын мод)
- Эхлэхэд: Тоглогч бүр 10 гарын мод авна (хар, цагаан холилдсон)
- Жанлий (Цай): 10 модыг цай гэж нэрлэж тусад нь тавина - оноо бүртгэхэд ашиглагдана

🎯 ТОГЛООМЫН ДҮРЭМ:

0️⃣ ЖАНЛИЙ НЭРЛЭХ:
- Жанлий гэдэг нь бүх модыг идэх боломжтой мод
- Жанлийд нэрлэгдсэн мод бүх модыг дийлнэ
- Тоглолт эхлүүлэгч нь модоо ХАРАХААС ӨМНӨ жанлийгаа нэрлэх ёстой
- ГАРАА БУЛААХ: хос жанлийтай бол гараа булаадаг, ингэснээр жанлий дуудсан тоглогч гараагаа үргэлжлүүлэн тоглоно

1️⃣ МОД ГАРАХ:
- Нэг модоор гарах бол заавал 8 буюу түүнээс дээш нүдтэй модоор гарна
- Хос мод буюу усаар гарах үед нүдний тоо үл хамаарна

3️⃣ ӨНГӨ ДАГУУЛАХ:
- Тоглогч хос гаргах үед дараа дараагийн тоглогчид гарч буй ижил өнгийн ус модоо өгнө

мод гаргахдаа өнгө таарсан мод гаргах    нэг модны дээр байрлах цэгийн нэг л улаан өнгөтэй байвал тэр улаан мод
харин бүгд цагаан цэг байвал цагаан мод болдог.

Моднууд хэрхэн нэг нэгийгээ иддэг вэ гэвэл модны дээр байгаа цэгийн тоо их бол тухайн мод том мод
дээрх цэгээрээ ранклагддаг.

Онцгой тохиолдол:
Нохой гэдэг нэртэй 6 ширхэг цэгтэй мод бол бүх модны хамгийн том  тэгээд ямар ч өнгийн модыг иддэг.

4️⃣ МОД АХИУЛАХ:
- Жанлийгаас бусад модыг заавал өнгө дагуу ахиулж тавих ёстой
- Ахиулж идээгүй тохиолдолд тухайн том мод ямар ч хэрэггүй МУУ МОД болж үхдэг

5️⃣ МУУ МОД ӨГӨХ:
- Гараа ахиулах модгүй тохиолдолд өнгө үл харгалзан муу мод өгч болно

6️⃣ МУУ ҮХЭХ :
- Ус дуудах үед өнгө дагасан хос авч үлдвэл үхдэг

🏆 ТОГЛООМЫН ТӨГСГӨЛ:

✅ ЯЛАГЧ ШАЛГАРУУЛАХ:
- Тоглолтын төгсгөлд хамгийн их цай хураасан тоглогч ялагч болно
- Нийт цайг авлага оролцуулан тооцно

🏠 ГЭР БАРИХ ДҮРЭМ:
- Бүх мод дуусах үед гэр босгож чадаагүй бол 2-оос илүү гэртэй хүнээс өөрт буй цайгаар худалдаж авах эсвэл зээлнэ
- 2-оос их гэр барьсан тоглогч гэр бариагүй тоглогчид гэрээ цайгаар зарах эсвэл авлагатай болно

💡 ОНЦЛОХ ЗҮЙЛС:
- Жанлий нь хамгийн чухал мод
- Өнгө дагуулах дүрэм маш чухал
- Цай хураалт нь ялалтын гол түлхүүр

ХАРИУЛАХДАА:
- Монгол хэлээр бичнэ
- Товч тодорхой, ойлгомжтой тайлбарлана
- Хэрэв дүрэмд байхгүй зүйл асуувал "Энэ нь тодорхой заагаагүй байна" гэж хэлнэ
- Найрсаг, туслахуйц байр суурьтай байна

Тоглоомын гол зорилго: Хамгийн их ЦАЙ хураах цуглуулах!`;

const ChatModule = React.forwardRef<ChatModuleRef>((props, ref) => {
  const { colors } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  React.useImperativeHandle(ref, () => ({
    open: () => setIsVisible(true),
    close: () => setIsVisible(false),
    addMessage: (sender: 'player' | 'bot', text: string) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        sender,
        text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);
      scrollToBottom();
    },
  }));

  const handleSendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!text || isLoading) return;

    const now = Date.now();
    const playerMessage: ChatMessage = {
      id: now.toString(),
      sender: 'player',
      text,
      timestamp: now,
    };

    setMessages(prev => [...prev, playerMessage]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    const typingId = (now + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: typingId, sender: 'bot', text: '⏳ Бичиж байна...', timestamp: now + 1 },
    ]);
    scrollToBottom();

    try {
      /* ===== GPT ДУУДЛАГА (API түлхүүр тавихад энэ блокийг нээ) =====
      console.log('🤖 OpenAI API дуудаж байна...');
      console.log('📤 Асуулт:', text);

      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: GAME_RULES },
          { role: 'user', content: text },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const answer = completion.choices[0].message.content || 'Хариулт олдсонгүй';
      console.log('✅ OpenAI хариулт:', answer.substring(0, 100) + '...');
      ===== GPT ДУУДЛАГА ТӨГСӨВ ===== */

      // API-гүй үеийн offline хариулт (GPT-г нээхдээ энэ 2 мөрийг устга)
      await new Promise(resolve => setTimeout(resolve, 400));
      const answer = offlineAnswer(text);

      // Bot мессаж нэмэх
      setMessages(prev =>
        prev
          .filter(m => m.id !== typingId)
          .concat({
            id: (Date.now() + 2).toString(),
            sender: 'bot',
            text: answer,
            timestamp: Date.now() + 2,
          })
      );
      scrollToBottom();
    } catch (e: any) {
      console.error('❌ Чат алдаа:', e);

      let errorMessage = '❌ Алдаа гарлаа';

      if (e.status === 401) {
        errorMessage = '❌ API Key буруу байна. Кодыг шалгана уу.';
      } else if (e.status === 429) {
        errorMessage = '❌ API rate limit хэтэрсэн. Түр хүлээнэ үү.';
      } else if (e.message) {
        errorMessage = `❌ Алдаа: ${e.message}`;
      }

      setMessages(prev =>
        prev
          .filter(m => m.id !== typingId)
          .concat({
            id: (Date.now() + 3).toString(),
            sender: 'bot',
            text: errorMessage,
            timestamp: Date.now() + 3,
          })
      );
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isPlayer = item.sender === 'player';

    return (
      <View
        style={[
          styles.messageContainer,
          isPlayer ? styles.playerMessage : styles.botMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isPlayer
              ? [styles.playerBubble, { backgroundColor: colors.accent }]
              : [styles.botBubble, { backgroundColor: colors.card }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isPlayer ? '#fff' : colors.text },
            ]}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  // Хаалттай үед DOM-д үлдэхгүйн тулд бүрмөсөн салгана (RN Web)
  if (!isVisible) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={() => setIsVisible(false)}
    >
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setIsVisible(false)} />

        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* HEADER */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Avatar label="Д" color={colors.accent} size={40} radius={13} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Дүрмийн туслах
              </Text>
              <Text style={styles.headerStatus}>Онлайн · шууд хариулна</Text>
            </View>

            <Pressable
              onPress={() => setIsVisible(false)}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.sunken, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.closeButtonText, { color: colors.subText }]}>✕</Text>
            </Pressable>
          </View>

          {/* MESSAGES */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={scrollToBottom}
            ListEmptyComponent={
              <View style={[styles.messageBubble, styles.botBubble, { backgroundColor: colors.card, alignSelf: 'flex-start' }]}>
                <Text style={[styles.messageText, { color: colors.text }]}>
                  Сайн уу! Цай хураахын дүрмээр юу ч асуу.
                </Text>
              </View>
            }
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* SUGGESTIONS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsRow}
              keyboardShouldPersistTaps="handled"
            >
              {SUGGESTIONS.map(q => (
                <Pressable
                  key={q}
                  onPress={() => handleSendMessage(q)}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    (pressed || isLoading) && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.suggestionText, { color: colors.subText }]}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* INPUT */}
            <View style={[styles.inputArea, { borderTopColor: colors.border }]}>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.sunken, color: colors.text },
                ]}
                placeholder="Асуултаа бичнэ үү…"
                placeholderTextColor={colors.muted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isLoading}
              />

              <Pressable
                onPress={() => handleSendMessage()}
                disabled={isLoading || !inputText.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: (pressed || isLoading || !inputText.trim()) ? 0.5 : 1
                  },
                ]}
              >
                <Text style={styles.sendButtonText}>{isLoading ? '⏳' : '↑'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
});

ChatModule.displayName = 'ChatModule';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,12,16,0.5)',
  },

  sheet: {
    height: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerStatus: { fontSize: 11, fontWeight: '600', color: PALETTE.green, marginTop: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { fontSize: 15, fontWeight: '800' },

  messagesList: { padding: 18, paddingBottom: 20, flexGrow: 1, gap: 10 },
  messageContainer: { flexDirection: 'row' },
  playerMessage: { justifyContent: 'flex-end' },
  botMessage: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  playerBubble: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  botBubble: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 18,
  },
  messageText: { fontSize: 13, fontWeight: '600', lineHeight: 20 },

  suggestionsRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 2,
  },
  suggestionText: { fontSize: 12, fontWeight: '700' },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 2,
  },
  textInput: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    fontWeight: '600',
    maxHeight: 100,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});

export default ChatModule;
