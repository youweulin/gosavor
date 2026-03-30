import { useRef } from 'react';
import { Camera, ImagePlus, Upload, X, UtensilsCrossed, Receipt, Languages } from 'lucide-react';
import type { ScanMode } from '../types';

interface CameraCaptureProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  scanMode: ScanMode;
  onScanModeChange: (mode: ScanMode) => void;
}

const modeConfig = {
  menu: { icon: UtensilsCrossed, label: '菜單翻譯', desc: 'AI 翻譯並生成點餐介面' },
  receipt: { icon: Receipt, label: '收據翻譯', desc: '掃描收據，翻譯明細' },
  general: { icon: Languages, label: '萬用翻譯', desc: '籤詩、告示、標誌翻譯' },
};

const CameraCapture = ({ images, onImagesChange, onAnalyze, isAnalyzing, scanMode, onScanModeChange }: CameraCaptureProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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

      {/* Camera + Upload buttons */}
      {images.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-6">
          {/* Mode selector */}
          <div className="flex gap-2 w-full">
            {(Object.entries(modeConfig) as [ScanMode, typeof modeConfig.menu][]).map(([mode, cfg]) => {
              const Icon = cfg.icon;
              const active = scanMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => onScanModeChange(mode)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    active
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-orange-200'
                  }`}
                >
                  <Icon size={18} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
            <Camera size={28} className="text-orange-500" />
          </div>
          <p className="text-gray-500 text-sm text-center">
            {modeConfig[scanMode].desc}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-full font-bold text-base border border-gray-200 shadow-sm transition-colors flex items-center gap-2"
            >
              <Camera size={18} /> 拍照
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-full font-bold text-base border border-gray-200 shadow-sm transition-colors flex items-center gap-2"
            >
              <Upload size={18} /> 上傳照片
            </button>
          </div>
        </div>
      )}

      {/* Analyze button */}
      {images.length > 0 && (
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-200 transition-colors flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI 分析中...
            </>
          ) : (
            <>{modeConfig[scanMode].label} ({images.length} 張照片)</>
          )}
        </button>
      )}

      {/* Camera input (opens camera) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      {/* Upload input (opens file picker / gallery) */}
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
