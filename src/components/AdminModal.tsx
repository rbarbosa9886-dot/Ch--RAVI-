import React, { useState, useEffect } from 'react';
import {
  X, Lock, KeyRound, Plus, Edit2, Trash2, RotateCcw, Search,
  CheckCircle2, AlertCircle, BarChart2, Gift as GiftIcon, Users, Settings,
  LogOut, Save, ExternalLink, Calendar, MapPin, Copy, Check, Eye, EyeOff
} from 'lucide-react';
import { Gift, Reservation, EventDetails, DashboardStats, GiftCategory } from '../types.ts';
import { CATEGORIES } from './CategoryFilter.tsx';
import {
  adminLogin,
  fetchAdminReservations,
  cancelReservation,
  createGift,
  updateGift,
  deleteGift,
  updateEventDetails,
  resetDemoData
} from '../api.ts';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  gifts: Gift[];
  stats: DashboardStats;
  eventDetails: EventDetails;
  onGiftsUpdated: () => void;
  onEventUpdated: () => void;
  adminToken: string | null;
  onLoginSuccess: (token: string) => void;
  onLogout: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  gifts,
  stats,
  eventDetails,
  onGiftsUpdated,
  onEventUpdated,
  adminToken,
  onLoginSuccess,
  onLogout,
}) => {
  // Login states
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin tabs: 'reservas' | 'presentes' | 'dashboard' | 'configuracoes'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reservas' | 'presentes' | 'configuracoes'>('dashboard');

  // Reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resSearch, setResSearch] = useState('');
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Gift Form Modal (Add / Edit)
  const [isGiftFormOpen, setIsGiftFormOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [giftName, setGiftName] = useState('');
  const [giftDesc, setGiftDesc] = useState('');
  const [giftCategory, setGiftCategory] = useState<GiftCategory>('fraldas');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftImageUrl, setGiftImageUrl] = useState('');
  const [giftBrand, setGiftBrand] = useState('');
  const [isSavingGift, setIsSavingGift] = useState(false);

  // Event details form
  const [editEvent, setEditEvent] = useState<EventDetails>({ ...eventDetails });
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Supabase SQL copied state
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    setEditEvent({ ...eventDetails });
  }, [eventDetails]);

  // Load reservations when authenticated
  const loadReservations = async (token: string) => {
    setIsLoadingReservations(true);
    try {
      const data = await fetchAdminReservations(token);
      setReservations(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingReservations(false);
    }
  };

  useEffect(() => {
    if (adminToken && isOpen) {
      loadReservations(adminToken);
    }
  }, [adminToken, isOpen]);

  if (!isOpen) return null;

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await adminLogin(password);
      if (res.success && res.token) {
        onLoginSuccess(res.token);
        setPassword('');
        loadReservations(res.token);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Senha incorreta. Tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Open Gift Form (Add or Edit)
  const handleOpenAddGift = () => {
    setEditingGift(null);
    setGiftName('');
    setGiftDesc('');
    setGiftCategory('fraldas');
    setGiftQuantity(3);
    setGiftImageUrl('https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80');
    setGiftBrand('');
    setIsGiftFormOpen(true);
  };

  const handleOpenEditGift = (gift: Gift) => {
    setEditingGift(gift);
    setGiftName(gift.name);
    setGiftDesc(gift.description);
    setGiftCategory(gift.category);
    setGiftQuantity(gift.totalQuantity);
    setGiftImageUrl(gift.imageUrl);
    setGiftBrand(gift.suggestedBrand || '');
    setIsGiftFormOpen(true);
  };

  // Save Gift
  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSavingGift(true);
    try {
      if (editingGift) {
        await updateGift(editingGift.id, {
          name: giftName,
          description: giftDesc,
          category: giftCategory,
          totalQuantity: giftQuantity,
          imageUrl: giftImageUrl,
          suggestedBrand: giftBrand,
        }, adminToken);
        setActionSuccessMessage('Presente atualizado com sucesso!');
      } else {
        await createGift({
          name: giftName,
          description: giftDesc,
          category: giftCategory,
          totalQuantity: giftQuantity,
          imageUrl: giftImageUrl,
          suggestedBrand: giftBrand,
        }, adminToken);
        setActionSuccessMessage('Novo presente cadastrado com sucesso!');
      }
      setIsGiftFormOpen(false);
      onGiftsUpdated();
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar presente.');
    } finally {
      setIsSavingGift(false);
    }
  };

  // Delete Gift
  const handleDeleteGift = async (gift: Gift) => {
    if (!adminToken) return;
    const confirmDelete = window.confirm(`Tem certeza que deseja excluir "${gift.name}" da lista?`);
    if (!confirmDelete) return;

    try {
      await deleteGift(gift.id, adminToken);
      onGiftsUpdated();
      setActionSuccessMessage(`Presente "${gift.name}" excluído.`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir presente.');
    }
  };

  // Cancel Reservation
  const handleCancelReservation = async (reservation: Reservation) => {
    if (!adminToken) return;
    const confirmCancel = window.confirm(
      `Deseja cancelar a reserva de "${reservation.guestName}" para "${reservation.giftName}"? A unidade voltará automaticamente para o estoque disponível.`
    );
    if (!confirmCancel) return;

    setCancellingId(reservation.id);
    try {
      await cancelReservation(reservation.id, adminToken);
      setActionSuccessMessage(`Reserva de ${reservation.guestName} cancelada e item liberado!`);
      loadReservations(adminToken);
      onGiftsUpdated();
      setTimeout(() => setActionSuccessMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar reserva.');
    } finally {
      setCancellingId(null);
    }
  };

  // Save Event Details
  const handleSaveEventDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSavingEvent(true);
    try {
      await updateEventDetails(editEvent, adminToken);
      onEventUpdated();
      setActionSuccessMessage('Informações do evento atualizadas com sucesso!');
      setTimeout(() => setActionSuccessMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar evento.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Reset demo
  const handleResetDemo = async () => {
    if (!adminToken) return;
    if (!window.confirm('Deseja restaurar a lista para os itens e reservas originais de exemplo?')) return;
    try {
      await resetDemoData(adminToken);
      onGiftsUpdated();
      loadReservations(adminToken);
      setActionSuccessMessage('Dados restaurados com sucesso.');
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter reservations
  const filteredReservations = reservations.filter(r =>
    r.guestName.toLowerCase().includes(resSearch.toLowerCase()) ||
    r.giftName.toLowerCase().includes(resSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* Top bar */}
        <div className="bg-[#1E3A8A] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-title font-bold text-base sm:text-lg">
                Painel dos Pais — Chá do Ravi
              </h2>
              <p className="text-[11px] text-sky-200">Gerenciamento exclusivo da lista de presentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {adminToken && (
              <button
                onClick={onLogout}
                className="p-1.5 text-sky-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Sair do modo administrador"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-sky-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action success alert */}
        {actionSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Content area */}
        {!adminToken ? (
          /* LOGIN SCREEN */
          <div className="p-8 max-w-md mx-auto w-full my-auto text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <KeyRound className="w-7 h-7" />
            </div>
            <h3 className="font-serif-title text-xl font-bold text-slate-800 mb-1">
              Acesso dos Pais
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Digite a senha de administrador para gerenciar presentes e visualizar reservas.
            </p>

            {loginError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha..."
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !password}
                className="w-full py-3 bg-[#1E3A8A] hover:bg-[#182f70] text-white font-semibold text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? 'Verificando...' : 'Entrar no Painel'}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabs Header */}
            <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 pt-2 gap-1 overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('reservas')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'reservas'
                    ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Reservas ({reservations.filter(r => r.status === 'confirmed').length})</span>
              </button>

              <button
                onClick={() => setActiveTab('presentes')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'presentes'
                    ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GiftIcon className="w-4 h-4" />
                <span>Gerenciar Presentes ({gifts.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('configuracoes')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'configuracoes'
                    ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Configurações & Supabase</span>
              </button>
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              
              {/* TAB: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100">
                      <p className="text-xs text-sky-700 font-medium">Total de Presentes</p>
                      <p className="text-2xl font-bold text-sky-950 mt-1">{stats.totalUnits}</p>
                      <p className="text-[11px] text-sky-600 mt-0.5">{stats.totalGifts} categorias/itens</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <p className="text-xs text-emerald-700 font-medium">Presentes Escolhidos</p>
                      <p className="text-2xl font-bold text-emerald-950 mt-1">{stats.chosenUnits}</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">{stats.completionPercentage}% preenchido</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                      <p className="text-xs text-amber-700 font-medium">Ainda Disponíveis</p>
                      <p className="text-2xl font-bold text-amber-950 mt-1">{stats.availableUnits}</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">itens livres</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                      <p className="text-xs text-indigo-700 font-medium">Convidados Cadastrados</p>
                      <p className="text-2xl font-bold text-indigo-950 mt-1">
                        {reservations.filter(r => r.status === 'confirmed').length}
                      </p>
                      <p className="text-[11px] text-indigo-600 mt-0.5">mensagens carinhosas</p>
                    </div>
                  </div>

                  {/* Progress Bar Detail */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700">Meta da Lista de Fraldas & Presentes</span>
                      <span className="text-sm font-bold text-[#1E3A8A]">{stats.completionPercentage}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 via-blue-600 to-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${stats.completionPercentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {stats.chosenUnits} de {stats.totalUnits} itens já foram carinhosamente reservados pelos convidados.
                    </p>
                  </div>

                  {/* Quick actions & Recent reservations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                      <h4 className="font-semibold text-sm text-slate-800 mb-3 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#1E3A8A]" />
                        Últimas Reservas Confirmadas
                      </h4>
                      {reservations.slice(0, 4).map((r) => (
                        <div key={r.id} className="py-2 border-b border-slate-100 last:border-0 text-xs flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-800">{r.guestName}</p>
                            <p className="text-slate-500">{r.giftName}</p>
                          </div>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                            Confirmado
                          </span>
                        </div>
                      ))}
                      {reservations.length === 0 && (
                        <p className="text-xs text-slate-400 italic">Nenhuma reserva registrada ainda.</p>
                      )}
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-800 mb-2">Ações Rápidas</h4>
                        <p className="text-xs text-slate-500 mb-4">
                          Você pode adicionar novos presentes sob demanda ou resetar para a demonstração inicial.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleOpenAddGift}
                          className="w-full py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-semibold hover:bg-[#182f70] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar Novo Presente
                        </button>
                        <button
                          onClick={handleResetDemo}
                          className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restaurar Dados de Exemplo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: RESERVAS */}
              {activeTab === 'reservas' && (
                <div className="space-y-4">
                  {/* Search bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Pesquisar por convidado ou presente..."
                        value={resSearch}
                        onChange={(e) => setResSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                      />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {filteredReservations.length} {filteredReservations.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Convidado</th>
                          <th className="px-4 py-3">Presente</th>
                          <th className="px-4 py-3">Qtd</th>
                          <th className="px-4 py-3">Data / Hora</th>
                          <th className="px-4 py-3">Mensagem</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReservations.map((res) => {
                          const isCancelled = res.status === 'cancelled';
                          return (
                            <tr key={res.id} className={isCancelled ? 'bg-slate-50/70 opacity-60' : 'hover:bg-slate-50/50'}>
                              <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                {res.guestName}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-800">
                                {res.giftName}
                              </td>
                              <td className="px-4 py-3">
                                {res.quantity}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                {new Date(res.createdAt).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={res.message}>
                                {res.message ? `“${res.message}”` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {isCancelled ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600">
                                    Cancelado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Confirmado
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {!isCancelled && (
                                  <button
                                    onClick={() => handleCancelReservation(res)}
                                    disabled={cancellingId === res.id}
                                    className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] hover:underline cursor-pointer"
                                  >
                                    {cancellingId === res.id ? 'Liberando...' : 'Cancelar & Liberar Unidade'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredReservations.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Nenhuma reserva encontrada com o termo pesquisado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: PRESENTES */}
              {activeTab === 'presentes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-800">Catálogo de Presentes</h4>
                      <p className="text-xs text-slate-500">Edite descrições, quantidades e adicione itens</p>
                    </div>
                    <button
                      onClick={handleOpenAddGift}
                      className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#182f70] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo Presente
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {gifts.map((g) => (
                      <div key={g.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-start gap-3">
                        <img
                          src={g.imageUrl}
                          alt={g.name}
                          className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] bg-sky-50 px-2 py-0.5 rounded-md">
                              {g.category}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.availableQuantity > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                              {g.availableQuantity} / {g.totalQuantity} disp.
                            </span>
                          </div>
                          <h5 className="font-bold text-xs text-slate-900 truncate mt-1">{g.name}</h5>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{g.description}</p>
                          
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleOpenEditGift(g)}
                              className="text-xs text-[#1E3A8A] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" /> Editar
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              onClick={() => handleDeleteGift(g)}
                              className="text-xs text-rose-600 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: CONFIGURAÇÕES & SUPABASE */}
              {activeTab === 'configuracoes' && (
                <div className="space-y-6">
                  {/* Event Details Editor */}
                  <form onSubmit={handleSaveEventDetails} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#1E3A8A]" />
                      Informações do Evento
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Nome do Bebê</label>
                        <input
                          type="text"
                          value={editEvent.babyName}
                          onChange={(e) => setEditEvent({ ...editEvent, babyName: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Título do Tema</label>
                        <input
                          type="text"
                          value={editEvent.themeTitle}
                          onChange={(e) => setEditEvent({ ...editEvent, themeTitle: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Data do Evento</label>
                        <input
                          type="text"
                          value={editEvent.eventDate}
                          onChange={(e) => setEditEvent({ ...editEvent, eventDate: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Horário</label>
                        <input
                          type="text"
                          value={editEvent.eventTime}
                          onChange={(e) => setEditEvent({ ...editEvent, eventTime: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Local</label>
                        <input
                          type="text"
                          value={editEvent.eventLocation}
                          onChange={(e) => setEditEvent({ ...editEvent, eventLocation: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Endereço Completo</label>
                        <input
                          type="text"
                          value={editEvent.eventAddress}
                          onChange={(e) => setEditEvent({ ...editEvent, eventAddress: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">Frase de Abertura</label>
                        <input
                          type="text"
                          value={editEvent.subtitle}
                          onChange={(e) => setEditEvent({ ...editEvent, subtitle: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingEvent}
                      className="px-5 py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-[#182f70] transition-colors cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingEvent ? 'Salvando...' : 'Salvar Alterações do Evento'}
                    </button>
                  </form>

                  {/* Supabase Integration Guide */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <h4 className="font-bold text-slate-900">Integração Supabase (SQL Script)</h4>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `-- Execute o arquivo supabase-schema.sql no SQL Editor do seu projeto Supabase para criar as tabelas e a stored procedure atômica make_reservation().`
                          );
                          setSqlCopied(true);
                          setTimeout(() => setSqlCopied(false), 2500);
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{sqlCopied ? 'Copiado!' : 'Copiar Dica'}</span>
                      </button>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      O aplicativo já está rodando com persistência em tempo real e bloqueio atômico de concorrência. Se desejar conectar seu próprio projeto Supabase na nuvem, adicione as chaves <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">SUPABASE_URL</code> e <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">SUPABASE_ANON_KEY</code> no arquivo de ambiente. O script completo está salvo em <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">/supabase-schema.sql</code>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT GIFT */}
      {isGiftFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif-title font-bold text-lg text-slate-800">
                {editingGift ? 'Editar Presente' : 'Novo Presente para o Ravi'}
              </h3>
              <button
                onClick={() => setIsGiftFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGift} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Presente *</label>
                <input
                  type="text"
                  required
                  value={giftName}
                  onChange={(e) => setGiftName(e.target.value)}
                  placeholder="Ex: Fraldas tamanho M"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={giftCategory}
                    onChange={(e) => setGiftCategory(e.target.value as GiftCategory)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                  >
                    {CATEGORIES.filter(c => c.id !== 'todos').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantidade Total *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={giftQuantity}
                    onChange={(e) => setGiftQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sugestão de Marca / Tamanho</label>
                <input
                  type="text"
                  value={giftBrand}
                  onChange={(e) => setGiftBrand(e.target.value)}
                  placeholder="Ex: Pampers Confort Sec, Huggies, Granado..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição Curta</label>
                <textarea
                  rows={2}
                  value={giftDesc}
                  onChange={(e) => setGiftDesc(e.target.value)}
                  placeholder="Descreva o item ou dê dicas para os convidados..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL da Imagem</label>
                <input
                  type="url"
                  value={giftImageUrl}
                  onChange={(e) => setGiftImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGiftFormOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingGift}
                  className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#182f70] text-white rounded-xl font-bold cursor-pointer"
                >
                  {isSavingGift ? 'Salvando...' : 'Salvar Presente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
