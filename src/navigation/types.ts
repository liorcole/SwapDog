import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  SignUp: { email?: string };
};

export type OnboardingStackParamList = {
  ProfileSetup: undefined;
  AddDog: undefined;
  Paywall: undefined;
  LocationSetup: undefined;
};

export type ApprovalStackParamList = {
  Celebration: undefined;
  Contract: undefined;
};

export type DiscoverStackParamList = {
  Discover: undefined;
  UserDetail: { userId: string };
  DogDetail: { dogId: string };
  CreateSwap: { userId: string };
  /** New: navigate directly to create a public post */
  CreatePost: undefined;
  /** Full detail view for a public area post (from Discover feed) */
  PostDetail: { postId: string };
};

export type RequestsStackParamList = {
  Requests: undefined;
  WriteReview: { swapRequestId: string; revieweeId: string 
  UserDetail: { userId: string 
  DogDetail: { dogId: string };};};
  /** Full detail view for a public area post */
  PostDetail: { postId: string };
  /** Create a new public post */
  CreatePost: undefined;
};

export type MessagesStackParamList = {
  ConversationsList: undefined;
  Chat: { conversationId: string; otherUserId: string };
};

export type ProfileStackParamList = {
  Referral: undefined;
  Profile: undefined;
  EditProfile: undefined;
  /** dogId is optional: omit (or pass undefined) to create a new dog */
  EditDog: { dogId?: string };
  CommunityStandards: undefined;
  MyAgreement: undefined;
  PointsHistory: undefined;
};

export type MainTabParamList = {
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  RequestsTab: NavigatorScreenParams<RequestsStackParamList>;
  MessagesTab: NavigatorScreenParams<MessagesStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Referral: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  ConductStandards: undefined;
  WaitingApproval: undefined;
  ApprovalFlow: NavigatorScreenParams<ApprovalStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
