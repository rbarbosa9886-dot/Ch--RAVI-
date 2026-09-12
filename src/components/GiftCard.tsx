import React from 'react';
import { Gift as GiftIcon, Heart, Check, Sparkles, Tag } from 'lucide-react';
import { Gift } from '../types.ts';
import { CATEGORIES } from './CategoryFilter.tsx';

interface GiftCardProps {
  gift: Gift;
  onSelect: (gift: Gift) => void;
}

export const GiftCard: React.FC<GiftCardProps> = ({ gift, onSelect }) => {
  const isDepleted = gift.availableQuantity <= 0;
  const categoryInfo = CATEGORIES.find(c => c.id === gift.category);

  return (
    <div
      id={`gift-card-${gift.id}`}
      className={`delicate-card rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${
        isDepleted
          ? 'opacity-70 bg-slate-50/70 border-slate-200'
          : 'hover:border-sky-300 hover:shadow-md'
      }`}
    >
      {/* Image / Header Thumbnail */}
      <div className="relative h-44 sm:h-48 w-full bg-slate-100 overflow-hidden">
        <img
          src={gift.imageUrl}
          alt={gift.name}
          className={`w-full h-full object-cover transition-transform duration-300 ${
            !isDepleted ? 'hover:scale-105' : 'grayscale-30'
          }`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback to baby-themed pattern if remote image fails
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Category Pill */}
        <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-100 shadow-xs flex items-center gap-1 text-[11px] font-semibold text-slate-700">
          <span>{categoryInfo?.icon || '🎁'}</span>
          <span>{categoryInfo?.label || gift.category}</span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-2.5 right-2.5">
          {isDepleted ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50/95 border border-rose-200 text-rose-700 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              ESGOTADO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/95 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {gift.availableQuantity} {gift.availableQuantity === 1 ? 'disponível' : 'disponíveis'}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Suggested Brand / Details if applicable */}
          {gift.suggestedBrand && (
            <div className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-md w-fit mb-2 font-medium border border-amber-200/50">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="truncate max-w-[200px]">{gift.suggestedBrand}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="font-serif-title font-bold text-slate-800 text-base sm:text-lg mb-1 leading-snug">
            {gift.name}
          </h3>

          {/* Description */}
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed line-clamp-3 mb-4">
            {gift.description}
          </p>
        </div>

        {/* Card Footer: Stock & Action Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="text-xs">
            {isDepleted ? (
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-slate-400" />
                Todas as unidades reservadas
              </span>
            ) : (
              <span className="text-slate-500">
                Total: <strong>{gift.totalQuantity}</strong> {gift.totalQuantity === 1 ? 'unidade' : 'unidades'}
              </span>
            )}
          </div>

          <button
            id={`btn-choose-${gift.id}`}
            onClick={() => onSelect(gift)}
            disabled={isDepleted}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-1.5 ${
              isDepleted
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-[#1E3A8A] hover:bg-[#182f70] text-white shadow-xs hover:shadow active:scale-95 cursor-pointer ring-1 ring-amber-200/50'
            }`}
          >
            {isDepleted ? (
              <span>ESGOTADO</span>
            ) : (
              <>
                <GiftIcon className="w-3.5 h-3.5" />
                <span>ESCOLHER</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
