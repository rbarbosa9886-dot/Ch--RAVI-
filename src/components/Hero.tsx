import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Sparkles, ChevronDown, Check, Copy, ExternalLink } from 'lucide-react';
import { EventDetails } from '../types.ts';

interface HeroProps {
  eventDetails: EventDetails;
  onScrollToGifts: () => void;
}

export const Hero: React.FC<HeroProps> = ({ eventDetails, onScrollToGifts }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(`${eventDetails.eventLocation} - ${eventDetails.eventAddress}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    eventDetails.eventAddress || eventDetails.eventLocation
  )}`;

  return (
    <section className="relative overflow-hidden pt-6 pb-12 px-4 sm:px-6">
      {/* Subtle celestial decorative background elements */}
      <div className="absolute top-3 left-6 text-amber-300/40 pointer-events-none select-none text-xl animate-pulse-subtle">
        ✦
      </div>
      <div className="absolute top-16 right-10 text-sky-200/60 pointer-events-none select-none text-2xl">
        ★
      </div>
      <div className="absolute top-32 left-3 text-slate-300/40 pointer-events-none select-none text-sm">
        ✨
      </div>
      <div className="absolute top-48 right-6 text-amber-200/50 pointer-events-none select-none text-base">
        ✦
      </div>

      <div className="max-w-xl mx-auto text-center relative z-10">
        {/* Subtle Theme Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-100/90 text-sky-800 text-xs font-semibold tracking-wider uppercase mb-4 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Chá de Fraldas • Pequeno Explorador</span>
        </div>

        {/* Official Logo Centerpiece */}
        <div className="relative mx-auto w-44 h-44 sm:w-52 sm:h-52 mb-4">
          {/* Subtle glowing aura */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-200/50 via-amber-200/40 to-sky-100/30 blur-md transform scale-105" />
          <div className="relative w-full h-full rounded-full overflow-hidden shadow-lg border-4 border-white ring-2 ring-amber-200/90 bg-white flex items-center justify-center transition-transform duration-300 hover:scale-[1.02]">
            <img
              src="/ravi-logo.jpg"
              alt="Logo Oficial Chá do Ravi - Pequeno Explorador"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Grand Title with RAVI prominent */}
        <div className="mb-2">
          <h2 className="font-cinzel text-xs uppercase tracking-[0.25em] text-slate-500 font-semibold mb-0.5">
            BEM-VINDO AO
          </h2>
          <h1 className="text-3xl sm:text-4xl font-serif-title font-bold text-[#1E3A8A] tracking-wide leading-tight">
            CHÁ DO <span className="text-[#1E3A8A] font-extrabold relative inline-block">
              RAVI
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-amber-300/70 via-sky-300/70 to-transparent rounded-full" />
            </span>
          </h1>
        </div>

        {/* Emotional Quote */}
        <p className="text-slate-600 italic font-serif-title text-base sm:text-lg mb-6 text-balance">
          “{eventDetails.subtitle || 'Pequenos detalhes, grandes histórias.'}”
        </p>

        {/* Invitation Call to Action text */}
        <p className="text-slate-700 text-sm sm:text-base font-normal mb-5 max-w-md mx-auto leading-relaxed">
          {eventDetails.introText || 'Escolha um presente para o Ravi e faça parte desse momento especial. 💙'}
        </p>

        {/* Main CTA Button */}
        <button
          id="hero-choose-gift-btn"
          onClick={onScrollToGifts}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1E3A8A] hover:bg-[#1e3470] text-white font-semibold text-base rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer ring-2 ring-amber-200/40"
        >
          <span>ESCOLHER UM PRESENTE</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>

        {/* Event Info Card - In highlight and elegant style */}
        <div className="mt-8 bg-white/90 backdrop-blur-xs rounded-2xl p-5 border border-slate-200 shadow-sm text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1E3A8A] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Detalhes do Evento
            </span>
            <span className="text-[11px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-md border border-amber-200/70">
              Presencial
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
            {/* Date */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Data</p>
                <p className="font-semibold text-slate-800">{eventDetails.eventDate}</p>
              </div>
            </div>

            {/* Time */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Horário</p>
                <p className="font-semibold text-slate-800">{eventDetails.eventTime}</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Local</p>
                <p className="font-semibold text-slate-800">{eventDetails.eventLocation}</p>
                <p className="text-xs text-slate-500 mt-0.5">{eventDetails.eventAddress}</p>

                {/* Quick actions for location */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    onClick={handleCopyAddress}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Endereço copiado!' : 'Copiar endereço'}</span>
                  </button>

                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#1E3A8A] hover:underline bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver no Mapa</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
