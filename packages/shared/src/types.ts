import type { Locale } from './constants';

export type VerificationStatus =
  | 'unverified'
  | 'owner_uploaded'
  | 'platform_reviewed'
  | 'platform_verified';

export type PropertyType =
  | 'farm'
  | 'chalet'
  | 'villa'
  | 'istiraha'
  | 'private_resort'
  | 'pool_house';

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

export type LocalizedField<T> = Record<Locale, T>;
