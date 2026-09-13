import React from 'react';
import { motion } from 'motion/react';
import { Gift, CheckCircle2, CircleDot, BarChart3, Compass } from 'lucide-react';
import { DashboardStats } from '../types.ts';

interface DashboardProgressProps {
  stats: DashboardStats;
}

export const DashboardProgress: React.FC<DashboardProgressProps> = ({ stats }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-gradient-to-br from-white to-[#F8FAFC] rounded-2xl p-5 border border-slate-200/90 shadow-xs mb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-[#1E3A8A]">
            <Compass className="w-4 h-4 text-[#1E3A8A]" />
          </div>
          <div>
            <h3 className="font-serif-title font-bold text-slate-800 text-base">
              Progresso do Chá do Ravi
            </h3>
            <p className="text-xs text-slate-500">Acompanhe a lista de presentes em tempo real</p>
          </div>
        </div>
        <span className="text-xs font-bold text-[#1E3A8A] bg-sky-50 border border-sky-200/60 px-2.5 py-1 rounded-full">
          {stats.completionPercentage}% preenchido
        </span>
      </div>

      {/* Progress Bar with smooth filling animation */}
      <div className="relative mb-5">
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70 p-0.5">
          <motion.div
            className="h-full bg-gradient-to-r from-[#38BDF8] via-[#1E3A8A] to-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, stats.completionPercentage))}%` }}
            transition={{ duration: 0.85, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>

      {/* 4 Key Metrics with staggered entrance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total de Presentes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-center"
        >
          <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-medium mb-1">
            <span>🎁</span>
            <span>Total</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-800">
            {stats.totalUnits} <span className="text-xs font-normal text-slate-500">itens</span>
          </p>
          <p className="text-[10px] text-slate-400">{stats.totalGifts} tipos</p>
        </motion.div>

        {/* Escolhidos */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100/80 text-center"
        >
          <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-medium mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Escolhidos</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-emerald-800">
            {stats.chosenUnits} <span className="text-xs font-normal text-emerald-600">reservas</span>
          </p>
          <p className="text-[10px] text-emerald-600/80">já garantidos 💙</p>
        </motion.div>

        {/* Disponíveis */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.29 }}
          className="bg-sky-50/70 rounded-xl p-3 border border-sky-100/80 text-center"
        >
          <div className="flex items-center justify-center gap-1 text-sky-700 text-xs font-medium mb-1">
            <CircleDot className="w-3.5 h-3.5" />
            <span>Disponíveis</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-sky-800">
            {stats.availableUnits} <span className="text-xs font-normal text-sky-600">itens</span>
          </p>
          <p className="text-[10px] text-sky-600/80">aguardando carinho</p>
        </motion.div>

        {/* Preenchimento */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.36 }}
          className="bg-amber-50/60 rounded-xl p-3 border border-amber-100/80 text-center"
        >
          <div className="flex items-center justify-center gap-1 text-amber-800 text-xs font-medium mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
            <span>Preenchida</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-amber-900">
            {stats.completionPercentage}%
          </p>
          <p className="text-[10px] text-amber-700/80">da lista concluída</p>
        </motion.div>
      </div>
    </motion.div>
  );
};
