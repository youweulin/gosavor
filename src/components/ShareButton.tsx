import { useState } from 'react';
import { Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ShareButtonProps {
  targetId: string; // DOM element ID to capture
  title?: string;
}

const ShareButton = ({ targetId, title = 'GoSavor 翻譯結果' }: ShareButtonProps) => {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const target = document.getElementById(targetId);
      if (!target) { setSharing(false); return; }

      // Capture DOM to canvas
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2, // Retina quality
        useCORS: true,
        logging: false,
      });

      // Add watermark
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const watermarkHeight = 50;
        // Extend canvas for watermark
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height + watermarkHeight;
        const fctx = finalCanvas.getContext('2d')!;

        // Draw original
        fctx.drawImage(canvas, 0, 0);

        // Draw watermark bar
        fctx.fillStyle = '#f8f8f8';
        fctx.fillRect(0, canvas.height, canvas.width, watermarkHeight);

        // Watermark text
        fctx.fillStyle = '#999999';
        fctx.font = 'bold 20px -apple-system, sans-serif';
        fctx.textAlign = 'center';
        fctx.fillText('📱 Translated by GoSavor', canvas.width / 2, canvas.height + 32);

        // Convert to blob
        const blob = await new Promise<Blob>((resolve) => {
          finalCanvas.toBlob(b => resolve(b!), 'image/png');
        });

        // Share via Web Share API
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], 'gosavor-translation.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title,
              files: [file],
            });
            setSharing(false);
            return;
          }
        }

        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gosavor-translation.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn('[GoSavor] Share error:', err);
    }
    setSharing(false);
  };

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
    >
      <Share2 size={16} />
      {sharing ? '產生中...' : '分享'}
    </button>
  );
};

export default ShareButton;
