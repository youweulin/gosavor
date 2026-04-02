import { UtensilsCrossed, Receipt, Languages, MessageCircle, Scan } from 'lucide-react';
import type { ScanMode } from '../types';
import { useT } from '../i18n/context';

interface BottomTabBarProps {
  scanMode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  onCameraPress: () => void;
  onARPress: () => void;
  onChatPress: () => void;
  chatActive: boolean;
  activeTab: string;
}

const TABS = [
  { id: 'general', icon: Languages, color: 'text-slate-600', bg: 'bg-slate-600', shadow: 'shadow-slate-300' },
  { id: 'menu', icon: UtensilsCrossed, color: 'text-orange-500', bg: 'bg-orange-500', shadow: 'shadow-orange-200' },
  { id: 'ar', icon: Scan, color: 'text-zinc-500', bg: 'bg-zinc-500', shadow: 'shadow-zinc-200' },
  { id: 'receipt', icon: Receipt, color: 'text-blue-500', bg: 'bg-blue-500', shadow: 'shadow-blue-200' },
  { id: 'chat', icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-500', shadow: 'shadow-purple-200' },
];

const BottomTabBar = ({ onModeChange, onCameraPress, onARPress, onChatPress, activeTab }: BottomTabBarProps) => {
  const t = useT();

  const labels: Record<string, string> = {
    general: t('mode.general'),
    menu: t('mode.menu'),
    ar: 'AR翻譯',
    receipt: t('mode.receipt'),
    chat: '對話',
  };

  const handleTabPress = (id: string) => {
    if (id === 'ar') {
      onARPress();
    } else if (id === 'chat') {
      onChatPress();
    } else {
      onModeChange(id as ScanMode);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex items-end justify-around px-0">
          {/* Left tabs */}
          {TABS.slice(0, 2).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className={`flex-1 flex flex-col items-center py-3 min-h-[64px] justify-center transition-colors ${
                  isActive ? tab.color : 'text-gray-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mb-1 transition-all ${
                  isActive ? tab.bg : 'bg-transparent'
                }`} />
                <Icon size={26} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-xs mt-1 font-medium">{labels[tab.id]}</span>
              </button>
            );
          })}

          {/* Center — AR翻譯 (科技灰) */}
          <div className="flex-1 flex justify-center relative min-h-[64px]">
            <button
              onClick={() => handleTabPress('ar')}
              className="absolute -top-8 w-[72px] h-[72px] rounded-full bg-zinc-500 shadow-xl shadow-zinc-300/50 flex items-center justify-center active:scale-90 transition-all ring-4 ring-white"
            >
              <Scan size={32} className="text-white" />
            </button>
            <span className="mt-auto mb-3">&nbsp;</span>
          </div>

          {/* Right tabs */}
          {TABS.slice(3).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className={`flex-1 flex flex-col items-center py-3 min-h-[64px] justify-center transition-colors ${
                  isActive ? tab.color : 'text-gray-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mb-1 transition-all ${
                  isActive ? tab.bg : 'bg-transparent'
                }`} />
                <Icon size={26} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-xs mt-1 font-medium">{labels[tab.id]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomTabBar;
