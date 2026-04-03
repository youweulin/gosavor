import { X, Key, MapPin } from 'lucide-react';

interface UsageLimitModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  errorType: 'limit' | 'gps' | 'no_key';
  message?: string;
  used?: number;
  limit?: number;
}

const UsageLimitModal = ({ isVisible, onClose, onOpenSettings, errorType, message }: UsageLimitModalProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`p-5 text-center ${
          errorType === 'limit' ? 'bg-gradient-to-r from-orange-500 to-amber-500' :
          errorType === 'gps' ? 'bg-gradient-to-r from-blue-500 to-sky-500' :
          'bg-gradient-to-r from-gray-600 to-gray-700'
        }`}>
          <button onClick={onClose} className="absolute top-3 right-3 text-white/60 hover:text-white">
            <X size={20} />
          </button>
          <p className="text-4xl mb-2">
            {errorType === 'limit' ? '⏰' : errorType === 'gps' ? '📍' : '🔑'}
          </p>
          <h2 className="text-lg font-bold text-white">
            {errorType === 'limit' ? '今日額度已用完' :
             errorType === 'gps' ? '限定日本境內' :
             '需要 API Key'}
          </h2>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorType === 'limit' && (
            <>
              <p className="text-sm text-gray-600 text-center">
                {message || '今日免費體驗額度（1次）已用完'}
              </p>
              <p className="text-xs text-gray-400 text-center">明天 00:00 重置</p>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600 text-center mb-1">
                  開通贊助版 → 自帶 API Key → 無限翻譯
                </p>
                <p className="text-xs text-orange-500 text-center mb-3">
                  封測優惠 $299（7/1 前限定，之後 $599）
                </p>
                <button
                  onClick={onOpenSettings}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Key size={16} /> 設定 API Key
                </button>
              </div>
            </>
          )}

          {errorType === 'gps' && (
            <>
              <p className="text-sm text-gray-600 text-center">
                系統翻譯服務僅限日本境內使用。
              </p>
              <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
                <MapPin size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  到日本後可免費體驗 1 次/天！或開通贊助版自帶 API Key，不受地區限制。
                </p>
              </div>
              <button
                onClick={onOpenSettings}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Key size={16} /> 設定 API Key
              </button>
            </>
          )}

          {errorType === 'no_key' && (
            <>
              <p className="text-sm text-gray-600 text-center">
                需要 Gemini API Key 才能使用 AI 翻譯功能。
              </p>
              <button
                onClick={onOpenSettings}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Key size={16} /> 設定 API Key
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsageLimitModal;
