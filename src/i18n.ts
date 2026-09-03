import { createSignal } from 'solid-js'

export type Locale = 'en' | 'ru'

const LOCALE_KEY = 'chess:locale'

function storedLocale(): Locale | null {
  try {
    if (typeof localStorage === 'undefined') return null
    let raw = localStorage.getItem(LOCALE_KEY)
    return raw === 'ru' || raw === 'en' ? raw : null
  } catch {
    // Private mode or SSR — fall through to detection.
    return null
  }
}

function browserLocale(): Locale {
  try {
    if (typeof navigator === 'undefined') return 'en'
    let lang = navigator.language
    if (typeof lang === 'string' && lang.toLowerCase().startsWith('ru')) return 'ru'
  } catch {
    // Non-browser runtime — default below.
  }
  return 'en'
}

const en = {
  appTitle: 'Chess',
  twoPlayers: 'Two players',
  vsComputer: 'Vs computer',
  playOnline: 'Play online',
  colorWhite: 'White',
  colorBlack: 'Black',
  startGame: 'Start game',
  difficulty: 'Difficulty',
  createRoom: 'Create room',
  join: 'Join',
  roomCodePlaceholder: 'CODE',
  roomCodeLabel: 'Room code',
  languageLabel: 'Language',
  newGame: 'New game',
  undoMove: 'Undo move',
  undoTakeBack: 'Take back the last move',
  undoTakeBackOwn: 'Take back your last move',
  undoEmpty: 'Nothing to undo yet',
  room: 'Room',
  copy: 'Copy',
  copied: 'Copied',
  waitingRoomCode: 'Waiting for the room code',
  copyRoomCode: 'Copy the room code',
  pingTitle: 'Round-trip time to the server',
  pingUnit: 'ms',
  retry: 'Retry',
  reload: 'Reload',
  menu: 'Menu',
  resign: 'Resign',
  resignConfirm: 'Confirm resign?',
  resignTitle: 'Give up this game',
  resignArmedTitle: 'Click again to confirm',
  rematch: 'Rematch',
  rematchWaiting: 'Rematch (1/2)',
  rematchVoteTitle: 'Start a new game with swapped colors',
  rematchWaitingTitle: 'Waiting for the opponent',
  leaveRoom: 'Leave room',
  resignedWin: 'Opponent resigned. You win!',
  resignedLoss: 'You resigned. Opponent wins.',
  connecting: 'Connecting…',
  connected: 'Connected',
  youPlayWhite: 'You play White',
  youPlayBlack: 'You play Black',
  waitingOpponent: 'Waiting for opponent…',
  thinking: '{level} is thinking…',
  boardLabel: 'Chess board',
  promoTitle: 'Choose a promotion piece',
  promoChoose: 'Promotion on {sq} — choose a piece',
  cancel: 'Cancel',
  material: 'Material',
  even: 'Even',
  whiteLead: '+{n} White',
  blackLead: '{n} Black',
  whiteCaptured: 'White captured',
  blackCaptured: 'Black captured',
  moves: 'Moves',
  dragHint: 'Drag pieces with mouse, touch, or keyboard (Space + arrows).',
  checkmateWhite: 'Checkmate! White wins',
  checkmateBlack: 'Checkmate! Black wins',
  stalemate: 'Stalemate — draw',
  fifty: 'Draw — fifty-move rule',
  materialDraw: 'Draw — insufficient material',
  turnWhite: 'White to move',
  turnBlack: 'Black to move',
  turnWhiteCheck: 'White to move — check!',
  turnBlackCheck: 'Black to move — check!',
  moveTo: 'Move to {sq}',
  piecePawn: 'pawn',
  pieceKnight: 'knight',
  pieceBishop: 'bishop',
  pieceRook: 'rook',
  pieceQueen: 'queen',
  pieceKing: 'king',
  adjWhiteM: 'White',
  adjWhiteF: 'White',
  adjBlackM: 'Black',
  adjBlackF: 'Black',
  levelEasy: 'Easy',
  levelMedium: 'Medium',
  levelHard: 'Hard',
  crashGeneric: 'Something broke: {msg}. The error was sent to the server log.',
  crashTranslated:
    'Page translation breaks the board — turn it off and reload. The error was sent to the server log.',
}

export type Dict = typeof en

