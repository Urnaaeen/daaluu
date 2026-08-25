# Цай хураах даалуу

Монгол даалууны "Цай хураах" дүрмээр тоглох Expo React Native апп. Төсөлд ганцаарчилсан боттой тоглох горим, Firebase Realtime Database ашигласан өрөө үүсгэх/нэгдэх multiplayer горим, тоглоомын дүрэм асуух OpenAI chat туслах, light/dark theme, даалууны зурагт assets багтсан.

## Гол боломжууд

- Өрөө үүсгэх, 4 оронтой кодоор өрөөнд нэгдэх multiplayer flow.
- 2-5 хүн нэгдсэний дараа үлдсэн суудлыг бот автоматаар дүүргэн 5 тоглогчтой тоглоом эхлүүлэх.
- Firebase Realtime Database дээр өрөө, тоглогч, гар, төвийн мод, ээлж, оноо realtime sync хийх.
- Боттой ганцаарчилсан тоглолт.
- Даалууны 50 модыг холих, 5 тоглогчид 10-аар хуваах deck logic.
- Нэг мод, хос мод, нууц мод, өнгө дагуулах, rank-аар ахиулах үндсэн тоглолтын logic.
- Раунд бүрийн оноо, цай/авлага/өглөгийн худалдааны систем, ялагч тодруулах modal.
- Дүрэм харах дэлгэц болон OpenAI API ашигласан дүрэм асуух chat.
- Custom theme context, light/dark өнгөний тохиргоо.

## Tech stack

- Expo SDK 54
- React 19, React Native 0.81
- Expo Router
- TypeScript
- Firebase Realtime Database
- OpenAI SDK
- Socket.IO client/server кодын туршилтын хэсгүүд
- Express backend prototypes

## Төслийн бүтэц

```text
daaluu/
├─ board-game/              # Expo mobile/web app
│  ├─ app/                  # Expo Router screens болон game logic
│  │  ├─ index.tsx          # Main menu, room create/join modal
│  │  ├─ playScreen.tsx     # Botтой local тоглолт
│  │  ├─ multiplayer.tsx    # Multiplayer lobby
│  │  ├─ multiplayerGame.tsx# Firebase sync-тэй multiplayer game
│  │  ├─ ask.tsx            # OpenAI дүрэм асуух chat
│  │  ├─ trading.ts         # Цай/авлага/өглөг худалдааны logic
│  │  ├─ botlogic.ts        # Bot-ийн мод сонгох logic
│  │  ├─ types.ts           # Даалууны модны төрөл, rank, assets
│  │  └─ utils/gameService.ts
│  ├─ assets/               # App icon, background, даалууны зургууд
│  ├─ components/           # Header, score bar, modal, themed components
│  ├─ context/              # ThemeProvider
│  ├─ theme/                # Light/dark colors
│  └─ package.json
├─ back-end/                # Socket.IO multiplayer server prototype
└─ game-server/             # Хуучин/туршилтын Socket.IO server prototype
```

Одоогийн аппын үндсэн multiplayer flow нь `board-game/app/utils/gameService.ts` файлаар Firebase Realtime Database ашиглаж байна. `back-end/` болон `game-server/` нь Socket.IO дээр суурилсан prototype/туршилтын серверүүд бөгөөд frontend-ийн одоогийн үндсэн multiplayer flow-д шууд ашиглагдахгүй.

## Шаардлага

- Node.js 20 эсвэл түүнээс дээш хувилбар
- npm
- Android Emulator, iOS Simulator эсвэл Expo Go
- Firebase Realtime Database project
- OpenAI API key, зөвхөн дүрэм асуух chat ашиглах бол хэрэгтэй

## Суулгах

Repository root-оос:

```bash
cd board-game
npm install
```

Backend prototype-уудыг тусад нь ажиллуулах шаардлагатай бол:

```bash
cd ../back-end
npm install
```

```bash
cd ../game-server
npm install
```

## Environment variables

`board-game/.env` файлд OpenAI key-г хадгална:

