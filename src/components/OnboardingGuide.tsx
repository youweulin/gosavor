import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Camera, UtensilsCrossed, ScanLine, MessageCircle, Sparkles, Image } from 'lucide-react';

interface OnboardingGuideProps {
  onClose: () => void;
}

const SLIDES = [
  {
    icon: Sparkles,
    emoji: '🪿',
    title: '歡迎來到 GoSavor！',
    subtitle: '購莎鵝帶你暢遊日本',
    description: '一拍即翻的 AI 旅遊翻譯神器\n菜單、收據、路牌、藥妝通通搞定',
    tip: '目前為公開測試版，歡迎回饋意見！',
    badge: '公測中',
    color: 'from-orange-400 to-orange-600',
  },
  {
    icon: Image,
    emoji: '🔍',
    title: 'AI 翻譯',
    subtitle: '萬用圖片翻譯',
    description: '拍任何文字都能翻譯\n路牌、藥品、零食包裝、告示牌、籤詩…',
    tip: '不確定拍什麼？選這個就對了！',
    color: 'from-amber-400 to-orange-500',
  },
  {
    icon: UtensilsCrossed,
    emoji: '🍣',
    title: '菜單翻譯',
    subtitle: '直書橫書都能翻',
    description: '拍菜單照片，AI 自動辨識所有餐點\n中文翻譯 + 料理說明 + 過敏原提醒',
    tip: '支援最多 4 頁菜單，還能直接點餐！',
    color: 'from-red-400 to-orange-500',
  },
  {
    icon: Camera,
    emoji: '📷',
    title: 'AR 拍照翻譯',
    subtitle: '拍照即翻，覆蓋原文',
    description: '對準文字拍照，翻譯直接顯示在圖上\n適合快速查看菜單或商品標籤',
    tip: 'iOS 使用 Apple 翻譯引擎，完全免費離線可用',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    icon: ScanLine,
    emoji: '🧾',
    title: '收據翻譯',
    subtitle: '掃收據自動記帳',
    description: '拍收據照片，自動辨識品名、價格、稅額\n旅遊花費一目瞭然',
    tip: '支援日本常見的消費稅（8%/10%）分項',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    icon: MessageCircle,
    emoji: '💬',
    title: '對話翻譯',
    subtitle: '跟日本人輕鬆溝通',
    description: '按住說話，即時翻譯成日文\n對方回話也能即時翻成中文',
    tip: '使用 Apple 離線翻譯，不用網路也能用！',
    color: 'from-violet-400 to-purple-500',
  },
];

const OnboardingGuide = ({ onClose }: OnboardingGuideProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchDelta, setTouchDelta] = useState(0);

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;
  const Icon = slide.icon;

  const goNext = useCallback(() => {
    if (isLast) {
      onClose();
    } else {
      setCurrentSlide(s => s + 1);
    }
  }, [isLast, onClose]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) setCurrentSlide(s => s - 1);
  }, [currentSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchDelta(e.touches[0].clientX - touchStart);
  };

  const handleTouchEnd = () => {
    if (touchDelta < -50) goNext();
    else if (touchDelta > 50) goPrev();
    setTouchDelta(0);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Skip button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
        >
          <X size={18} />
        </button>

        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${slide.color} px-6 pt-10 pb-8 text-center text-white`}>
          <div className="text-5xl mb-3">{slide.emoji}</div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 mb-3">
            <Icon size={24} />
          </div>
          {'badge' in slide && slide.badge && (
            <span className="inline-block mb-2 px-3 py-1 bg-white/25 rounded-full text-xs font-bold tracking-wide">
              {slide.badge}
            </span>
          )}
          <h2 className="text-2xl font-bold mb-1">{slide.title}</h2>
          <p className="text-white/80 text-sm">{slide.subtitle}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-700 text-center whitespace-pre-line leading-relaxed mb-4">
            {slide.description}
          </p>
          <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
            <p className="text-orange-700 text-sm font-medium">
              💡 {slide.tip}
            </p>
          </div>
        </div>

        {/* Bottom: dots + buttons */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {/* Prev button */}
          <button
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 disabled:opacity-0"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Dots */}
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === currentSlide
                    ? 'w-6 h-2.5 bg-orange-500'
                    : 'w-2.5 h-2.5 bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Next / Start button */}
          <button
            onClick={goNext}
            className={`flex items-center justify-center rounded-full transition-all ${
              isLast
                ? 'bg-orange-500 text-white px-5 h-10 font-bold text-sm shadow-lg'
                : 'w-10 h-10 bg-orange-500 text-white'
            }`}
          >
            {isLast ? '開始使用' : <ChevronRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGuide;
