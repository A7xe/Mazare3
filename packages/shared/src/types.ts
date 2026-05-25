import type { Locale, AvailabilityPeriod, BookingStatus, PropertyType } from './constants';

export type VerificationStatus =
  | 'unverified'
  | 'owner_uploaded'
  | 'platform_reviewed'
  | 'platform_verified';

export interface PublicPropertySummary {
  id: string;
  slug: string;
  type: PropertyType;
  titleAr: string;
  titleEn: string;
  city: string;
  area: string;
  approximateLocation: string;
  capacity: number;
  rating: number;
  reviewCount: number;
  basePrice: number;
  currency: string;
  verificationStatus: VerificationStatus;
  hasPlatformDeal: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  hasPool: boolean;
  hasIndoorPool: boolean;
  hasHeatedPool: boolean;
  hasFootballField: boolean;
  allowsOvernight: boolean;
  imageUrl?: string;
  amenityKeys: string[];
}

export interface PublicPropertyDetail extends PublicPropertySummary {
  descriptionAr: string;
  descriptionEn: string;
  bedrooms: number;
  bathrooms: number;
  poolsCount: number;
  checkInTime: string;
  checkOutTime: string;
  images: { url: string; altAr: string; altEn: string }[];
  rulesAr: string[];
  rulesEn: string[];
}

export interface PublicAvailabilitySlot {
  date: string;
  period: AvailabilityPeriod;
  price: number;
  currency: string;
  status: 'available' | 'blocked' | 'booked';
}

export interface OwnerDashboardSummary {
  propertiesCount: number;
  upcomingBookingsCount: number;
  todayBookingsCount: number;
  weekBookingsCount: number;
  estimatedRevenueJod: number;
  occupancyPercent: number;
}

export interface OwnerPropertyCard {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  status: string;
  area: string;
  city: string;
  basePrice: number;
  currency: string;
  bookingsCount: number;
  imageUrl?: string;
}

export interface OwnerPropertyDetail extends OwnerPropertyCard {
  capacity: number;
  allowsOvernight: boolean;
  upcomingBookingsCount: number;
}

export interface OwnerBookingRow {
  id: string;
  publicCode: string;
  status: BookingStatus;
  propertyId: string;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface OwnerAvailabilitySlotRow {
  id: string;
  propertyId: string;
  date: string;
  period: AvailabilityPeriod;
  price: number;
  currency: string;
  status: 'available' | 'blocked' | 'booked';
  hasActiveBooking: boolean;
}

export interface PublicBookingSummary {
  id: string;
  publicCode: string;
  status: BookingStatus;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  approximateLocation: string;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  cancelledAt?: string | null;
}