```env
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

Анхаарах зүйл:

- `.env` файлыг git-д commit хийхгүй.
- `EXPO_PUBLIC_` prefix-тэй хувьсагч client bundle дотор ордог тул public client app-д ашиглахад эрсдэлтэй. Production үед OpenAI хүсэлтийг өөрийн backend-ээр дамжуулах нь зөв.
- Firebase config одоогоор `board-game/app/firebase.ts` файлд шууд байна. Production үед project-ийн орчны тохиргоог тусад нь удирдахыг зөвлөе.

## Апп ажиллуулах

```bash
cd board-game
npm start
```

Дараа нь Expo terminal-оос:

- `a` дарж Android дээр нээх
- `i` дарж iOS Simulator дээр нээх
- `w` дарж web дээр нээх
- Expo Go ашиглаж QR code уншуулах

LAN асуудалтай үед tunnel ашиглаж болно:

```bash
npx expo start --tunnel
```

## Script-үүд

`board-game/package.json`:

```bash
npm start       # expo start
npm run android # Android дээр ажиллуулах
npm run ios     # iOS дээр ажиллуулах
npm run web     # Web дээр ажиллуулах
npm run lint    # Expo lint
```

`back-end/package.json`:

```bash
npm start # node server.js
npm run dev # nodemon server.js
```

## Тоглоомын урсгал

1. Нүүр дэлгэцээс "Тоглоом үүсгэх", "Холбогдож тоглох", "Боттой тоглох", "Тоглоомын заавар" сонгоно.
2. Host өрөө үүсгэхэд 4 оронтой room code гарна.
3. Бусад тоглогчид room code болон нэрээ оруулж орно.
4. Lobby дээр тоглогч бүр ready болно.
5. Host тоглоом эхлүүлэхэд 5 хүртэлх суудлыг бот дүүргэнэ.
6. Deck холигдож 50 модыг 5 тоглогчид 10-аар хуваана.
7. Тоглогчид ээлжээр мод гаргана.
8. 5 тоглогч бүгд гарсны дараа тухайн round-ийн ялагч оноо авна.
9. Бүх гар дуусах эсвэл эхлэх боломжгүй үед худалдааны систем ажиллаж цай/авлага/өглөг шинэчлэгдэнэ.
10. Төгсгөлийн нөхцөл биелэхэд ялагч modal гарна.

## Гол файлууд

- `app/index.tsx` - main menu, room create/join UI.
- `app/playScreen.tsx` - local bot game, deck үүсгэх, shuffle/deal logic.
- `app/multiplayer.tsx` - Firebase room үүсгэх/нэгдэх, ready state, bot auto-fill, game start.
- `app/multiplayerGame.tsx` - multiplayer game board, realtime state, human/bot move, round score.
- `app/utils/gameService.ts` - Firebase CRUD/listener helper functions.
- `app/trading.ts` - цай, авлага, өглөгийн худалдаа болон winner calculation.
- `app/botlogic.ts` - bot-ийн move сонгох algorithm.
- `app/types.ts` - даалууны моднуудын rank, өнгө, зураг, тоо.
- `app/ask.tsx` - OpenAI chat module.
- `theme/colors.ts` болон `context/ThemeContext.tsx` - theme тохиргоо.

## Multiplayer data model

Firebase Realtime Database-д өрөө дараах хэлбэрээр хадгалагдана:

```text
rooms/{roomCode}
├─ host
├─ players/{index}
│  ├─ name
│  ├─ isHost
│  ├─ isReady
│  ├─ connected
│  ├─ isBot
│  ├─ stars
│  ├─ tsai
│  ├─ avlaga
│  └─ uglug
└─ gameState
   ├─ started
   ├─ currentPlayerIndex
   ├─ center
   ├─ roundMoves
   ├─ hands
   └─ gameEnded
```

## Дүрмийн товч

- Нийт 50 гарын мод ашиглана.
- 5 тоглогч тус бүр 10 мод авна.
- Эхлэхдээ rank 8 буюу түүнээс дээш нэг мод эсвэл хос модоор эхэлж болно.
- Хос гарсан үед дараагийн тоглогчид өнгө дагуулах хос гаргах logic-той.
- Ижил биш 2 мод гаргавал нууц мод хэлбэрээр төвд орно.
- Round бүрт хамгийн хүчтэй valid мод гаргасан тоглогч оноо авна.
- Хосоор round авахад 2 оноо, нэг модоор авахад 1 оноо нэмэгдэнэ.
- Гар дуусахад 2-оос их оноотой тоглогчид илүү оноогоо цай болгон зарж, 2-оос бага оноотой тоглогчид худалдаж авна.
- Цай хүрэлцэхгүй бол авлага/өглөг бүртгэгдэнэ.
- Ялагчийг `цай + авлага - өглөг` томъёогоор эрэмбэлнэ.

## Backend prototype-ууд

`back-end/` нь Express + Socket.IO server prototype:

- `GET /health` - server status
- `GET /rooms` - active rooms
- Socket events: `createRoom`, `joinRoom`, `playTiles`, `roundEnd`, `gameEnd`, `ping`
- Socket.IO Admin UI: `https://admin.socket.io`

Ажиллуулах:

```bash
cd back-end
npm run dev
```

Тайлбар: `back-end/src/room/room.js` нь `../game/deck` гэж require хийж байгаа боловч одоогийн файл `back-end/src/game/desk.js` нэртэй байна. Энэ server-ийг идэвхтэй ашиглах бол `desk.js`-ийг `deck.js` болгох эсвэл require path-ийг засах хэрэгтэй.

`game-server/` нь илүү хуучин Socket.IO prototype бөгөөд tic-tac-toe маягийн state хадгалсан туршилтын кодтой. Үндсэн Expo app-ийн Firebase multiplayer-тэй холбогдоогүй.

## Troubleshooting

- `OpenAI API key` алдаа гарвал `board-game/.env` файлд `EXPO_PUBLIC_OPENAI_API_KEY` байгаа эсэхийг шалгаад Expo server-ээ restart хийнэ.
- Firebase room update ирэхгүй бол `app/firebase.ts` config болон Realtime Database rules-ээ шалгана.
- Expo Go дээр device болон computer нэг network дээр байгаа эсэхийг шалгана.
- LAN дээр холбогдохгүй бол `npx expo start --tunnel` ашиглана.
- Asset зураг харагдахгүй бол `assets/objects/` доторх файлын нэр болон `app/types.ts` дахь require path-уудыг шалгана.

## Code quality

Lint ажиллуулах:

```bash
cd board-game
npm run lint
```

Одоогоор automated test script байхгүй. Game logic-ийг production түвшинд гаргах бол `trading.ts`, `botlogic.ts`, `gameService.ts`, deck shuffle/deal logic дээр unit test нэмэх нь хамгийн түрүүнд хэрэгтэй.
