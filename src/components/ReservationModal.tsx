import React, { useState, useEffect } from 'react';
import { X, Gift as GiftIcon, Heart, Sparkles, AlertCircle, Loader2, Plus, Minus } from 'lucide-react';
import { Gift } from '../types.ts';

interface ReservationModalProps {
  gift: Gift | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (giftId: string, guestName: string, message: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  gift,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset quantity and errors when modal opens or gift changes
  useEffect(() => {
    if (isOpen && gift) {
      setQuantity(1);
      setErrorMessage(null);
    }
  }, [isOpen, gift?.id]);

  if (!isOpen || !gift) return null;

  const maxAvailable = Math.max(1, gift.availableQuantity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setErrorMessage('Por favor, informe o seu nome para sabermos quem deu esse presente com carinho!');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await onConfirm(gift.id, guestName.trim(), message.trim(), quantity);
      if (!result.success) {
        setErrorMessage(result.error || 'Não foi possível reservar este presente. Tente novamente.');
      } else {
        // Success handled by parent (switches to confirmation screen)
        setGuestName('');
        setMessage('');
        setQuantity(1);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ocorreu um erro de conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden transition-all max-h-[95vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Subtle decorative celestial background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full pointer-events-none -z-0 opacity-70" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors z-10 cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-5">
            {gift.imageUrl ? (
              <div className="w-16 h-16 mx-auto mb-2 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs">
                <img
                  src={gift.imageUrl}
                  alt={gift.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-sky-100/80 text-[#1E3A8A] flex items-center justify-center border border-sky-200">
                <GiftIcon className="w-6 h-6" />
              </div>
            )}
            <p className="text-xs uppercase tracking-widest text-[#1E3A8A] font-semibold">
              Você escolheu:
            </p>
            <h2 className="font-serif-title text-xl font-bold text-slate-900 mt-1">
              🎁 {gift.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-xs mx-auto">
              {gift.description}
            </p>
          </div>

          {/* Error Alert if any (e.g. race condition / double reservation) */}
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Aviso de Reserva</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quantity Picker Section */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-800">
                    Quantas unidades deseja presentear?
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {gift.availableQuantity > 1
                      ? `Disponível para escolha: até ${gift.availableQuantity} unidades`
                      : 'Última unidade disponível deste item'}
                  </p>
                </div>

                {gift.availableQuantity > 1 && (
                  <span className="text-[11px] font-semibold text-sky-800 bg-sky-100/80 px-2.5 py-0.5 rounded-full border border-sky-200">
                    {quantity} de {gift.availableQuantity}
                  </span>
                )}
              </div>

              {gift.availableQuantity > 1 ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                  {/* Stepper control */}
                  <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
                    <button
                      type="button"
                      disabled={isSubmitting || quantity <= 1}
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="w-12 text-center text-base font-bold text-slate-800 select-none">
                      {quantity}
                    </span>

                    <button
                      type="button"
                      disabled={isSubmitting || quantity >= maxAvailable}
                      onClick={() => setQuantity(prev => Math.min(maxAvailable, prev + 1))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick button to select all available units */}
                  <div className="flex items-center gap-1.5">
                    {quantity < maxAvailable && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setQuantity(maxAvailable)}
                        className="text-[11px] font-semibold text-[#1E3A8A] hover:text-[#182f70] bg-white hover:bg-sky-50 px-2.5 py-2 rounded-xl border border-sky-200 transition-colors cursor-pointer shadow-2xs"
                      >
                        Presentear todas ({maxAvailable})
                      </button>
                    )}
                    {quantity > 1 && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setQuantity(1)}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-700 px-2 py-1 transition-colors cursor-pointer"
                      >
                        Apenas 1
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1 text-xs text-amber-800 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>1 unidade selecionada (última unidade disponível na lista)</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="guestName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Seu nome <span className="text-rose-500">*</span>
              </label>
              <input
                id="guestName"
                type="text"
                required
                disabled={isSubmitting}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ex: Titia Ana Paula, Vovô Carlos..."
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Os pais verão seu nome na lista para agradecer com carinho.
              </p>
            </div>

            <div>
              <label htmlFor="guestMessage" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mensagem para o Ravi <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                id="guestMessage"
                rows={3}
                disabled={isSubmitting}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Deixe uma mensagem cheia de amor para o pequeno explorador..."
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all resize-none"
              />
            </div>

            {/* Summary Badge */}
            <div className="bg-sky-50/70 rounded-xl p-3 border border-sky-100 flex items-center gap-2.5 text-xs text-sky-900">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Ao confirmar, <strong>{quantity} {quantity === 1 ? 'unidade' : 'unidades'}</strong> deste presente {quantity === 1 ? 'será reservada' : 'serão reservadas'} com carinho em seu nome.
              </span>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                id="confirm-reservation-btn"
                type="submit"
                disabled={isSubmitting || !guestName.trim()}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSubmitting || !guestName.trim()
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-[#1E3A8A] hover:bg-[#182f70] active:scale-[0.98]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando reserva...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 text-rose-300 fill-rose-300" />
                    <span>CONFIRMAR {quantity > 1 ? `${quantity} UNIDADES` : 'PRESENTE'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                Escolher outro presente
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
