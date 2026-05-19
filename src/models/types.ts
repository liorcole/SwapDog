export enum DogSize {
  small = 'small',
  medium = 'medium',
  large = 'large',
  extra_large = 'extra_large',
}

export enum EnergyLevel {
  low = 'low',
  moderate = 'moderate',
  high = 'high',
  very_high = 'very_high',
}

export enum DogSex {
  male = 'male',
  female = 'female',
}

// Legacy enum kept for old data compatibility — new posts use string literals
export enum SwapStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined',
  cancelled = 'cancelled',
  completed = 'completed',
}

export type AccountStatus =
  | 'pending_referral'
  | 'pending_vetting'
  | 'pending_approval'
  | 'active'
  | 'suspended';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  location?: GeoPoint;
  locationName?: string;
  pushToken?: string;
  isOnboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
  rating?: number;
  reviewCount?: number;
  // Referral & account lifecycle fields
  referredBy?: string;        // userId of the referrer
  referralCode: string;       // unique code this user can share
  points: number;             // starts at 0
  accountStatus: AccountStatus;
  conductAgreedAt?: Date;
  contractSignedAt?: Date;
  vettingScheduledAt?: Date;
}

export interface ReferralCode {
  code: string;
  createdBy: string;         // userId
  isActive: boolean;
  usedBy?: string[];         // userIds
  maxUses: number;
  usedCount: number;
  createdAt: Date;
}

export interface Dog {
  id: string;
  ownerId: string;
  name: string;
  breed: string;
  /** Age in whole years (0 means puppy under 1 year) */
  ageYears: number;
  /** Additional months (0-11). For puppies (ageYears=0) this is the primary age. */
  ageMonths: number;
  size: DogSize;
  sex: DogSex;
  energyLevel: EnergyLevel;
  /** Up to 10 photo URLs. First photo is the primary/thumbnail. */
  photoURLs: string[];
  bio?: string;
  isGoodWithDogs?: boolean;
  isGoodWithKids?: boolean;
  isSpayedNeutered?: boolean;
  vaccinated?: boolean;
  temperament?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentType = 'points' | 'payment' | 'either';
export type SitterPreference = 'points' | 'payment';

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Public post model — replaces targeted SwapRequest
// ─────────────────────────────────────────────────────────────────────────────

export type PostStatus = 'open' | 'claimed' | 'completed' | 'cancelled';
export type PaymentRate = 'per_hour' | 'per_day';
export type CompensationType = 'points' | 'payment' | 'either';

export interface SwapPost {
  id: string;

  // Poster info (denormalised for feed performance)
  posterId: string;
  posterName: string;
  posterPhotoURL?: string;
  posterLocation?: GeoPoint;

  // Dog info (denormalised for feed performance)
  dogId: string;
  dogName: string;
  dogBreed?: string;
  dogPhotoURL?: string;

  // Coverage
  startDate: Date;
  endDate: Date;
  /** Free-text description of what the sitter needs to know */
  careDetails: string;

  // Compensation
  compensationType: CompensationType;
  /** Auto-calculated: 1 day = 1 point, same day = 0.5 */
  pointsCost: number;
  /** Dollar amount per unit (per_hour or per_day). Only set when compensationType !== 'points' */
  paymentAmount?: number;
  paymentRate?: PaymentRate;
  /** Total calculated compensation = paymentAmount × totalUnits */
  totalPayment?: number;
  /** Number of hours or days used for calculation */
  totalUnits?: number;

  // Status
  status: PostStatus;
  /** userId of the sitter who claimed the post */
  claimedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy SwapRequest — kept for backward compat with existing Firestore records
// ─────────────────────────────────────────────────────────────────────────────
export interface SwapRequest {
  id: string;
  requesterId: string;
  receiverId: string;
  requesterDogIds: string[];
  receiverDogIds: string[];
  startDate: Date;
  endDate: Date;
  message?: string;
  /** Structured care details describing schedule, feeding, meds, etc. */
  careDetails?: string;
  status: SwapStatus;
  conversationId?: string;
  /** Auto-calculated: 1 full day = 1 point, same day = 0.5 points */
  pointsCost: number;
  /** Optional dollar amount if owner is also willing to pay */
  paymentOffered?: number;
  /** What the owner is offering: points only, payment only, or either */
  paymentType: PaymentType;
  /** What the sitter chose when accepting (if paymentType === 'either') */
  sitterPreference?: SitterPreference;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  swapRequestId?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCounts: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  read: boolean;
}

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  swapRequestId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}
