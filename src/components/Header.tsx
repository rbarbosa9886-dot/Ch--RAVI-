import React from 'react';
import { Sparkles, Lock, Share2, Heart } from 'lucide-react';

interface HeaderProps {
  onOpenAdmin: () => void;
  isAdminLoggedIn: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAdmin, isAdminLoggedIn }) => {
  const handleShare = () => {
    const text = 'Venha comemorar com a gente no Chá de Fraldas do Ravi! Veja a lista de presentes online: ' + window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Chá do Ravi — Pequeno Explorador',
        text: text,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Link copiado para a área de transferência! Envie pelo WhatsApp aos convidados. 💙');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-xs border-2 border-amber-200/90 bg-white ring-2 ring-sky-100/70 shrink-0 flex items-center justify-center">
            <img
              src="/ravi-logo.jpg"
              alt="Logo Chá do Ravi"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-cinzel text-xs tracking-widest text-[#1E3A8A] font-bold">CHÁ DO</span>
              <span className="font-serif-title font-bold text-base text-[#1E3A8A] tracking-wider">RAVI</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">Pequeno Explorador 🧭</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Share on WhatsApp */}
          <button
            id="share-whatsapp-btn"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-full border border-emerald-200 transition-colors shadow-xs active:scale-95 cursor-pointer"
            title="Compartilhar convite no WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>

          {/* Admin button for parents */}
          <button
            id="admin-access-btn"
            onClick={onOpenAdmin}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all active:scale-95 cursor-pointer ${
              isAdminLoggedIn
                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                : 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200'
            }`}
            title="Acesso dos Pais / Administrador"
          >
            <Lock className={`w-3.5 h-3.5 ${isAdminLoggedIn ? 'text-amber-700' : 'text-slate-500'}`} />
            <span className="text-xs">{isAdminLoggedIn ? 'Painel Pais' : 'Área Pais'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
