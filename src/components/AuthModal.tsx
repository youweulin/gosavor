import { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, KeyRound } from 'lucide-react';
import { useT } from '../i18n/context';
import { useAuthContext } from '../contexts/AuthContext';

const AuthModal = () => {
  const t = useT();
  const { signInWithEmail, signUpWithEmail, signInWithApple, resetPassword, isAuthenticated, isLoading } = useAuthContext();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Don't show if authenticated or still loading
  if (isAuthenticated || isLoading) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await resetPassword(email);
        setSuccess(t('auth.resetSent'));
      } else if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        setSuccess(t('auth.confirmEmail'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Apple Sign In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with Logo */}
        <div className="px-5 pt-6 pb-4 text-center">
          <div className="text-3xl font-bold text-orange-500 mb-1">GoSavor</div>
          <p className="text-sm text-gray-500">{t('auth.subtitle')}</p>
        </div>

        {/* Error / Success messages */}
        <div className="px-5">
          {error && (
            <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
          )}
          {success && (
            <div className="p-3 mb-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{success}</div>
          )}
        </div>

        {/* Apple Sign In */}
        {mode !== 'forgot' && (
          <div className="px-5 mb-3">
            <button
              onClick={handleAppleSignIn}
              disabled={loading}
              className="w-full py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              {t('auth.appleSignIn')}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{t('auth.or')}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </div>
        )}

        {/* Email form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
              <Mail size={14} /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                <Lock size={14} /> {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'login' ? (
              <><LogIn size={18} /> {t('auth.login')}</>
            ) : mode === 'register' ? (
              <><UserPlus size={18} /> {t('auth.register')}</>
            ) : (
              <><KeyRound size={18} /> {t('auth.sendReset')}</>
            )}
          </button>

          {/* Mode switching links */}
          <div className="space-y-2 pt-1">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
                >
                  {t('auth.forgotPassword')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className="w-full text-center text-sm text-orange-500 hover:underline"
                >
                  {t('auth.noAccount')}
                </button>
              </>
            )}
            {mode === 'register' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="w-full text-center text-sm text-orange-500 hover:underline"
              >
                {t('auth.hasAccount')}
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="w-full text-center text-sm text-orange-500 hover:underline"
              >
                {t('auth.backToLogin')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
