import { useRef } from 'react';
import { Camera, Image as ImageIcon, X, UtensilsCrossed, Receipt, Languages } from 'lucide-react';
import { useT } from '../i18n/context';
import type { ScanMode } from '../types';

interface CameraCaptureProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  scanMode: ScanMode;
}

const CameraCapture = ({ images, onImagesChange, onAnalyze, isAnalyzing, scanMode }: CameraCaptureProps) => {
  const t = useT();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const modeConfig = {
    menu: { icon: UtensilsCrossed, label: t('mode.menu'), desc: t('mode.menu.desc'), color: 'bg-orange-500', colorLight: 'bg-orange-100 text-orange-600', shadow: 'shadow-orange-200', iconColor: 'text-orange-500' },
    receipt: { icon: Receipt, label: t('mode.receipt'), desc: t('mode.receipt.desc'), color: 'bg-blue-500', colorLight: 'bg-blue-100 text-blue-600', shadow: 'shadow-blue-200', iconColor: 'text-blue-500' },
    general: { icon: Languages, label: t('mode.general'), desc: t('mode.general.desc'), color: 'bg-slate-700', colorLight: 'bg-slate-100 text-slate-600', shadow: 'shadow-slate-300', iconColor: 'text-slate-600' },
  };

  const currentMode = modeConfig[scanMode as keyof typeof modeConfig] || modeConfig.general;

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
      {/* No images: show camera/album buttons */}
      {images.length === 0 && !isAnalyzing && (
        <div className="flex gap-3 justify-center py-6">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 w-32 py-5 bg-white border-2 border-gray-200 rounded-2xl hover:border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <Camera size={32} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-700">拍照</span>
          </button>
          <button
            onClick={() => albumInputRef.current?.click()}
            className="flex flex-col items-center gap-2 w-32 py-5 bg-white border-2 border-gray-200 rounded-2xl hover:border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <ImageIcon size={32} className="text-blue-500" />
            <span className="text-sm font-bold text-gray-700">相簿</span>
          </button>
        </div>
      )}

      {/* Has image */}
      {images.length > 0 && (
        isAnalyzing ? (
          <div className="rounded-xl overflow-hidden">
            <img src={images[0]} alt="" className="w-full object-cover max-h-[35vh]" />
            {images.length > 1 && (
              <p className="text-center text-sm text-gray-500 mt-1">翻譯中... {images.length} 頁菜單</p>
            )}
          </div>
        ) : (
          <div className="flex gap-2 justify-center pb-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-orange-200">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <span className="absolute top-0.5 left-1 text-[10px] font-bold text-white bg-black/50 px-1 rounded">{i + 1}</span>
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {scanMode === 'menu' && images.length < 4 && (
              <button
                onClick={() => albumInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-orange-300 hover:text-orange-400"
              >
                <span className="text-xl">+</span>
                <span className="text-[10px]">加頁</span>
              </button>
            )}
          </div>
        )
      )}

      {/* Analyze button */}
      {images.length > 0 && (
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className={`w-full py-3 ${currentMode.color} disabled:opacity-50 text-white rounded-xl font-bold text-lg shadow-lg ${currentMode.shadow} transition-colors flex items-center justify-center gap-2`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('camera.analyze')}
            </>
          ) : (
            <>{currentMode.label} ({images.length} 張照片)</>
          )}
        </button>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default CameraCapture;
