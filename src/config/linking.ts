import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['swapdog://', 'https://swapdog.app', 'https://joinwatchdog.com'],
  config: {
    screens: {
      Auth: 'auth',
      Onboarding: 'onboarding',
      Main: {
        screens: {
          DiscoverTab: {
            screens: {
              Discover: 'discover',
              UserDetail: 'user/:userId',
              DogDetail: 'dog/:dogId',
              CreateSwap: 'swap/create',
            },
          },
          RequestsTab: {
            screens: {
              Requests: 'requests',
            },
          },
          MessagesTab: {
            screens: {
              ConversationsList: 'messages',
              Chat: 'chat/:conversationId',
            },
          },
          ProfileTab: {
            screens: {
              Profile: 'profile',
              EditProfile: 'profile/edit',
            },
          },
        },
      },
    },
  },
};

export default linking;
