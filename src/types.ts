export type GiftCategory = 'fraldas' | 'higiene' | 'roupinhas' | 'banho' | 'quarto' | 'outros';

export interface Gift {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: GiftCategory;
  totalQuantity: number;
  availableQuantity: number;
  status: 'available' | 'depleted';
  createdAt: string;
  iconName?: string;
  suggestedBrand?: string;
  updatedAt?: number;
  isCustomized?: boolean;
}

export interface Reservation {
  id: string;
  giftId: string;
  giftName: string;
  guestName: string;
  message?: string;
  quantity: number;
  createdAt: string;
  status: 'confirmed' | 'cancelled';
}

export interface EventDetails {
  babyName: string;
  themeTitle: string;
  subtitle: string;
  introText: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventAddress: string;
  mapQuery?: string;
  pixKey?: string;
  pixName?: string;
  updatedAt?: number;
  isCustomized?: boolean;
}

export interface DashboardStats {
  totalGifts: number;
  totalUnits: number;
  chosenUnits: number;
  availableUnits: number;
  completionPercentage: number;
}
