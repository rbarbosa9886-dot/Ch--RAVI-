import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { DashboardProgress } from './components/DashboardProgress.tsx';
import { CategoryFilter } from './components/CategoryFilter.tsx';
import { GiftCard } from './components/GiftCard.tsx';
import { ReservationModal } from './components/ReservationModal.tsx';
import { ConfirmationScreen } from './components/ConfirmationScreen.tsx';
import { AdminModal } from './components/AdminModal.tsx';
import { Gift, Reservation, EventDetails, DashboardStats, GiftCategory } from './types.ts';
import { DEFAULT_EVENT_DETAILS, INITIAL_GIFTS } from './data/defaultGifts.ts';
import { fetchEventDetails, fetchGifts, fetchDashboardStats, reserveGift } from './api.ts';
import {
  getStoredEventDetails,
  getStoredGifts,
  subscribeToEventDetails,
  subscribeToGifts
} from './services/storageService.ts';
import { Sparkles, Heart, Compass, RefreshCw, AlertTriangle } from 'lucide-react';

export default function App() {
  // Core App State initialized from centralized storage
  const [eventDetails, setEventDetails] = useState<EventDetails>(() => getStoredEventDetails());
  const [gifts, setGifts] = useState<Gift[]>(() => getStoredGifts());

  const [stats, setStats] = useState<DashboardStats>(() => {
    const initialGiftsList = getStoredGifts();
    const totalGifts = initialGiftsList.length;
    const totalUnits = initialGiftsList.reduce((a, b) => a + b.totalQuantity, 0);
    const chosenUnits = initialGiftsList.reduce((a, b) => a + (b.totalQuantity - b.availableQuantity), 0);
    const availableUnits = initialGiftsList.reduce((a, b) => a + b.availableQuantity, 0);
    const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 15;
    return { totalGifts, totalUnits, chosenUnits, availableUnits, completionPercentage };
  });

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Modals & Flow
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('ravi_admin_token');
  });

  const giftsSectionRef = useRef<HTMLDivElement>(null);

  // Fetch all initial data
  const loadData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setRefreshing(true);

    try {
      const [eventRes, giftsRes, statsRes] = await Promise.all([
        fetchEventDetails().catch(() => DEFAULT_EVENT_DETAILS),
        fetchGifts().catch(() => INITIAL_GIFTS),
        fetchDashboardStats().catch(() => null),
      ]);

      setEventDetails(eventRes);
      setGifts(giftsRes);

      if (statsRes) {
        setStats(statsRes);
      } else {
        // Compute from gifts
        const totalGifts = giftsRes.length;
        const totalUnits = giftsRes.reduce((acc, g) => acc + g.totalQuantity, 0);
        const availableUnits = giftsRes.reduce((acc, g) => acc + g.availableQuantity, 0);
        const chosenUnits = Math.max(0, totalUnits - availableUnits);
        const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 0;
        setStats({ totalGifts, totalUnits, chosenUnits, availableUnits, completionPercentage });
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to centralized storage changes (instant updates from Admin or another tab)
    const unsubEvent = subscribeToEventDetails((newDetails) => {
      setEventDetails(newDetails);
    });

    const unsubGifts = subscribeToGifts((newGifts) => {
      setGifts(newGifts);
      const totalGifts = newGifts.length;
      const totalUnits = newGifts.reduce((acc, g) => acc + g.totalQuantity, 0);
      const availableUnits = newGifts.reduce((acc, g) => acc + g.availableQuantity, 0);
      const chosenUnits = Math.max(0, totalUnits - availableUnits);
      const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 0;
      setStats({ totalGifts, totalUnits, chosenUnits, availableUnits, completionPercentage });
    });

    // Subtle polling every 20 seconds to keep quantities live if guests are using it concurrently
    const interval = setInterval(() => {
      loadData(true);
    }, 20000);

    return () => {
      unsubEvent();
      unsubGifts();
      clearInterval(interval);
    };
  }, []);

  const handleScrollToGifts = () => {
    if (giftsSectionRef.current) {
      giftsSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle gift reservation
  const handleConfirmReservation = async (giftId: string, guestName: string, message: string) => {
    const res = await reserveGift(giftId, guestName, message);
    if (res.success && res.reservation) {
      // Update local gift stock immediately
      setGifts(prev => prev.map(g => {
        if (g.id === giftId) {
          const newAvail = Math.max(0, g.availableQuantity - 1);
          return {
            ...g,
            availableQuantity: newAvail,
            status: newAvail === 0 ? 'depleted' : 'available'
          };
        }
        return g;
      }));

      // Update stats
      setStats(prev => {
        const newChosen = prev.chosenUnits + 1;
        const newAvail = Math.max(0, prev.availableUnits - 1);
        const newPct = prev.totalUnits > 0 ? Math.round((newChosen / prev.totalUnits) * 100) : 0;
        return {
          ...prev,
          chosenUnits: newChosen,
          availableUnits: newAvail,
          completionPercentage: newPct
        };
      });

      // Switch to confirmation view
      setSelectedGift(null);
      setActiveReservation(res.reservation);
      return { success: true };
    } else {
      // Reload gifts so user sees updated quantity
      loadData(true);
      return { success: false, error: res.error };
    }
  };

  // Filter gifts
  const filteredGifts = gifts.filter(gift => {
    const matchesCategory = selectedCategory === 'todos' || gift.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      gift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gift.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (gift.suggestedBrand && gift.suggestedBrand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesAvailability = !onlyAvailable || gift.availableQuantity > 0;

    return matchesCategory && matchesSearch && matchesAvailability;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-slate-800">
      {/* Top Header */}
      <Header
        onOpenAdmin={() => setIsAdminOpen(true)}
        isAdminLoggedIn={!!adminToken}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* If user just confirmed a gift, show the full confirmation view */}
        {activeReservation ? (
          <ConfirmationScreen
            reservation={activeReservation}
            eventDetails={eventDetails}
            onBackToList={() => {
              setActiveReservation(null);
              handleScrollToGifts();
            }}
          />
        ) : (
          <>
            {/* Hero / Welcome Section */}
            <Hero
              eventDetails={eventDetails}
              onScrollToGifts={handleScrollToGifts}
            />

            {/* Gift List Section */}
            <section
              id="lista-de-presentes"
              ref={giftsSectionRef}
              className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-20 scroll-mt-16"
            >
              {/* Section Heading */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-[#1E3A8A] font-bold mb-1">
                  <span>🍼</span>
                  <span>Lista de Presentes do Ravi</span>
                  <span>⭐</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-serif-title font-bold text-slate-900">
                  Escolha um Presente com Carinho
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-md mx-auto">
                  Selecione o item desejado abaixo e confirme com seu nome. A reserva é atualizada na hora!
                </p>
              </div>

              {/* Visual Progress Dashboard Bar */}
              <DashboardProgress stats={stats} />

              {/* Category & Search Filter Bar */}
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onlyAvailable={onlyAvailable}
                onToggleOnlyAvailable={() => setOnlyAvailable(!onlyAvailable)}
                itemCount={filteredGifts.length}
              />

              {/* Refresh indicator */}
              {refreshing && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-sky-700 py-1 mb-3 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Atualizando disponibilidade em tempo real...</span>
                </div>
              )}

              {/* Grid of Gifts */}
              {isLoading ? (
                <div className="py-20 text-center text-slate-400 text-sm">
                  <div className="w-8 h-8 mx-auto mb-2 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
                  <p>Carregando presentes do Ravi...</p>
                </div>
              ) : filteredGifts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filteredGifts.map((gift) => (
                    <GiftCard
                      key={gift.id}
                      gift={gift}
                      onSelect={(g) => setSelectedGift(g)}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                  <span className="text-4xl mb-2 block">🔍</span>
                  <h3 className="font-serif-title text-base font-bold text-slate-800 mb-1">
                    Nenhum presente encontrado
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                    Tente mudar a categoria ou limpar os termos de busca para ver outros itens da lista.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory('todos');
                      setSearchQuery('');
                      setOnlyAvailable(false);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    Ver todos os presentes
                  </button>
                </div>
              )}

              {/* Optional PIX notice for distant friends & family */}
              {eventDetails.pixKey && (
                <div className="mt-12 bg-gradient-to-r from-amber-50/70 via-sky-50/70 to-amber-50/70 rounded-2xl p-5 border border-amber-200/60 shadow-2xs text-center max-w-lg mx-auto">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#1E3A8A] uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Mora longe ou prefere enviar presente em PIX?</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Se desejar contribuir diretamente com as fraldinhas e itens do pequeno Ravi:
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-800 shadow-2xs">
                    <span>Chave PIX:</span>
                    <strong>{eventDetails.pixKey}</strong>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-center gap-2 text-[#1E3A8A]">
            <Compass className="w-4 h-4" />
            <span className="font-serif-title font-bold text-sm tracking-wider">CHÁ DO RAVI</span>
            <Compass className="w-4 h-4" />
          </div>
          <p className="text-slate-400 text-[11px]">
            Pequeno Explorador • Feito com todo carinho para comemorar a chegada do Ravi
          </p>
          <p className="text-slate-400 text-[10px] pt-2">
            © 2026 Chá do Ravi. Todos os direitos reservados à família.
          </p>
        </div>
      </footer>

      {/* Modal: Reservation */}
      <ReservationModal
        gift={selectedGift}
        isOpen={!!selectedGift}
        onClose={() => setSelectedGift(null)}
        onConfirm={handleConfirmReservation}
      />

      {/* Modal: Admin Panel */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        gifts={gifts}
        stats={stats}
        eventDetails={eventDetails}
        onGiftsUpdated={() => loadData(true)}
        onEventUpdated={() => loadData(true)}
        adminToken={adminToken}
        onLoginSuccess={(token) => {
          setAdminToken(token);
          localStorage.setItem('ravi_admin_token', token);
        }}
        onLogout={() => {
          setAdminToken(null);
          localStorage.removeItem('ravi_admin_token');
        }}
      />
    </div>
  );
}
