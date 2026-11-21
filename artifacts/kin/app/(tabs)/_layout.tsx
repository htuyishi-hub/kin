import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import { useTranslation } from "@workspace/i18n";
import { Colors } from "@/constants/colors";

function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Feather name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  Colors.ink,
          borderTopColor:   Colors.divider,
          borderTopWidth:   1,
          height:           Platform.OS === "ios" ? 80 : 64,
          paddingBottom:    Platform.OS === "ios" ? 24 : 10,
          paddingTop:       8,
          elevation:        0,
        },
        tabBarActiveTintColor:   Colors.trust,
        tabBarInactiveTintColor: Colors.boneGhost,
        tabBarShowLabel:         true,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize:   11,
          marginTop:  2,
        },
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.ink }]} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('discover.tabTitle'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="compass" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('matches.tabTitle'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="serious"
        options={{
          title: t('serious.tabTitle'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="star" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.tabTitle'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="user" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
