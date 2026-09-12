import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { GiftCategory } from '../types.ts';

export interface CategoryOption {
  id: GiftCategory | 'todos';
  label: string;
  icon: string;
}

export const CATEGORIES: CategoryOption[] = [
  { id: 'todos', label: 'Todos', icon: '🌟' },
  { id: 'fraldas', label: 'Fraldas', icon: '🍼' },
  { id: 'higiene', label: 'Higiene', icon: '🧴' },
  { id: 'roupinhas', label: 'Roupinhas', icon: '👕' },
  { id: 'banho', label: 'Banho', icon: '🛁' },
  { id: 'quarto', label: 'Quarto', icon: '🛏️' },
  { id: 'outros', label: 'Outros', icon: '🎁' },
];

interface CategoryFilterProps {
  selectedCategory: GiftCategory | 'todos';
  onSelectCategory: (cat: GiftCategory | 'todos') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlyAvailable: boolean;
  onToggleOnlyAvailable: () => void;
  itemCount: number;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onlyAvailable,
  onToggleOnlyAvailable,
  itemCount,
}) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Search Input & Quick Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        {/* Search bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar presente (ex: fralda M, pomada, lenço)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9.5 pr-8 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Only Available Toggle */}
        <button
          onClick={onToggleOnlyAvailable}
          className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
            onlyAvailable
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${onlyAvailable ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'}`} />
          <span>Apenas Disponíveis</span>
        </button>
      </div>

      {/* Category Horizontal Scroll Pills */}
      <div className="overflow-x-auto pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none flex items-center gap-2">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              id={`cat-filter-${cat.id}`}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                isSelected
                  ? 'bg-[#1E3A8A] text-white shadow-xs font-semibold ring-2 ring-sky-200/50'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <span className="text-base">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Results summary notice */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Exibindo <strong>{itemCount}</strong> {itemCount === 1 ? 'presente' : 'presentes'}
          {selectedCategory !== 'todos' && ` em ${CATEGORIES.find(c => c.id === selectedCategory)?.label}`}
          {searchQuery && ` com "${searchQuery}"`}
        </span>
        {(searchQuery || selectedCategory !== 'todos' || onlyAvailable) && (
          <button
            onClick={() => {
              onSearchChange('');
              onSelectCategory('todos');
              if (onlyAvailable) onToggleOnlyAvailable();
            }}
            className="text-[#1E3A8A] hover:underline font-medium cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
};
