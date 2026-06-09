import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import OpenAI from 'openai';

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

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,  // ⬅️ API key-ээ .env файлд хадгална
  dangerouslyAllowBrowser: true,
});

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

  const handleSendMessage = async () => {
    const text = inputText.trim();
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
      console.log('🤖 OpenAI API дуудаж байна...');
      console.log('📤 Асуулт:', text);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', 
        messages: [
          {
            role: 'system',
            content: GAME_RULES,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const answer = completion.choices[0].message.content || 'Хариулт олдсонгүй';
      
      console.log('✅ OpenAI хариулт:', answer.substring(0, 100) + '...');

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
      console.error('❌ OpenAI алдаа:', e);

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
            {
              backgroundColor: isPlayer ? colors.card : colors.background,
              borderColor: colors.card,
              borderWidth: isPlayer ? 0 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isPlayer ? colors.background : colors.text },
            ]}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setIsVisible(false)}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.title }]}>
            💬 Тоглоомын Дүрэм
          </Text>

          <Pressable
            onPress={() => setIsVisible(false)}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.closeButtonText, { color: colors.background }]}>
              ✕
            </Text>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                Тоглоомын дүрмийн талаар асуугаарай!
              </Text>
            </View>
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[
            styles.inputArea,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Асуулт асуух..."
            placeholderTextColor={colors.text}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
          />

          <Pressable
            onPress={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: colors.card,
                opacity: (pressed || isLoading || !inputText.trim()) ? 0.5 : 1
              },
            ]}
          >
            <Text style={[styles.sendButtonText, { color: colors.background }]}>
              {isLoading ? '⏳' : '➤'}
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
});

ChatModule.displayName = 'ChatModule';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  closeButtonText: { fontSize: 24, fontWeight: 'bold' },

  messagesList: { padding: 16,paddingBottom: 20, flexGrow: 1 },
  messageContainer: { marginBottom: 20, flexDirection: 'row' },
  playerMessage: { justifyContent: 'flex-end' },
  botMessage: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  messageText: { fontSize: 14, lineHeight: 20 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    margin: 10,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: { fontSize: 18, fontWeight: 'bold' },
});

export default ChatModule;