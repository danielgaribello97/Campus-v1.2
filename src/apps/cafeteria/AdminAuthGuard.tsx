import React, { useState } from 'react';
import { CafeteriaApp } from './CafeteriaApp';
import { Lock, KeyRound, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ADMIN_PIN = '1234';

export const AdminAuthGuard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('campusbite_admin_authenticated') === 'true';
  });
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('campusbite_admin_authenticated', 'true');
      setIsAuthenticated(true);
      setError(null);
    } else {
      setError('PIN incorrecto. Inténtalo de nuevo.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 4) {
        if (nextPin === ADMIN_PIN) {
          sessionStorage.setItem('campusbite_admin_authenticated', 'true');
          setIsAuthenticated(true);
          setError(null);
        } else {
          setError('PIN incorrecto. Inténtalo de nuevo.');
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin('');
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('campusbite_admin_authenticated');
    setIsAuthenticated(false);
    setPin('');
  };

  if (isAuthenticated) {
    return <CafeteriaApp onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-sm bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative transition-transform ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* Top Back Link */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a CampusBite Estudiantes
        </button>

        {/* Security Badge */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">Acceso Cafetería (Staff)</h2>
          <p className="text-xs text-stone-400 mt-1">
            Área restringida para empleados y personal de cocina. Ingresa el PIN de seguridad.
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center items-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => {
            const hasDigit = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-10 h-12 rounded-xl flex items-center justify-center text-lg font-mono font-bold transition-all ${
                  hasDigit
                    ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400 shadow-xs'
                    : 'bg-stone-800 border border-stone-700 text-stone-500'
                }`}
              >
                {hasDigit ? '•' : ''}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad for touchscreens / tablets */}
        <div className="grid grid-cols-3 gap-2.5 mb-5 select-none">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-12 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-amber-600 active:text-white text-white font-bold text-lg transition flex items-center justify-center shadow-xs"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-12 rounded-2xl bg-stone-800/50 hover:bg-stone-800 text-stone-400 font-semibold text-xs transition flex items-center justify-center"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-12 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-amber-600 active:text-white text-white font-bold text-lg transition flex items-center justify-center shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-2xl bg-stone-800/50 hover:bg-stone-800 text-stone-400 font-semibold text-xs transition flex items-center justify-center"
          >
            ⌫
          </button>
        </div>

        {/* Helper Badge with PIN reminder for testing */}
        <div className="p-3 bg-stone-800/70 border border-stone-700/60 rounded-xl text-center">
          <p className="text-[11px] text-stone-400">
            <span className="font-semibold text-amber-400">PIN predeterminado de cocina:</span>{' '}
            <strong className="text-white font-mono tracking-widest">1234</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
