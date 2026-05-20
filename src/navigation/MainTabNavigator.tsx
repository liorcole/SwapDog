import React, { useEffect, useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import {
  MainTabParamList,
  DiscoverStackParamList,
  RequestsStackParamList,
  MessagesStackParamList,
  ProfileStackParamList,
} from './types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useMessaging } from '../hooks/useMessaging';
import AppHeader from '../components/common/AppHeader';

// Discover stack
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import UserDetailScreen from '../screens/discover/UserDetailScreen';
import DogDetailScreen from '../screens/discover/DogDetailScreen';
import CreateSwapScreen from '../screens/booking/CreateSwapScreen';

// Requests stack
import RequestsScreen from '../screens/requests/RequestsScreen';
import PostDetailScreen from '../screens/requests/PostDetailScreen';
import CreatePostScreen from '../screens/booking/CreatePostScreen';
import WriteReviewScreen from '../screens/booking/WriteReviewScreen';

// Messages stack
import ConversationsListScreen from '../screens/messages/ConversationsListScreen';
import ChatScreen from '../screens/messages/ChatScreen';

// Profile stack
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import EditDogScreen from '../screens/profile/EditDogScreen';
import PointsHistoryScreen from '../screens/profile/PointsHistoryScreen';
import ConductStandardsScreen from '../screens/onboarding/ConductStandardsScreen';
import MyAgreementScreen from '../screens/profile/MyAgreementScreen';
import ReferralScreen from '../screens/profile/ReferralScreen';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const RequestsStack = createNativeStackNavigator<RequestsStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const sharedHeaderOptions = {
  header: (props: Parameters<typeof AppHeader>[0]) => <AppHeader {...props} />,
};

const DiscoverNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        ...sharedHeaderOptions,
      }}
    >
      <DiscoverStack.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: '🐾 Discover', headerShown: true }}
      />
      <DiscoverStack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'Profile' }} />
      <DiscoverStack.Screen name="DogDetail" component={DogDetailScreen} options={{ title: 'Dog Profile' }} />
      <DiscoverStack.Screen name="CreateSwap" component={CreateSwapScreen} options={{ title: 'Request Swap', presentation: 'modal' }} />
      <DiscoverStack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post Details' }} />
      <DiscoverStack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'Post a Request', presentation: 'modal' }} />
    </DiscoverStack.Navigator>
  );
};

const RequestsNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <RequestsStack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        ...sharedHeaderOptions,
      }}
    >
      <RequestsStack.Screen name="Requests" component={RequestsScreen} options={{ title: 'My Schedule' }} />
      <RequestsStack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review', presentation: 'modal' }} />
      <RequestsStack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post Details' }} />
      <RequestsStack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'Post a Request', presentation: 'modal' }} />
    </RequestsStack.Navigator>
  );
};

const MessagesNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <MessagesStack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        ...sharedHeaderOptions,
      }}
    >
      <MessagesStack.Screen name="ConversationsList" component={ConversationsListScreen} options={{ title: 'Messages' }} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
    </MessagesStack.Navigator>
  );
};

const ProfileNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        ...sharedHeaderOptions,
      }}
    >
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', headerShown: true }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileStack.Screen
        name="EditDog"
        component={EditDogScreen}
        options={({ route }) => ({
          title: route.params?.dogId ? 'Edit Dog' : 'Add Dog',
        })}
      />
      <ProfileStack.Screen
        name="PointsHistory"
        component={PointsHistoryScreen}
        options={{ title: 'Points History', headerBackTitle: 'Back' }}
      />
      <ProfileStack.Screen
        name="CommunityStandards"
        options={{ title: 'Community Standards', headerBackTitle: 'Back' }}
      >
        {() => <ConductStandardsScreen readOnly />}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="MyAgreement"
        component={MyAgreementScreen}
        options={{ title: 'My Agreement', headerBackTitle: 'Back' }}
      />
      <ProfileStack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{ title: 'Invite a Friend', headerBackTitle: 'Back' }}
      />
      <ProfileStack.Screen
        name="AdminPanel"
        component={AdminPanelScreen}
        options={{ title: '👑 Admin Panel', headerBackTitle: 'Back' }}
      />
    </ProfileStack.Navigator>
  );
};

const MainTabNavigator: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthContext();
  const { subscribeToConversations } = useMessaging();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.uid, (convs) => {
      const total = convs.reduce((sum, c) => sum + (c.unreadCounts[user.uid] ?? 0), 0);
      setUnreadCount(total);
    });
    return unsub;
  }, [user, subscribeToConversations]);

  const MessagesIcon = useCallback(
    ({ color }: { color: string }) => (
      <View style={{ position: 'relative' }}>
        <Text style={{ fontSize: 20, color }}>💬</Text>
        {unreadCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#FF2D55',
              borderWidth: 1.5,
              borderColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 3,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 13 }}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        )}
      </View>
    ),
    [unreadCount, colors.surface],
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
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
        options={{ tabBarLabel: 'Schedule', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📅</Text> }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesNavigator}
        options={{ tabBarLabel: 'Messages', tabBarIcon: MessagesIcon }}
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
