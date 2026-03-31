import { useState, useEffect } from 'react';
import { Clock, Trash2, ChevronRight, UtensilsCrossed, Receipt, Languages } from 'lucide-react';
import type { SavedScan } from '../types';
import { getScanHistory, deleteScan } from '../services/storage';
import { useT } from '../i18n/context';

interface ScanHistoryProps {
  onLoadScan: (scan: SavedScan) => void;
}

const modeIcons = {
  menu: { icon: UtensilsCrossed, color: 'text-orange-500', bg: 'bg-orange-50', labelKey: 'history.menuType' as const },
  receipt: { icon: Receipt, color: 'text-blue-500', bg: 'bg-blue-50', labelKey: 'history.receiptType' as const },
  general: { icon: Languages, color: 'text-purple-500', bg: 'bg-purple-50', labelKey: 'history.translationType' as const },
};

const ScanHistory = ({ onLoadScan }: ScanHistoryProps) => {
  const t = useT();
  const [scans, setScans] = useState<SavedScan[]>([]);

  const [filter, setFilter] = useState<'all' | 'menu' | 'receipt' | 'general'>('all');

  useEffect(() => {
    getScanHistory().then(setScans);
  }, []);

  if (scans.length === 0) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScan(id).then(setScans);
  };

  const getSubtitle = (scan: SavedScan) => {
    const mode = scan.scanMode || 'menu';
    if (mode === 'menu') return `${scan.items.length} dishes`;
    if (mode === 'receipt') return scan.receiptData ? `${scan.receiptData.items.length} items · ${scan.receiptData.totalAmount}` : 'Receipt';
    if (mode === 'general') return scan.generalData ? `${scan.generalData.items.length} items` : 'Translation';
    return '';
  };

  const filtered = filter === 'all' ? scans : scans.filter(s => (s.scanMode || 'menu') === filter);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500 flex items-center gap-1">
          <Clock size={14} /> {t('history.recent')}
        </h3>
        <div className="flex gap-1">
          {([
            ['all', t('history.all')],
            ['menu', t('history.menuType')],
            ['receipt', t('history.receiptType')],
            ['general', t('history.translationType')],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                filter === key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {filtered.slice(0, 8).map(scan => {
          const mode = scan.scanMode || 'menu';
          const cfg = modeIcons[mode];
          const Icon = cfg.icon;

          return (
            <button
              key={scan.id}
              onClick={() => onLoadScan(scan)}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-colors text-left"
            >
              {/* Thumbnail or mode icon */}
              {scan.images[0] ? (
                <div className="relative shrink-0">
                  <img src={scan.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${cfg.bg} flex items-center justify-center`}>
                    <Icon size={10} className={cfg.color} />
                  </span>
                </div>
              ) : (
                <div className={`w-12 h-12 rounded-lg ${cfg.bg} shrink-0 flex items-center justify-center`}>
                  <Icon size={20} className={cfg.color} />
                </div>
              )}
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{scan.restaurantName}</p>
                <p className="text-xs text-gray-400">
                  <span className={`${cfg.color} font-medium`}>{t(cfg.labelKey)}</span> · {getSubtitle(scan)} · {new Date(scan.timestamp).toLocaleDateString()}
                </p>
              </div>
              {/* Actions */}
              <button
                onClick={(e) => handleDelete(scan.id, e)}
                className="shrink-0 p-1.5 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ScanHistory;
