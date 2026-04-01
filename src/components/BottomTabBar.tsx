import { UtensilsCrossed, Receipt, Languages, BookOpen } from 'lucide-react';
import type { ScanMode } from '../types';
import { useT } from '../i18n/context';

interface BottomTabBarProps {
  scanMode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  onCameraPress: () => void;
  onDiaryPress: () => void;
  hasResults: boolean;
}

const MODE_CONFIG = {
  menu: { icon: UtensilsCrossed, bg: 'bg-orange-500', shadow: 'shadow-orange-200', label: 'mode.menu' },
  receipt: { icon: Receipt, bg: 'bg-blue-500', shadow: 'shadow-blue-200', label: 'mode.receipt' },
  general: { icon: Languages, bg: 'bg-slate-700', shadow: 'shadow-slate-300', label: 'mode.general' },
};

const BottomTabBar = ({ scanMode, onModeChange, onCameraPress, onDiaryPress }: BottomTabBarProps) => {
  const t = useT();
  const current = MODE_CONFIG[scanMode];
  const CenterIcon = current.icon;

  const sideTabs: { mode?: ScanMode; icon: any; label: string; activeColor: string; action?: () => void }[] = [
    { mode: 'menu', icon: UtensilsCrossed, label: t('mode.menu'), activeColor: 'text-orange-500' },
    { mode: 'receipt', icon: Receipt, label: t('mode.receipt'), activeColor: 'text-blue-500' },
    // center is rendered separately
    { mode: 'general', icon: Languages, label: t('mode.general'), activeColor: 'text-slate-600' },
    { icon: BookOpen, label: '日記', activeColor: 'text-amber-500', action: onDiaryPress },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex items-end justify-around px-2 pt-1">
          {/* Left tabs */}
          {sideTabs.slice(0, 2).map((tab, i) => {
            const Icon = tab.icon;
            const active = tab.mode === scanMode;
            return (
              <button
                key={i}
                onClick={() => tab.mode && onModeChange(tab.mode)}
                className={`flex-1 flex flex-col items-center py-2 transition-colors ${
                  active ? tab.activeColor : 'text-gray-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
              </button>
            );
          })}

          {/* Center button — changes icon/color based on current mode */}
          <div className="flex-1 flex justify-center relative">
            <button
              onClick={onCameraPress}
              className={`absolute -top-7 w-16 h-16 rounded-full ${current.bg} shadow-xl ${current.shadow} flex items-center justify-center active:scale-90 transition-all`}
            >
              <CenterIcon size={28} className="text-white" />
            </button>
            <span className="text-[10px] mt-2 text-gray-400 font-medium pt-5">{t(current.label)}</span>
          </div>

          {/* Right tabs */}
          {sideTabs.slice(2).map((tab, i) => {
            const Icon = tab.icon;
            const active = tab.mode === scanMode;
            return (
              <button
                key={i + 2}
                onClick={() => tab.mode ? onModeChange(tab.mode) : tab.action?.()}
                className={`flex-1 flex flex-col items-center py-2 transition-colors ${
                  tab.mode ? (active ? tab.activeColor : 'text-gray-400') : 'text-gray-400'
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
