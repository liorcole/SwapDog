import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { MainTabParamList, DiscoverStackParamList, RequestsStackParamList, MessagesStackParamList, ProfileStackParamList } from './types';
import { useTheme } from '../contexts/ThemeContext';

// Discover stack
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import UserDetailScreen from '../screens/discover/UserDetailScreen';
import DogDetailScreen from '../screens/discover/DogDetailScreen';
import CreateSwapScreen from '../screens/booking/CreateSwapScreen';

// Requests stack
import RequestsScreen from '../screens/requests/RequestsScreen';
import WriteReviewScreen from '../screens/booking/WriteReviewScreen';

// Messages stack
import ConversationsListScreen from '../screens/messages/ConversationsListScreen';
import ChatScreen from '../screens/messages/ChatScreen';

// Profile stack
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import EditDogScreen from '../screens/profile/EditDogScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const RequestsStack = createNativeStackNavigator<RequestsStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const DiscoverNavigator: React.FC = () => (
  <DiscoverStack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
    <DiscoverStack.Screen name="Discover" component={DiscoverScreen} options={{ headerShown: false }} />
    <DiscoverStack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'Profile' }} />
    <DiscoverStack.Screen name="DogDetail" component={DogDetailScreen} options={{ title: 'Dog Profile' }} />
    <DiscoverStack.Screen name="CreateSwap" component={CreateSwapScreen} options={{ title: 'Request Swap', presentation: 'modal' }} />
  </DiscoverStack.Navigator>
);

const RequestsNavigator: React.FC = () => (
  <RequestsStack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
    <RequestsStack.Screen name="Requests" component={RequestsScreen} options={{ title: 'Swap Requests' }} />
    <RequestsStack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review', presentation: 'modal' }} />
  </RequestsStack.Navigator>
);

const MessagesNavigator: React.FC = () => (
  <MessagesStack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
    <MessagesStack.Screen name="ConversationsList" component={ConversationsListScreen} options={{ title: 'Messages' }} />
    <MessagesStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
  </MessagesStack.Navigator>
);

const ProfileNavigator: React.FC = () => (
  <ProfileStack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    <ProfileStack.Screen name="EditDog" component={EditDogScreen} options={{ title: 'Edit Dog' }} />
  </ProfileStack.Navigator>
);

const MainTabNavigator: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverNavigator}
        options={{ tabBarLabel: 'Discover', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🐾</Text> }}
      />
      <Tab.Screen
        name="RequestsTab"
        component={RequestsNavigator}
        options={{ tabBarLabel: 'Requests', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔄</Text> }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesNavigator}
        options={{ tabBarLabel: 'Messages', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
