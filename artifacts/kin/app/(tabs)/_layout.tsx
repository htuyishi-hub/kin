import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Feather name={name} size={size} color={color} />;
}

export default function TabLayout() {
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
          title: "Discover",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="compass" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="serious"
        options={{
          title: "Serious",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="star" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="user" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
