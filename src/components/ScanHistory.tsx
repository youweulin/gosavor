import { useState, useEffect } from 'react';
import { Clock, Trash2, ChevronRight } from 'lucide-react';
import type { SavedScan } from '../types';
import { getScanHistory, deleteScan } from '../services/storage';

interface ScanHistoryProps {
  onLoadScan: (scan: SavedScan) => void;
}

const ScanHistory = ({ onLoadScan }: ScanHistoryProps) => {
  const [scans, setScans] = useState<SavedScan[]>([]);

  useEffect(() => {
    setScans(getScanHistory());
  }, []);

  if (scans.length === 0) return null;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScans(deleteScan(id));
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
        <Clock size={14} /> 最近掃描
      </h3>
      <div className="space-y-2">
        {scans.slice(0, 5).map(scan => (
          <button
            key={scan.id}
            onClick={() => onLoadScan(scan)}
            className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-colors text-left"
          >
            {/* Thumbnail */}
            {scan.images[0] ? (
              <img src={scan.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-xs">
                No img
              </div>
            )}
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{scan.restaurantName}</p>
              <p className="text-xs text-gray-400">
                {scan.items.length} dishes &middot; {new Date(scan.timestamp).toLocaleDateString()}
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
        ))}
      </div>
    </div>
  );
};

export default ScanHistory;
