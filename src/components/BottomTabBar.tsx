import { UtensilsCrossed, Receipt, Languages, Camera, BookOpen } from 'lucide-react';
import type { ScanMode } from '../types';
import { useT } from '../i18n/context';

interface BottomTabBarProps {
  scanMode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  onCameraPress: () => void;
  onDiaryPress: () => void;
  hasResults: boolean;
}

const BottomTabBar = ({ scanMode, onModeChange, onCameraPress, onDiaryPress, hasResults }: BottomTabBarProps) => {
  const t = useT();

  const tabs: { mode?: ScanMode; icon: any; label: string; color: string; action?: () => void }[] = [
    { mode: 'menu', icon: UtensilsCrossed, label: t('mode.menu'), color: 'text-orange-500' },
    { mode: 'receipt', icon: Receipt, label: t('mode.receipt'), color: 'text-blue-500' },
    // Camera button placeholder (rendered separately)
    { mode: 'general', icon: Languages, label: t('mode.general'), color: 'text-slate-600' },
    { icon: BookOpen, label: '日記', color: 'text-amber-500', action: onDiaryPress },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      {/* Tab bar background */}
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex items-end justify-around px-2 pt-1">
          {/* Left tabs */}
          {tabs.slice(0, 2).map((tab, i) => {
            const Icon = tab.icon;
            const active = tab.mode === scanMode;
            return (
              <button
                key={i}
                onClick={() => tab.mode ? onModeChange(tab.mode) : tab.action?.()}
                className={`flex-1 flex flex-col items-center py-2 transition-colors ${
                  active ? tab.color : 'text-gray-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
              </button>
            );
          })}

          {/* Center camera button — floating above */}
          <div className="flex-1 flex justify-center relative">
            <button
              onClick={onCameraPress}
              className="absolute -top-7 w-16 h-16 rounded-full bg-orange-500 shadow-xl shadow-orange-200 flex items-center justify-center hover:bg-orange-600 active:scale-90 transition-all"
            >
              <Camera size={28} className="text-white" />
            </button>
            <span className="text-[10px] mt-2 text-gray-400 font-medium pt-5">拍照</span>
          </div>

          {/* Right tabs */}
          {tabs.slice(2).map((tab, i) => {
            const Icon = tab.icon;
            const active = tab.mode === scanMode;
            return (
              <button
                key={i + 2}
                onClick={() => tab.mode ? onModeChange(tab.mode) : tab.action?.()}
                className={`flex-1 flex flex-col items-center py-2 transition-colors ${
                  tab.mode ? (active ? tab.color : 'text-gray-400') : 'text-gray-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomTabBar;
