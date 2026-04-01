import { useRef } from 'react';
import { Camera, ImagePlus, X, UtensilsCrossed, Receipt, Languages } from 'lucide-react';
import { useT } from '../i18n/context';
import type { ScanMode } from '../types';

interface CameraCaptureProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  scanMode: ScanMode;
  onScanModeChange: (mode: ScanMode) => void;
}

const CameraCapture = ({ images, onImagesChange, onAnalyze, isAnalyzing, scanMode, onScanModeChange }: CameraCaptureProps) => {
  const t = useT();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const modeConfig = {
    menu: { icon: UtensilsCrossed, label: t('mode.menu'), desc: t('mode.menu.desc'), color: 'bg-orange-500', colorLight: 'bg-orange-100 text-orange-600', shadow: 'shadow-orange-200', iconColor: 'text-orange-500' },
    receipt: { icon: Receipt, label: t('mode.receipt'), desc: t('mode.receipt.desc'), color: 'bg-blue-500', colorLight: 'bg-blue-100 text-blue-600', shadow: 'shadow-blue-200', iconColor: 'text-blue-500' },
    general: { icon: Languages, label: t('mode.general'), desc: t('mode.general.desc'), color: 'bg-slate-700', colorLight: 'bg-slate-100 text-slate-600', shadow: 'shadow-slate-300', iconColor: 'text-slate-600' },
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          onImagesChange([...images, ev.target.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Image Preview */}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <div key={i} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-orange-200">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
          {/* Add more */}
          <button
            onClick={() => uploadInputRef.current?.click()}
            className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-colors"
          >
            <ImagePlus size={24} />
          </button>
        </div>
      )}

      {/* Mode description (no buttons — mode is selected via bottom tab bar) */}
      {images.length === 0 && (
        <div className="flex flex-col items-center py-8">
          <p className="text-gray-400 text-sm text-center">
            {modeConfig[scanMode].desc}
          </p>
          <p className="text-gray-300 text-xs mt-1">
            點下方 📷 開始掃描
          </p>
        </div>
      )}

      {/* Analyze button */}
      {images.length > 0 && (
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className={`w-full py-3 ${modeConfig[scanMode].color} disabled:opacity-50 text-white rounded-xl font-bold text-lg shadow-lg ${modeConfig[scanMode].shadow} transition-colors flex items-center justify-center gap-2`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('camera.analyze')}
            </>
          ) : (
            <>{modeConfig[scanMode].label} ({images.length} 張照片)</>
          )}
        </button>
      )}

      {/* Single input — iOS shows "Take Photo or Choose from Library" */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default CameraCapture;