const ru: Dict = {
  appTitle: 'Шахматы',
  twoPlayers: 'Два игрока',
  vsComputer: 'Против компьютера',
  playOnline: 'Играть онлайн',
  colorWhite: 'Белые',
  colorBlack: 'Чёрные',
  startGame: 'Начать игру',
  difficulty: 'Сложность',
  createRoom: 'Создать комнату',
  join: 'Войти',
  roomCodePlaceholder: 'КОД',
  roomCodeLabel: 'Код комнаты',
  languageLabel: 'Язык',
  newGame: 'Новая игра',
  undoMove: 'Отменить ход',
  undoTakeBack: 'Вернуть последний ход',
  undoTakeBackOwn: 'Вернуть ваш последний ход',
  undoEmpty: 'Отменять пока нечего',
  room: 'Комната',
  copy: 'Копировать',
  copied: 'Скопировано',
  waitingRoomCode: 'Ожидание кода комнаты',
  copyRoomCode: 'Скопировать код комнаты',
  pingTitle: 'Задержка до сервера',
  pingUnit: 'мс',
  retry: 'Повторить',
  reload: 'Обновить',
  menu: 'Меню',
  resign: 'Сдаться',
  resignConfirm: 'Точно сдаться?',
  resignTitle: 'Сдать эту партию',
  resignArmedTitle: 'Нажмите ещё раз для подтверждения',
  rematch: 'Реванш',
  rematchWaiting: 'Реванш (1/2)',
  rematchVoteTitle: 'Новая партия со сменой цвета',
  rematchWaitingTitle: 'Ожидание соперника',
  leaveRoom: 'Покинуть комнату',
  resignedWin: 'Соперник сдался. Вы победили!',
  resignedLoss: 'Вы сдались. Победил соперник.',
  connecting: 'Подключение…',
  connected: 'Подключено',
  youPlayWhite: 'Вы играете белыми',
  youPlayBlack: 'Вы играете чёрными',
  waitingOpponent: 'Ожидание соперника…',
  thinking: '{level} думает…',
  boardLabel: 'Шахматная доска',
  promoTitle: 'Выберите фигуру',
  promoChoose: 'Превращение на {sq} — выберите фигуру',
  cancel: 'Отмена',
  material: 'Материал',
  even: 'Равно',
  whiteLead: '+{n} белые',
  blackLead: '{n} чёрные',
  whiteCaptured: 'Белые взяли',
  blackCaptured: 'Чёрные взяли',
  moves: 'Ходы',
  dragHint: 'Перетаскивайте фигуры мышью, пальцем или клавиатурой (пробел + стрелки).',
  checkmateWhite: 'Мат! Победа белых',
  checkmateBlack: 'Мат! Победа чёрных',
  stalemate: 'Пат — ничья',
  fifty: 'Ничья — правило пятидесяти ходов',
  materialDraw: 'Ничья — недостаточно материала',
  turnWhite: 'Ход белых',
  turnBlack: 'Ход чёрных',
  turnWhiteCheck: 'Ход белых — шах!',
  turnBlackCheck: 'Ход чёрных — шах!',
  moveTo: 'Ход на {sq}',
  piecePawn: 'пешка',
  pieceKnight: 'конь',
  pieceBishop: 'слон',
  pieceRook: 'ладья',
  pieceQueen: 'ферзь',
  pieceKing: 'король',
  adjWhiteM: 'Белый',
  adjWhiteF: 'Белая',
  adjBlackM: 'Чёрный',
  adjBlackF: 'Чёрная',
  levelEasy: 'Лёгкий',
  levelMedium: 'Средний',
  levelHard: 'Сложный',
  crashGeneric: 'Что-то сломалось: {msg}. Ошибка отправлена в лог сервера.',
  crashTranslated:
    'Перевод страницы ломает доску — отключите его и обновите страницу. Ошибка отправлена в лог сервера.',
}

// Exported for tests (key-parity check); app code goes through t().
export const STRINGS: Record<Locale, Dict> = { en, ru }

let [locale, setLocaleSignal] = createSignal<Locale>(storedLocale() ?? browserLocale())

export { locale }

export function setLocale(next: Locale): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, next)
  } catch {
    // Private mode — the choice simply won't persist.
  }
  setLocaleSignal(next)
}

// Reactive lookup: call it in JSX, memos or effect computes and the text
// follows locale switches. Placeholders look like {name}.
export function t(key: keyof Dict, vars?: Record<string, string | number>): string {
  let template: string = STRINGS[locale()][key]
  if (vars === undefined) return template
  let out = template
  for (let [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value))
  }
  return out
}
