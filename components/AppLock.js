'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Delete, KeyRound, AlertCircle } from 'lucide-react';
import { verifyPin } from '@/lib/security';

export default function AppLock({ pinHash, onUnlock, partner1 = 'Alle', partner2 = 'Kelly' }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const MAX_ATTEMPTS = 5;

  // Contagem regressiva automática quando bloqueado
  useEffect(() => {
    if (!isLockedOut) return;
    const t = setTimeout(() => setIsLockedOut(false), 30_000);
    return () => clearTimeout(t);
  }, [isLockedOut]);

  const handleInputDigit = useCallback((digit) => {
    if (isSuccess || isLockedOut) return;
    setError(false);
    setErrorMsg('');
    setPin(prev => (prev.length < 8 ? prev + digit : prev));
  }, [isSuccess, isLockedOut]);

  const handleDelete = useCallback(() => {
    if (isSuccess || isLockedOut) return;
    setError(false);
    setErrorMsg('');
    setPin(prev => prev.slice(0, -1));
  }, [isSuccess, isLockedOut]);

  const handleClear = useCallback(() => {
    if (isSuccess || isLockedOut) return;
    setError(false);
    setErrorMsg('');
    setPin('');
  }, [isSuccess, isLockedOut]);

  const handleVerify = useCallback(async (pinToTest) => {
    const candidate = pinToTest || pin;
    if (!candidate) {
      setError(true);
      setErrorMsg('Digite o PIN de acesso.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (isLockedOut) return;

    const isValid = await verifyPin(candidate, pinHash);
    if (isValid) {
      setFailedAttempts(0);
      setIsSuccess(true);
      setError(false);
      setTimeout(() => {
        onUnlock();
      }, 350);
    } else {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
      if (attempts >= MAX_ATTEMPTS) {
        setIsLockedOut(true);
        setErrorMsg(`Muitas tentativas. Aguarde 30 segundos.`);
      } else {
        setErrorMsg(`PIN incorreto. ${MAX_ATTEMPTS - attempts} tentativa(s) restante(s).`);
      }
    }
  }, [pin, pinHash, onUnlock, failedAttempts, isLockedOut]);

  // Captura eventos do teclado físico
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        handleInputDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      } else if (e.key === 'Enter') {
        handleVerify();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInputDigit, handleDelete, handleClear, handleVerify]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Tela de bloqueio do aplicativo" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f1d]/95 backdrop-blur-xl p-4 animate-fade-in select-none">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`relative w-full max-w-sm rounded-3xl border ${
          error
            ? 'border-red-500/50 bg-red-950/10 shadow-2xl shadow-red-500/10'
            : isSuccess
            ? 'border-emerald-500/60 bg-emerald-950/10 shadow-2xl shadow-emerald-500/20'
            : 'border-slate-800 bg-[#141d33]/90 shadow-2xl shadow-black/60'
        } p-6 sm:p-8 backdrop-blur-2xl transition-all duration-300 ${shake ? 'animate-shake' : ''}`}
      >
        {/* Cabeçalho do App Lock */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/30">
            <div className="h-full w-full bg-[#131b2e] rounded-[14px] flex items-center justify-center text-white">
              {isSuccess ? (
                <Unlock className="h-8 w-8 text-emerald-400 animate-scale-in" />
              ) : (
                <Lock className="h-8 w-8 text-indigo-400" />
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              Minhas Finanças & Casa
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Controle da Casa ({partner1}, {partner2} & Filhos)
            </p>
          </div>
        </div>

        {/* Indicador de Digitação (PIN Dots / Input) */}
        <div className="my-6 space-y-2">
          <div className="flex items-center justify-center gap-3 h-12">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full transition-all duration-200 ${
                    isSuccess
                      ? 'bg-emerald-400 scale-110 shadow-lg shadow-emerald-400/50'
                      : error
                      ? 'bg-red-400 scale-110 shadow-lg shadow-red-400/50'
                      : isFilled
                      ? 'bg-indigo-400 scale-125 shadow-lg shadow-indigo-400/50'
                      : 'bg-slate-700/80 border border-slate-600'
                  }`}
                />
              );
            })}
          </div>

          {/* Mensagem de Erro ou Dica */}
          <div className="h-5 text-center">
            {error ? (
              <p className="text-xs font-bold text-red-400 flex items-center justify-center gap-1 animate-fade-in">
                <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
              </p>
            ) : isSuccess ? (
              <p className="text-xs font-bold text-emerald-400 animate-fade-in">
                Desbloqueado com sucesso!
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Digite o PIN de acesso de 4 a 6 dígitos
              </p>
            )}
          </div>
        </div>

        {/* Teclado Numérico Virtual */}
        <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLockedOut}
              onClick={() => handleInputDigit(String(num))}
              className="h-14 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 active:bg-indigo-600 text-xl font-black text-white transition-all shadow-md active:scale-95 border border-slate-700/50 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {num}
            </button>
          ))}

          {/* Botão Limpar */}
          <button
            type="button"
            disabled={isLockedOut}
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-800/30 hover:bg-slate-800/60 active:bg-slate-700 text-xs font-black uppercase text-slate-400 hover:text-white transition-all border border-slate-800 flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Limpar tudo"
          >
            Limpar
          </button>

          {/* Dígito 0 */}
          <button
            type="button"
            disabled={isLockedOut}
            onClick={() => handleInputDigit('0')}
            className="h-14 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 active:bg-indigo-600 text-xl font-black text-white transition-all shadow-md active:scale-95 border border-slate-700/50 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            0
          </button>

          {/* Botão Apagar (Backspace) */}
          <button
            type="button"
            disabled={isLockedOut}
            onClick={handleDelete}
            aria-label="Apagar último dígito"
            className="h-14 rounded-2xl bg-slate-800/30 hover:bg-slate-800/60 active:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-slate-800 flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Apagar último dígito"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>

        {/* Botão Desbloquear / Confirmar */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={pin.length === 0 || isSuccess || isLockedOut}
            className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              pin.length >= 4 && !isLockedOut
                ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-indigo-500/25'
                : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-70'
            }`}
          >
            <KeyRound className="h-4 w-4" /> {isLockedOut ? 'Aguarde...' : 'Desbloquear'}
          </button>
        </div>
      </div>
    </div>
  );
}
