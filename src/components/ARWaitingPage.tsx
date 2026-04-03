import { useState, useEffect } from 'react';
import { X, Smartphone, Zap } from 'lucide-react';

// 日本文化豆知識 + 諺語
const JAPAN_FACTS = [
  { type: '諺語', text: '七転び八起き', translation: '跌倒七次，爬起來八次', meaning: '不屈不撓的精神' },
  { type: '諺語', text: '猿も木から落ちる', translation: '連猴子也會從樹上掉下來', meaning: '即使是專家也會犯錯' },
  { type: '諺語', text: '石の上にも三年', translation: '在石頭上也要坐三年', meaning: '堅持就是力量' },
  { type: '諺語', text: '花より団子', translation: '比起花更愛糰子', meaning: '比起外表更重視實質' },
  { type: '諺語', text: '一期一会', translation: '一期一會', meaning: '每次相遇都是唯一的' },
  { type: '諺語', text: '出る杭は打たれる', translation: '出頭的釘子會被敲打', meaning: '木秀於林風必摧之' },
  { type: '諺語', text: '急がば回れ', translation: '越急越要繞路走', meaning: '欲速則不達' },
  { type: '諺語', text: '百聞は一見にしかず', translation: '聽一百次不如看一次', meaning: '百聞不如一見' },
  { type: '豆知識', text: '日本的自動販賣機超過 500 萬台', translation: '平均每 23 人就有一台', meaning: '密度世界第一' },
  { type: '豆知識', text: '日本新幹線平均延誤不到 1 分鐘', translation: '包含天災在內的統計', meaning: '準時到令人驚嘆' },
  { type: '豆知識', text: '日本的 Kit Kat 有超過 300 種口味', translation: '因為發音像「きっと勝つ」', meaning: '必勝的意思，常當考試禮物' },
  { type: '豆知識', text: '日本消費的咖啡比美國還多', translation: '咖啡進口量全球前三', meaning: '喫茶店文化深厚' },
  { type: '豆知識', text: '日本有 6,852 座島嶼', translation: '但只有約 430 座有人居住', meaning: '四大主島佔 97% 面積' },
  { type: '豆知識', text: '東京車站每天有超過 4,000 班列車', translation: '是全日本最繁忙的車站', meaning: '年乘客量超過 4 億人次' },
  { type: '禮儀', text: '在日本搭手扶梯要靠左站', translation: '大阪例外，大阪靠右站', meaning: '留出一側讓趕路的人通過' },
  { type: '禮儀', text: '日本餐廳結帳不在桌上放錢', translation: '要到櫃檯結帳或用托盤', meaning: '直接遞錢被視為不禮貌' },
  { type: '美食', text: '拉麵吸麵時發出聲音是禮貌', translation: '表示麵很好吃', meaning: '吸麵聲越大越表示讚賞' },
  { type: '美食', text: '日本的水果是奢侈品', translation: '一顆哈密瓜可以賣到上萬日圓', meaning: '送禮用的高級水果文化' },
];

interface ARWaitingPageProps {
  onClose: () => void;
}

const ARWaitingPage = ({ onClose }: ARWaitingPageProps) => {
  const [fact, setFact] = useState(() =>
    JAPAN_FACTS[Math.floor(Math.random() * JAPAN_FACTS.length)]
  );
  const [dots, setDots] = useState('');

  // Rotate dots animation
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Rotate fact every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFact(JAPAN_FACTS[Math.floor(Math.random() * JAPAN_FACTS.length)]);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-orange-50 to-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100">
        <div className="flex items-center gap-2">
          <img src="/goose-logo.png" alt="GoSavor" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-gray-900">AR 翻譯</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-8">
        {/* Loading animation */}
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🪿</div>
          <p className="text-lg font-bold text-gray-800">購莎鵝翻譯中{dots}</p>
          <p className="text-sm text-gray-400 mt-1">PWA 版本使用雲端 AI 翻譯，需要幾秒鐘</p>
        </div>

        {/* Japan fact card */}
        <div className="w-full max-w-sm bg-white rounded-2xl border border-orange-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">
              {fact.type}
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">{fact.text}</p>
          <p className="text-base text-orange-600 font-medium mb-2">{fact.translation}</p>
          <p className="text-sm text-gray-500">{fact.meaning}</p>
        </div>

        {/* iOS promotion */}
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">想要更快的翻譯體驗？</p>
              <p className="text-xs text-gray-400 mt-1">
                GoSavor iOS App 使用 Apple 原生 AR 翻譯，速度快 10 倍，還能即時疊字在畫面上！
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Smartphone size={14} className="text-orange-400" />
                <span className="text-xs text-orange-400 font-medium">即將上架 App Store</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom branding */}
      <div className="text-center py-4 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">GoSavor 購莎鵝 v0.8.1 · Made with 🪿 in Taiwan</p>
      </div>
    </div>
  );
};

export default ARWaitingPage;
