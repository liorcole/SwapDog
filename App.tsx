import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import linking from './src/config/linking';
import { RootStackParamList } from './src/navigation/types';
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from './src/services/NotificationService';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    const receivedSub = addNotificationReceivedListener((notification) => {
      // Guard the full chain — content may be undefined for silent/data-only pushes
      console.log('Notification received:', notification?.request?.content?.title);
    });

    const responseSub = addNotificationResponseListener((response) => {
      // Guard every level — content can be undefined for certain push types on Android
      const data = response?.notification?.request?.content?.data as
        | Record<string, string>
        | undefined;
      if (data?.conversationId && navigationRef.current) {
        navigationRef.current.navigate('Main', {
          screen: 'MessagesTab',
          params: {
            screen: 'Chat',
            params: {
              conversationId: data.conversationId,
              otherUserId: data.otherUserId ?? '',
            },
          },
        } as never);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} linking={linking}>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
