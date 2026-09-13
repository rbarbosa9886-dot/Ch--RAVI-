import React, { useState, useEffect, useRef } from 'react';
import {
  X, Lock, KeyRound, Plus, Edit2, Trash2, RotateCcw, Search,
  CheckCircle2, AlertCircle, BarChart2, Gift as GiftIcon, Users, Settings,
  LogOut, Save, ExternalLink, Calendar, MapPin, Copy, Check, Eye, EyeOff,
  Download, Upload, FileSpreadsheet, FileJson, RefreshCw, AlertTriangle, ShieldCheck
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
  resetDemoData,
  clearAllReservations,
  fetchFullBackup,
  restoreFullBackup
} from '../api.ts';
import {
  autoSaveEventDetails,
  flushEventAutosave,
  subscribeToAutosave,
  getAutosaveStatus,
  AutosaveInfo,
  autoSaveSingleGift,
  autoDeleteGift,
  STORAGE_KEYS
} from '../services/storageService.ts';
import { ImageUploadField } from './ImageUploadField.tsx';

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

  // Backup & Reset states
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosave status
  const [autosaveInfo, setAutosaveInfo] = useState<AutosaveInfo>(getAutosaveStatus);

  useEffect(() => {
    const unsubscribe = subscribeToAutosave((info) => {
      setAutosaveInfo(info);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setEditEvent({ ...eventDetails });
  }, [eventDetails]);

  // Handle close with flush
  const handleCloseModal = () => {
    flushEventAutosave(adminToken);
    onClose();
  };

  // Immediate centralized field change with debounce API sync
  const handleEventFieldChange = (field: keyof EventDetails, value: string) => {
    const updated: EventDetails = {
      ...editEvent,
      [field]: value,
      isCustomized: true,
      updatedAt: Date.now()
    };
    setEditEvent(updated);
    autoSaveEventDetails(updated, adminToken, { debounceMs: 500 });
    onEventUpdated();
  };

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
    const cleanPassword = password.trim();
    try {
      const res = await adminLogin(cleanPassword);
      if (res.success && res.token) {
        onLoginSuccess(res.token);
        setPassword('');
        loadReservations(res.token);
      } else {
        setLoginError('Senha incorreta. A senha é Ravi2026.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Senha incorreta. A senha é Ravi2026.');
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
    const qtyText = reservation.quantity > 1 ? `${reservation.quantity} unidades voltarão` : '1 unidade voltará';
    const confirmCancel = window.confirm(
      `Deseja cancelar a reserva de "${reservation.guestName}" para "${reservation.giftName}"? As ${qtyText} automaticamente para o estoque disponível.`
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
    setIsSavingEvent(true);
    try {
      const saved = autoSaveEventDetails(editEvent, adminToken, { immediate: true });
      setEditEvent(saved);
      onEventUpdated();
      setActionSuccessMessage('Informações do evento salvas e sincronizadas com sucesso!');
      setTimeout(() => setActionSuccessMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar evento.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Save current information (Local Snapshot + Sync confirmation)
  const handleSaveCurrentState = async () => {
    if (!adminToken) return;
    try {
      setIsProcessingBackup(true);
      const backup = await fetchFullBackup(adminToken);
      localStorage.setItem('ravi_last_saved_snapshot', JSON.stringify({
        timestamp: new Date().toISOString(),
        backup
      }));
      const now = new Date().toLocaleTimeString('pt-BR');
      setLastSavedTime(now);
      setActionSuccessMessage(`Todas as informações até o momento foram salvas com sucesso às ${now}!`);
      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar informações.');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  // Download full JSON backup file
  const handleDownloadBackup = async () => {
    if (!adminToken) return;
    try {
      setIsProcessingBackup(true);
      const backup = await fetchFullBackup(adminToken);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `backup-cha-do-ravi-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const now = new Date().toLocaleTimeString('pt-BR');
      setLastSavedTime(now);
      setActionSuccessMessage('Arquivo de backup (.JSON) baixado com sucesso! Guarde-o em local seguro.');
      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      alert(err.message || 'Erro ao baixar backup.');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  // Download CSV report of guest reservations
  const handleDownloadCsv = () => {
    if (reservations.length === 0) {
      alert('Nenhuma reserva registrada até o momento para exportar.');
      return;
    }

    const headers = ['Nome do Convidado', 'Presente Escolhido', 'Quantidade', 'Data e Hora', 'Status', 'Mensagem de Carinho'];
    const rows = reservations.map(r => [
      `"${(r.guestName || '').replace(/"/g, '""')}"`,
      `"${(r.giftName || '').replace(/"/g, '""')}"`,
      r.quantity || 1,
      `"${new Date(r.createdAt).toLocaleString('pt-BR')}"`,
      `"${r.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}"`,
      `"${(r.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `relatorio-reservas-cha-do-ravi-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActionSuccessMessage('Planilha de convidados (.CSV) exportada com sucesso!');
    setTimeout(() => setActionSuccessMessage(null), 4500);
  };

  // Restore backup from uploaded JSON file
  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminToken) return;

    const proceed = window.confirm(
      `Deseja restaurar as informações a partir do arquivo "${file.name}"?\n\n` +
      `Isso atualizará os presentes, reservas e detalhes do evento com os dados salvos no arquivo.`
    );
    if (!proceed) {
      e.target.value = '';
      return;
    }

    try {
      setIsProcessingBackup(true);
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.gifts || !Array.isArray(parsed.gifts)) {
        throw new Error('Arquivo inválido: estrutura de presentes não encontrada no backup.');
      }
      await restoreFullBackup(parsed, adminToken);
      onGiftsUpdated();
      onEventUpdated();
      loadReservations(adminToken);
      setActionSuccessMessage('Informações e presentes restaurados com sucesso a partir do backup!');
      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      alert(err.message || 'Falha ao processar arquivo de backup.');
    } finally {
      setIsProcessingBackup(false);
      e.target.value = '';
    }
  };

  // Reset: Clear ONLY guest reservations (sets gifts back to 100% available without deleting customized items)
  const handleClearReservationsOnly = async () => {
    if (!adminToken) return;
    const confirmed = window.confirm(
      '⚠️ DESEJA ZERAR APENAS AS RESERVAS DOS CONVIDADOS?\n\n' +
      '• Os nomes e mensagens dos convidados serão limpos.\n' +
      '• Todos os seus presentes voltarão a ficar 100% livres/disponíveis.\n' +
      '• Os presentes cadastrados, marcas, fotos e detalhes do evento SERÃO MANTIDOS.\n\n' +
      'Dica: Se ainda não o fez, você pode baixar o backup antes de resetar.\n\n' +
      'Confirmar limpeza das reservas?'
    );
    if (!confirmed) return;

    try {
      setIsResetting(true);
      const res = await clearAllReservations(adminToken);
      onGiftsUpdated();
      loadReservations(adminToken);
      setActionSuccessMessage(res.message || 'Todas as reservas foram zeradas. Presentes 100% disponíveis!');
      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      alert(err.message || 'Erro ao zerar reservas.');
    } finally {
      setIsResetting(false);
    }
  };

  // Reset: Restore factory demo gifts
  const handleResetToDefaults = async () => {
    if (!adminToken) return;
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO: DESEJA RESTAURAR A LISTA ORIGINAL COMPLETA?\n\n' +
      '• Todos os presentes atuais serão substituídos pela lista padrão original de fraldas e roupinhas.\n' +
      '• Os dados do evento e reservas voltarão ao padrão inicial de fábrica.\n\n' +
      'Dica: Recomendamos baixar o backup antes de prosseguir se quiser guardar seus dados atuais.\n\n' +
      'Deseja realmente restaurar para a lista original?'
    );
    if (!confirmed) return;

    try {
      setIsResetting(true);
      await resetDemoData(adminToken);
      onGiftsUpdated();
      onEventUpdated();
      loadReservations(adminToken);
      setActionSuccessMessage('Dados restaurados para a lista padrão original com sucesso!');
      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      alert(err.message || 'Erro ao restaurar dados.');
    } finally {
      setIsResetting(false);
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
            <div className="w-9 h-9 rounded-full overflow-hidden border border-amber-300/80 bg-white shrink-0 flex items-center justify-center shadow-xs">
              <img
                src="/ravi-logo.jpg"
                alt="Logo Chá do Ravi"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
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
            <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden border-2 border-amber-200/90 shadow-sm bg-white flex items-center justify-center">
              <img
                src="/ravi-logo.jpg"
                alt="Logo Chá do Ravi"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
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
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 pt-2 gap-1 overflow-x-auto shrink-0">
              <div className="flex gap-1">
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
                  <span>Configurações, Backup & Reset</span>
                </button>
              </div>

              {/* Autosave Status Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 mb-1 text-[11px] font-medium rounded-full bg-white border border-slate-200 shadow-xs">
                {autosaveInfo.status === 'saving' ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
                    <span className="text-amber-700">Salvando alterações...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-slate-600">
                      Auto-salvo {autosaveInfo.lastSavedFormatted ? `às ${autosaveInfo.lastSavedFormatted}` : 'localmente'}
                    </span>
                  </>
                )}
              </div>
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
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-[#1E3A8A]" />
                            Últimas Reservas Confirmadas
                          </h4>
                          {reservations.length > 0 && (
                            <button
                              onClick={handleDownloadCsv}
                              className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                              title="Exportar planilha"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              Exportar (.CSV)
                            </button>
                          )}
                        </div>
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
                          <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma reserva registrada ainda.</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 mt-2">
                        <button
                          onClick={handleOpenAddGift}
                          className="w-full py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-semibold hover:bg-[#182f70] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar Novo Presente
                        </button>
                      </div>
                    </div>

                    {/* Data, Save & Reset Box */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#1E3A8A]" />
                            Salvar & Backup dos Dados
                          </h4>
                          {lastSavedTime && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-200">
                              Salvo às {lastSavedTime}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          Guarde as informações atuais com segurança ou baixe relatórios para organizar o evento.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={handleSaveCurrentState}
                            disabled={isProcessingBackup}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Salvar Informações
                          </button>

                          <button
                            onClick={handleDownloadBackup}
                            disabled={isProcessingBackup}
                            className="py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar Backup (.JSON)
                          </button>
                        </div>
                      </div>

                      {/* Reset Actions Section */}
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-700 mb-1.5">Opções de Reset:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={handleClearReservationsOnly}
                            disabled={isResetting}
                            className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            title="Remove apenas as escolhas dos convidados e torna 100% dos presentes livres novamente"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" />
                            Zerar Apenas Reservas
                          </button>

                          <button
                            onClick={handleResetToDefaults}
                            disabled={isResetting}
                            className="py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            title="Restaura a lista completa para o padrão original do Chá do Ravi"
                          >
                            <RefreshCw className="w-3 h-3 text-slate-500" />
                            Restaurar Padrão Inicial
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: RESERVAS */}
              {activeTab === 'reservas' && (
                <div className="space-y-4">
                  {/* Search bar & Export */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
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
                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {filteredReservations.length} {filteredReservations.length === 1 ? 'registro' : 'registros'}
                      </span>
                      <button
                        onClick={handleDownloadCsv}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        title="Baixar planilha de convidados para Excel / Planilhas Google"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Exportar (.CSV)</span>
                      </button>
                    </div>
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
                                    {cancellingId === res.id
                                      ? 'Liberando...'
                                      : `Cancelar & Liberar ${res.quantity > 1 ? `${res.quantity} Unidades` : 'Unidade'}`}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#1E3A8A]" />
                          Informações do Evento
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Edite os dados do chá de bebê. As alterações são salvas automaticamente enquanto você digita.
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {autosaveInfo.status === 'saving'
                            ? 'Sincronizando...'
                            : autosaveInfo.lastSavedFormatted
                            ? `Salvo automaticamente às ${autosaveInfo.lastSavedFormatted}`
                            : 'Auto-salvamento ativo'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Nome do Bebê</label>
                        <input
                          type="text"
                          value={editEvent.babyName}
                          onChange={(e) => handleEventFieldChange('babyName', e.target.value)}
                          placeholder="Ex: Ravi"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Título do Tema</label>
                        <input
                          type="text"
                          value={editEvent.themeTitle}
                          onChange={(e) => handleEventFieldChange('themeTitle', e.target.value)}
                          placeholder="Ex: Chá de Fraldas do Ravi"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Data do Evento</label>
                        <input
                          type="text"
                          value={editEvent.eventDate}
                          onChange={(e) => handleEventFieldChange('eventDate', e.target.value)}
                          placeholder="Ex: 26 de Abril de 2026"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Horário</label>
                        <input
                          type="text"
                          value={editEvent.eventTime}
                          onChange={(e) => handleEventFieldChange('eventTime', e.target.value)}
                          placeholder="Ex: 15h00 às 19h00"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Local / Nome do Espaço</label>
                        <input
                          type="text"
                          value={editEvent.eventLocation}
                          onChange={(e) => handleEventFieldChange('eventLocation', e.target.value)}
                          placeholder="Ex: Espaço Bem Estar"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Endereço Completo</label>
                        <input
                          type="text"
                          value={editEvent.eventAddress}
                          onChange={(e) => handleEventFieldChange('eventAddress', e.target.value)}
                          placeholder="Ex: Rua das Flores, 123 - Jardim Primavera"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Chave PIX (Para Presentes em Dinheiro)</label>
                        <input
                          type="text"
                          value={editEvent.pixKey || ''}
                          onChange={(e) => handleEventFieldChange('pixKey', e.target.value)}
                          placeholder="Ex: seu-email@exemplo.com ou telefone"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Nome do Titular da Chave PIX</label>
                        <input
                          type="text"
                          value={editEvent.pixName || ''}
                          onChange={(e) => handleEventFieldChange('pixName', e.target.value)}
                          placeholder="Ex: Maria & João"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">Frase de Abertura / Subtítulo</label>
                        <input
                          type="text"
                          value={editEvent.subtitle}
                          onChange={(e) => handleEventFieldChange('subtitle', e.target.value)}
                          placeholder="Ex: Uma nova história de amor está prestes a começar..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">Texto de Boas-Vindas aos Convidados</label>
                        <textarea
                          rows={2}
                          value={editEvent.introText || ''}
                          onChange={(e) => handleEventFieldChange('introText', e.target.value)}
                          placeholder="Mensagem carinhosa para os convidados..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSavingEvent}
                        className="px-5 py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#182f70] transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingEvent ? 'Sincronizando...' : 'Confirmar & Salvar Imediatamente'}
                      </button>

                      <span className="text-[11px] text-slate-500 text-center sm:text-right">
                        💡 Suas alterações são salvas automaticamente no armazenamento persistente.
                      </span>
                    </div>
                  </form>

                  {/* SEÇÃO 1: SALVAR INFORMAÇÕES & BACKUP COMPLETO */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Salvar Informações & Fazer Backup dos Dados
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Proteja o trabalho realizado salvando uma cópia de segurança de todos os presentes, reservas e recados.
                        </p>
                      </div>
                      {lastSavedTime && (
                        <span className="self-start sm:self-center text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium border border-emerald-200">
                          Salvo às {lastSavedTime}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Salvar Informações Atuais */}
                      <button
                        onClick={handleSaveCurrentState}
                        disabled={isProcessingBackup}
                        className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-left transition-all group cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs mb-1">
                          <Save className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                          <span>Salvar Informações</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-snug">
                          Salva e sincroniza o estado atual completo da lista de presentes e recados.
                        </p>
                      </button>

                      {/* Baixar Backup (.JSON) */}
                      <button
                        onClick={handleDownloadBackup}
                        disabled={isProcessingBackup}
                        className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100/80 text-left transition-all group cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 text-sky-800 font-semibold text-xs mb-1">
                          <Download className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
                          <span>Baixar Backup (.JSON)</span>
                        </div>
                        <p className="text-[11px] text-sky-700 leading-snug">
                          Gera e baixa um arquivo completo com todos os dados para guardar no celular ou PC.
                        </p>
                      </button>

                      {/* Exportar Planilha (.CSV) */}
                      <button
                        onClick={handleDownloadCsv}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs mb-1">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                          <span>Exportar Planilha (.CSV)</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Lista de convidados com presentes escolhidos, pronta para abrir no Excel.
                        </p>
                      </button>
                    </div>

                    {/* Restaurar Backup de Arquivo */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Restaurar de arquivo salvo anteriormente:</span> Selecione um arquivo .JSON baixado deste sistema.
                      </div>
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleRestoreBackupFile}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessingBackup}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-slate-600" />
                          Restaurar Arquivo de Backup
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 2: OPÇÕES DE RESET DOS DADOS */}
                  <div className="bg-white p-5 rounded-2xl border border-amber-200/80 space-y-4">
                    <div className="border-b border-amber-100 pb-3">
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-600" />
                        Opções de Reset dos Dados
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Escolha como deseja reiniciar o sistema para o evento real ou para demonstração.
                      </p>
                    </div>

                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p>
                        <strong>Dica de segurança:</strong> Recomendamos sempre clicar em <strong>"Baixar Backup (.JSON)"</strong> antes de resetar. Assim, você sempre terá uma cópia garantida de tudo o que foi cadastrado.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Opção A: Zerar apenas reservas */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                            Recomendado para o Evento Real
                          </span>
                          <h5 className="font-bold text-xs text-slate-900 mt-2 mb-1">
                            Zerar Apenas as Reservas dos Convidados
                          </h5>
                          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                            <li>Limpa os nomes de quem reservou e recados enviados.</li>
                            <li>Todos os presentes voltam a ficar <strong>100% disponíveis</strong>.</li>
                            <li><strong>Mantém seus presentes cadastrados</strong>, marcas, fotos e detalhes do evento.</li>
                          </ul>
                        </div>

                        <button
                          onClick={handleClearReservationsOnly}
                          disabled={isResetting}
                          className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Zerar Apenas Reservas (100% Livres)
                        </button>
                      </div>

                      {/* Opção B: Restaurar padrão inicial */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                            Restauração Completa
                          </span>
                          <h5 className="font-bold text-xs text-slate-900 mt-2 mb-1">
                            Restaurar Lista Inicial de Fábrica
                          </h5>
                          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                            <li>Substitui todos os presentes pela lista original de fraldas (RN a G) e itens essenciais.</li>
                            <li>Restaura os detalhes padrão do chá.</li>
                            <li>Ideal se quiser recomeçar o aplicativo do zero absoluto.</li>
                          </ul>
                        </div>

                        <button
                          onClick={handleResetToDefaults}
                          disabled={isResetting}
                          className="w-full py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                          Restaurar Padrão Inicial de Fábrica
                        </button>
                      </div>
                    </div>
                  </div>

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

              <ImageUploadField
                value={giftImageUrl}
                onChange={(url) => setGiftImageUrl(url)}
              />

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
