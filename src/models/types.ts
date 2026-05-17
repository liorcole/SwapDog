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

export enum SwapStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined',
  cancelled = 'cancelled',
  completed = 'completed',
}

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
}

export interface Dog {
  id: string;
  ownerId: string;
  name: string;
  breed: string;
  age: number;
  size: DogSize;
  sex: DogSex;
  energyLevel: EnergyLevel;
  photos: string[];
  bio?: string;
  isGoodWithDogs?: boolean;
  isGoodWithKids?: boolean;
  isSpayedNeutered?: boolean;
  vaccinated?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  receiverId: string;
  requesterDogIds: string[];
  receiverDogIds: string[];
  startDate: Date;
  endDate: Date;
  message?: string;
  status: SwapStatus;
  conversationId?: string;
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
