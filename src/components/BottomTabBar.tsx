import { UtensilsCrossed, Receipt, Bot, MessageCircle, Camera } from 'lucide-react';
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
  { id: 'general', icon: Bot, label: 'AI翻譯' },
  { id: 'menu', icon: UtensilsCrossed, label: '' }, // label set via i18n
  { id: 'ar', icon: Camera, label: 'AR拍照' },
  { id: 'receipt', icon: Receipt, label: '' }, // label set via i18n
  { id: 'chat', icon: MessageCircle, label: '對話' },
];

const BottomTabBar = ({ onModeChange, onARPress, onChatPress, activeTab }: BottomTabBarProps) => {
  const t = useT();

  const labels: Record<string, string> = {
    general: 'AI翻譯',
    menu: t('mode.menu'),
    ar: 'AR拍照',
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
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className={`flex-1 flex flex-col items-center py-3 min-h-[64px] justify-center transition-colors ${
                  isActive ? 'text-orange-500' : 'text-gray-400'
                }`}
              >
                <div className={`p-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-orange-100' : 'bg-transparent'
                }`}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-orange-500' : 'text-gray-400'}`}>
                  {labels[tab.id]}
                </span>
                {/* Active indicator: dot + underline */}
                <div className={`mt-1 transition-all ${
                  isActive
                    ? 'w-5 h-[3px] bg-orange-500 rounded-full'
                    : 'w-0 h-[3px] bg-transparent'
                }`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomTabBar;
