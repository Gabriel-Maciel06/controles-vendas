import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { HomeScreen } from './src/screens/HomeScreen';
import { FunnelScreen } from './src/screens/FunnelScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#172442',
            borderTopColor: 'rgba(255, 255, 255, 0.1)',
            height: 64,
            paddingBottom: 8,
            paddingTop: 6
          },
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700'
          },
          tabBarIcon: ({ color }) => {
            let icon = '📞';
            if (route.name === 'Funil') icon = '🤝';
            if (route.name === 'Cadastrar') icon = '➕';
            return <Text style={{ fontSize: 18, color }}>{icon}</Text>;
          }
        })}
      >
        <Tab.Screen name="Lista" component={HomeScreen} options={{ title: 'Ligações' }} />
        <Tab.Screen name="Funil" component={FunnelScreen} options={{ title: 'Negócios' }} />
        <Tab.Screen name="Cadastrar" component={RegisterScreen} options={{ title: 'Cadastrar' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
