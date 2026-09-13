import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Gift, Heart, ArrowLeft, Share2, Sparkles, Calendar, MapPin } from 'lucide-react';
import { Reservation, EventDetails } from '../types.ts';

interface ConfirmationScreenProps {
  reservation: Reservation;
  eventDetails: EventDetails;
  onBackToList: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({
  reservation,
  eventDetails,
  onBackToList,
}) => {
  // Trigger delightful confetti burst when mounted
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38BDF8', '#1E3A8A', '#FDE047', '#BAE6FD', '#F59E0B']
      });
    } catch {
      // Ignore if confetti fails
    }
  }, []);

  const qty = reservation.quantity || 1;

  const handleShareConfirmation = () => {
    const qtyText = qty > 1 ? `${qty} unidades do presente` : 'o presente';
    const text = `Oi! Reservei ${qtyText} "${reservation.giftName}" para o Chá de Fraldas do Ravi! 💙👶 Mal posso esperar pelo evento!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-sky-100/60 to-transparent rounded-b-full pointer-events-none -z-0" />

        <div className="relative z-10">
          {/* Logo Badge */}
          <div className="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden shadow-md border-2 border-white ring-2 ring-amber-200/90 bg-white flex items-center justify-center animate-soft-float">
            <img
              src="/ravi-logo.jpg"
              alt="Chá do Ravi - Pequeno Explorador"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Presente Reservado com Sucesso!
          </div>

          <h1 className="font-serif-title text-2xl sm:text-3xl font-bold text-slate-900 mt-1 mb-2">
            Obrigado, <span className="text-[#1E3A8A]">{reservation.guestName}</span>!
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 font-normal">
            Seu carinho fará parte da chegada do Ravi. 💙
            <br />
            <span className="text-xs text-slate-400">
              Obrigado por fazer parte desse momento tão especial na vida da nossa família.
            </span>
          </p>

          {/* Reserved Item Card */}
          <div className="bg-[#FAF9F6] rounded-2xl p-4 border border-slate-200/90 text-left mb-6 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Item escolhido
              </p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                qty > 1 
                  ? 'bg-sky-100 text-sky-800 border border-sky-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {qty} {qty === 1 ? 'unidade' : 'unidades'}
              </span>
            </div>
            <p className="font-serif-title font-bold text-slate-800 text-base">
              {reservation.giftName}
            </p>
            {reservation.message && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/80">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  Sua mensagem:
                </p>
                <p className="text-xs text-slate-600 italic">
                  “{reservation.message}”
                </p>
              </div>
            )}
          </div>

          {/* Quick reminder of the event */}
          <div className="bg-sky-50/50 rounded-xl p-3 border border-sky-100 text-xs text-slate-600 mb-6 flex items-center justify-around gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span className="font-semibold text-slate-700">{eventDetails.eventDate}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span className="truncate max-w-[140px] text-slate-700">{eventDetails.eventLocation}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {/* Share on WhatsApp */}
            <button
              id="confirm-share-whatsapp-btn"
              onClick={handleShareConfirmation}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              <span>Avisar a Mamãe e o Papai no WhatsApp</span>
            </button>

            {/* Back to List */}
            <button
              id="back-to-list-btn"
              onClick={onBackToList}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>VOLTAR PARA A LISTA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
