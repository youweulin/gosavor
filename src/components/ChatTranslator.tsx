import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mic, MicOff, Volume2, Send, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { speakText, startListening, stopListening } from '../services/NativeSpeech';
import { useT } from '../i18n/context';

interface ChatTranslatorProps {
  onBack: () => void;
  apiKey: string;
  targetLanguage: string;
}

interface ChatMessage {
  role: 'user' | 'staff';
  original: string;
  translated: string;
  lang: string;
}

const QUICK_PHRASES = [
  { label: '你好', ja: 'こんにちは' },
  { label: '謝謝', ja: 'ありがとうございます' },
  { label: '請問...', ja: 'すみません' },
  { label: '多少錢？', ja: 'いくらですか？' },
  { label: '廁所在哪？', ja: 'トイレはどこですか？' },
  { label: '可以刷卡嗎？', ja: 'カードで払えますか？' },
  { label: '推薦什麼？', ja: 'おすすめは何ですか？' },
  { label: '不辣的', ja: '辛くないのをお願いします' },
  { label: '要水', ja: 'お水をください' },
  { label: '好吃！', ja: '美味しいです！' },
  { label: '再見', ja: 'さようなら' },
];

const ChatTranslator = ({ onBack, apiKey, targetLanguage }: ChatTranslatorProps) => {
  const t = useT();
  const CHAT_HISTORY_KEY = 'gosavor_chat_history';

  // Load saved messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
    } catch { return []; }
  });
  const [isListeningJa, setIsListeningJa] = useState(false);
  const [isListeningUser, setIsListeningUser] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [textInput, setTextInput] = useState('');
  const lastHeardRef = useRef('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isNative = Capacitor.isNativePlatform();

  // User language label for button
  const userLangLabel = (() => {
    const map: Record<string, string> = {
      'zh-TW': '🇹🇼 中文', 'zh-CN': '🇨🇳 中文', 'en': '🇺🇸 English',
      'ko': '🇰🇷 한국어', 'th': '🇹🇭 ไทย', 'vi': '🇻🇳 Tiếng Việt',
      'fr': '🇫🇷 Français', 'es': '🇪🇸 Español', 'de': '🇩🇪 Deutsch', 'id': '🇮🇩 Indonesia',
    };
    return map[targetLanguage] || '🗣 我說';
  })();

  // Save messages whenever they change
  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages(prev => {
      const next = updater(prev);
      try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(next.slice(-100))); } catch {}
      return next;
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Auto-scroll to bottom on mount
  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'auto' }), 200);
  }, []);

  // Translate: Apple first (free offline) → Gemini fallback
  const translateText = async (text: string, from: string, to: string): Promise<string> => {
    // Try Apple Translate (native only)
    if (isNative) {
      try {
        const { default: NS } = await import('../services/NativeSpeech');
        const langMap: Record<string, string> = {
          'Japanese': 'ja', 'Chinese': 'zh-Hant', 'English': 'en',
          '繁體中文': 'zh-Hant', '简体中文': 'zh-Hans',
          '한국어': 'ko', 'ภาษาไทย': 'th', 'Tiếng Việt': 'vi',
          'Français': 'fr', 'Español': 'es', 'Deutsch': 'de',
        };
        const fromCode = langMap[from] || from;
        const toCode = langMap[to] || to;
        const res = await NS.translate({ text, from: fromCode, to: toCode });
        if (res.translated && res.engine === 'apple') {
          console.log('[GoSavor Chat] ✅ Apple Translate:', text.substring(0, 15), '→', res.translated.substring(0, 15));
          return res.translated;
        }
      } catch (e) {
        console.warn('[GoSavor Chat] Apple Translate failed:', e);
      }
    }
    // Gemini fallback
    if (!apiKey) return text;
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate to ${to}. Only return the translation, nothing else: "${text}"`,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      console.log('[GoSavor Chat] Gemini translate');
      return res.text?.trim() || text;
    } catch { return text; }
  };

  // Get language code for speech
  const getUserLangCode = () => {
    const map: Record<string, string> = {
      'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN', 'en': 'en-US',
      'ko': 'ko-KR', 'th': 'th-TH', 'vi': 'vi-VN',
      'fr': 'fr-FR', 'es': 'es-ES', 'de': 'de-DE', 'id': 'id-ID',
    };
    return map[targetLanguage] || 'zh-TW';
  };

  // Listen to Japanese (staff speaking)
  const toggleListenJapanese = async () => {
    if (isListeningJa) {
      await stopListening();
      setIsListeningJa(false);
      const text = lastHeardRef.current.trim();
      if (text) {
        const translated = await translateText(text, 'Japanese', targetLanguage);
        updateMessages(prev => [...prev, { role: 'staff', original: text, translated, lang: 'ja' }]);
        // Play translated text in user's language so they can hear it
        await speakText(translated, getUserLangCode(), 0.45);
        // Increment chat count
        const count = parseInt(localStorage.getItem('gosavor_chat_count') || '0');
        localStorage.setItem('gosavor_chat_count', String(count + 1));
        scrollToBottom();
      }
      setLiveText('');
      lastHeardRef.current = '';
      return;
    }

    setLiveText('');
    lastHeardRef.current = '';
    setIsListeningJa(true);

    if (isNative) {
      await startListening('ja-JP', (text) => {
        setLiveText(text);
        lastHeardRef.current = text;
      });
    }
  };

  // Listen to user's language
  const toggleListenUser = async () => {
    if (isListeningUser) {
      await stopListening();
      setIsListeningUser(false);
      const text = lastHeardRef.current.trim();
      if (text) {
        const jaTranslated = await translateText(text, targetLanguage, 'Japanese');
        updateMessages(prev => [...prev, { role: 'user', original: text, translated: jaTranslated, lang: getUserLangCode() }]);
        // Speak Japanese translation
        await speakText(jaTranslated, 'ja-JP', 0.45);
        scrollToBottom();
      }
      setLiveText('');
      lastHeardRef.current = '';
      return;
    }

    setLiveText('');
    lastHeardRef.current = '';
    setIsListeningUser(true);

    if (isNative) {
      await startListening(getUserLangCode(), (text) => {
        setLiveText(text);
        lastHeardRef.current = text;
      });
    }
  };

  // Send quick phrase
  const sendQuickPhrase = async (label: string, ja: string) => {
    updateMessages(prev => [...prev, { role: 'user', original: label, translated: ja, lang: getUserLangCode() }]);
    await speakText(ja, 'ja-JP', 0.45);
    scrollToBottom();
  };

  // Send typed text
  const sendTextInput = async () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    const jaTranslated = await translateText(text, targetLanguage, 'Japanese');
    updateMessages(prev => [...prev, { role: 'user', original: text, translated: jaTranslated, lang: getUserLangCode() }]);
    await speakText(jaTranslated, 'ja-JP', 0.45);
    scrollToBottom();
  };

  // Speak a message — always play the TRANSLATED version
  // User message: play Japanese (translated) for the staff
  // Staff message: play user language (translated) for the user
  const speakMsg = async (msg: ChatMessage) => {
    if (msg.role === 'user') {
      // User said something → play the Japanese translation
      await speakText(msg.translated, 'ja-JP', 0.45);
    } else {
      // Staff said Japanese → play user's language translation
      await speakText(msg.translated, getUserLangCode(), 0.45);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">對話翻譯</h1>
            <p className="text-xs text-gray-400">即時翻譯，跟日本人溝通</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { updateMessages(() => []); }}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400"
              title="清除對話"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Chat messages — top padding for header, bottom for fixed buttons */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-52 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🗣</p>
            <p className="font-bold text-gray-400">開始對話</p>
            <p className="text-xs text-gray-300 mt-1">點下方按鈕說話，或用快速用語</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              msg.role === 'user'
                ? 'bg-[#8CD790] rounded-br-sm'
                : 'bg-white border border-gray-200 rounded-bl-sm shadow-sm'
            }`}>
              {msg.role === 'user' ? (
                <>
                  <p className="text-lg font-bold text-orange-600">{msg.original}</p>
                  <p className="text-lg mt-2 font-bold text-gray-900">→ {msg.translated}</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-900">{msg.original}</p>
                  <p className="text-lg mt-2 font-bold text-orange-600">→ {msg.translated}</p>
                </>
              )}
              <button
                onClick={() => speakMsg(msg)}
                className="mt-2 p-1.5 rounded-full hover:bg-black/10"
              >
                <Volume2 size={16} className="text-gray-500" />
              </button>
            </div>
          </div>
        ))}

        {/* Live listening indicator */}
        {(isListeningJa || isListeningUser) && (
          <div className={`flex ${isListeningUser ? 'justify-end' : 'justify-start'}`}>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 max-w-[80%]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-yellow-700 font-medium">聆聽中...</span>
              </div>
              {liveText && <p className="text-sm font-bold text-gray-900 mt-1">{liveText}</p>}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Fixed bottom area */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-4 pt-3">
        {/* Text input */}
        <div className="flex gap-2 mb-3">
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendTextInput()}
            placeholder="輸入文字翻譯成日語..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-base focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
          />
          <button
            onClick={sendTextInput}
            disabled={!textInput.trim()}
            className="px-4 py-3 bg-orange-500 rounded-2xl text-white disabled:opacity-30"
          >
            <Send size={22} />
          </button>
        </div>

        {/* Voice buttons */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={toggleListenJapanese}
            className={`py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              isListeningJa
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }`}
          >
            {isListeningJa ? <MicOff size={20} /> : <Mic size={20} />}
            🇯🇵 {isListeningJa ? '停止' : '日語'}
          </button>
          <button
            onClick={toggleListenUser}
            className={`py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              isListeningUser
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            }`}
          >
            {isListeningUser ? <MicOff size={20} /> : <Mic size={20} />}
            {isListeningUser ? '停止' : userLangLabel}
          </button>
        </div>

        {/* Quick phrases */}
        <div className="pb-[env(safe-area-inset-bottom)]">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {QUICK_PHRASES.map((phrase, i) => (
              <button
                key={i}
                onClick={() => sendQuickPhrase(phrase.label, phrase.ja)}
                className="shrink-0 px-4 py-2 bg-gray-100 hover:bg-orange-50 rounded-full text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors"
              >
                {phrase.label}
              </button>
            ))}
          </div>
        </div>
      </div>{/* close sticky bottom */}
    </div>
  );
};

export default ChatTranslator;
