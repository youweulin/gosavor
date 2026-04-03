import { useState, useRef } from 'react';
import { X, Send, Camera, Bug, Lightbulb, MessageSquare, Mail, Check } from 'lucide-react';
import { supabase, getCurrentUserId } from '../services/supabase';
import html2canvas from 'html2canvas';

type FeedbackType = 'bug' | 'feature' | 'general';

const TYPES: { id: FeedbackType; icon: typeof Bug; label: string; color: string }[] = [
  { id: 'bug', icon: Bug, label: 'Bug 回報', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  { id: 'feature', icon: Lightbulb, label: '功能建議', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  { id: 'general', icon: MessageSquare, label: '其他意見', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
];

const getDeviceInfo = () => ({
  platform: navigator.platform,
  userAgent: navigator.userAgent,
  screen: `${screen.width}x${screen.height}`,
  language: navigator.language,
  timestamp: new Date().toISOString(),
});

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal = ({ onClose }: FeedbackModalProps) => {
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const captureScreenshot = async () => {
    try {
      onClose(); // hide modal to capture clean screenshot
      await new Promise(r => setTimeout(r, 300));
      const canvas = await html2canvas(document.body, { scale: 1, useCORS: true });
      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      setScreenshot(base64);
      // modal will reopen via parent
    } catch {
      // fallback: let user pick from album
      fileRef.current?.click();
    }
  };

  const handleFileScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);

    try {
      const userId = getCurrentUserId();
      const deviceInfo = getDeviceInfo();

      const { error } = await supabase.from('feedback').insert({
        user_id: userId,
        type,
        message: message.trim(),
        screenshot: screenshot || null,
        device_info: deviceInfo,
        app_version: '0.8.8',
      });

      if (error) throw error;
      setSent(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('[Feedback] Error:', err);
      alert('送出失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  const handleEmail = () => {
    const deviceInfo = getDeviceInfo();
    const body = encodeURIComponent(
      `\n\n---\n裝置：${deviceInfo.platform}\n螢幕：${deviceInfo.screen}\n版本：v0.8.1\n時間：${deviceInfo.timestamp}`
    );
    window.open(`mailto:support@gosavor.com?subject=GoSavor 封測回饋 (${type})&body=${body}`);
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-gray-900 rounded-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <p className="text-white font-bold text-lg">感謝你的回饋！</p>
          <p className="text-gray-400 text-sm mt-1">我們會盡快處理</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold text-white text-lg">意見回饋</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Type Selector */}
          <div className="flex gap-2">
            {TYPES.map(t => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    active ? t.color : 'text-gray-500 bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={
              type === 'bug' ? '請描述遇到的問題，越詳細越好...' :
              type === 'feature' ? '你希望有什麼新功能？' :
              '任何想說的都可以...'
            }
            rows={4}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none resize-none text-sm"
          />

          {/* Screenshot */}
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={captureScreenshot}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 transition-colors"
              >
                <Camera size={14} />
                截圖附加
              </button>
              {screenshot && (
                <div className="flex items-center gap-2">
                  <img src={screenshot} alt="screenshot" className="h-10 rounded border border-gray-700" />
                  <button onClick={() => setScreenshot(null)} className="text-gray-500 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileScreenshot} />
          </div>

          {/* Device Info Preview */}
          <div className="px-3 py-2 bg-gray-800/50 rounded-lg">
            <p className="text-[10px] text-gray-500">
              自動附帶：裝置 {navigator.platform} · 螢幕 {screen.width}x{screen.height} · v0.8.1
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleEmail}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-300 hover:border-gray-600 transition-colors"
            >
              <Mail size={16} />
              Email
            </button>
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                message.trim() && !sending
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={16} />
              {sending ? '送出中...' : '送出回饋'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
