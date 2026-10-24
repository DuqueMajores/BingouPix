import React, { useState } from 'react';
import { X, Key, Check, AlertCircle, Shield, User, HelpCircle } from 'lucide-react';
import { PixKey, PixKeyType } from '../types/bingo.ts';
import { formatPixKey } from '../utils/pix.ts';

interface PixKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPixKey?: PixKey;
  onSavePixKey: (key: PixKey) => Promise<boolean>;
}

export const PixKeyModal: React.FC<PixKeyModalProps> = ({
  isOpen,
  onClose,
  currentPixKey,
  onSavePixKey,
}) => {
  const [type, setType] = useState<PixKeyType>(currentPixKey?.type || 'cpf');
  const [key, setKey] = useState(currentPixKey?.key || '');
  const [name, setName] = useState(currentPixKey?.name || 'Jogador PixBingo');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setKey(formatPixKey(type, raw));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!key.trim()) {
      setErrorMsg('Por favor, informe uma chave Pix válida.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome completo do titular da conta.');
      return;
    }

    setLoading(true);
    const ok = await onSavePixKey({ type, key: key.trim(), name: name.trim() });
    setLoading(false);

    if (ok) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } else {
      setErrorMsg('Falha ao registrar a chave Pix. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
            <Key className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black font-['Outfit'] text-white">
              Cadastrar Chave Pix
            </h3>
            <p className="text-xs text-slate-400">
              Obrigatória para o repasse automático de 80% do prêmio via Mercado Pago.
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Ao completar uma linha ou cartela cheia, nosso sistema transfere o prêmio instantaneamente para esta chave Pix.
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Key Type Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Tipo de Chave Pix:
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'cpf', label: 'CPF' },
                { id: 'phone', label: 'Telefone' },
                { id: 'email', label: 'E-mail' },
                { id: 'random', label: 'Aleatória' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setType(item.id as PixKeyType);
                    setKey('');
                  }}
                  className={`py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === item.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Sua Chave Pix ({type.toUpperCase()}):
            </label>
            <input
              type={type === 'email' ? 'email' : 'text'}
              required
              value={key}
              onChange={handleKeyChange}
              placeholder={
                type === 'cpf'
                  ? '000.000.000-00'
                  : type === 'phone'
                  ? '(11) 98765-4321'
                  : type === 'email'
                  ? 'seu-email@exemplo.com'
                  : 'Chave EVP aleatória'
              }
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 transition-all outline-none"
            />
          </div>

          {/* Beneficiary Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Nome Completo do Titular:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva Sauro"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 transition-all outline-none"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="text-xs text-emerald-400 bg-emerald-500/15 p-2.5 rounded-lg border border-emerald-500/30 flex items-center justify-center gap-1.5 font-bold">
              <Check className="w-4 h-4" /> Chave Pix registrada com sucesso!
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? <span>Salvando...</span> : <span>Salvar Chave Pix</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
