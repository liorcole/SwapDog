import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  ProfileSetup: undefined;
  AddDog: undefined;
  LocationSetup: undefined;
};

export type DiscoverStackParamList = {
  Discover: undefined;
  UserDetail: { userId: string };
  DogDetail: { dogId: string };
  CreateSwap: { userId: string };
};

export type RequestsStackParamList = {
  Requests: undefined;
  WriteReview: { swapRequestId: string; revieweeId: string };
};

export type MessagesStackParamList = {
  ConversationsList: undefined;
  Chat: { conversationId: string; otherUserId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  EditDog: { dogId: string };
  CommunityStandards: undefined;
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
  VettingCall: undefined;
  WaitingApproval: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};
