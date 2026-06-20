import { useExpressInterest, useGetMatchQueue } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { KLogo } from "@/components/KLogo";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Colors } from "@/constants/colors";

type QueueItem = {
  id: string;
  fullName: string;
  gender: string | null;
  age: number | null;
  campusName: string | null;
  faculty: string | null;
  yearOfStudy: number | null;
  hostelName: string | null;
  city: string | null;
  primaryIntent: string | null;
  vouchCount: number;
  primaryPhotoPath: string | null;
  milieuScore: number;
  vouchOverlap: number;
  microPrompts: { id: string; promptText: string; answer: string }[];
  milieuCards: string[];
};

function IdentityCard({ person }: { person: QueueItem }) {
  const photoHeight   = useSharedValue(0);
  const chevronRotate = useSharedValue(0);
  const [photoOpen, setPhotoOpen] = useState(false);

  const togglePhoto = () => {
    const opening = !photoOpen;
    setPhotoOpen(opening);
    photoHeight.value   = withSpring(opening ? 300 : 0, { damping: 18, stiffness: 180 });
    chevronRotate.value = withSpring(opening ? 180 : 0, { damping: 14, stiffness: 200 });
  };

  const photoStyle = useAnimatedStyle(() => ({
    height:   photoHeight.value,
    opacity:  interpolate(photoHeight.value, [0, 80, 300], [0, 0.4, 1]),
    overflow: 'hidden',
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotate.value}deg` }],
  }));

  const genderLabel = person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : '';

  return (
    <View style={styles.card}>
      {/* Identity row — NAME first, photo below the fold */}
      <View style={styles.cardHeader}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{person.fullName}</Text>
          <View style={styles.agePill}>
            <Text style={styles.ageText}>{person.age ?? '—'}</Text>
          </View>
          {genderLabel ? (
            <Text style={styles.genderText}>{genderLabel}</Text>
          ) : null}
        </View>

        {/* Vouch row */}
        <View style={styles.vouchRow}>
          <View style={styles.goldDot} />
          <Text style={styles.vouchText}>
            Vouched by {person.vouchCount}
          </Text>
          {person.campusName && (
            <Text style={styles.vouchDim}> · {person.campusName}</Text>
          )}
          {person.yearOfStudy && (
            <Text style={styles.vouchDim}> · Year {person.yearOfStudy}</Text>
          )}
        </View>
      </View>

      {/* Shared milieu — most important trust signal */}
      {person.milieuCards.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.milieuBlock}>
            {person.milieuCards.slice(0, 1).map((card, i) => (
              <Text key={i} style={styles.milieuText}>{card}</Text>
            ))}
          </View>
        </>
      )}

      {/* Micro-prompts */}
      {person.microPrompts.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.promptsBlock}>
            {person.microPrompts.slice(0, 2).map((p) => (
              <View key={p.id} style={styles.promptItem}>
                <Text style={styles.promptQ} numberOfLines={1}>{p.promptText}</Text>
                <Text style={styles.promptA}>{p.answer}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Photo reveal — photo comes LAST */}
      <View style={styles.divider} />
      <TouchableOpacity onPress={togglePhoto} activeOpacity={0.8} style={styles.photoRevealRow}>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={14} color={Colors.boneDim} />
        </Animated.View>
        <Text style={styles.seePhotoText}>
          {photoOpen ? 'Hide photo' : 'See photo'}
        </Text>
      </TouchableOpacity>

      <Animated.View style={photoStyle}>
        <ProfilePhoto
          url={person.primaryPhotoPath}
          size={300}
          borderRadius={0}
        />
      </Animated.View>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const { data: queue = [], isLoading, refetch } = useGetMatchQueue(
    {},
    { query: { staleTime: 60_000 } as any },
  );

  const { mutate: expressInterest, isPending: isInteresting } = useExpressInterest({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIndex((i) => i + 1);
      },
    },
  });

  function handlePass() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIndex((i) => i + 1);
  }

  function handleInterest(toUserId: string) {
    expressInterest({ data: { toUserId } });
  }

  const current   = queue[index] as QueueItem | undefined;
  const remaining = queue.length - index;

  const tabBarH  = Platform.OS === "ios" ? 80 : 64;
  const paddingT = insets.top + 16;
  const paddingB = tabBarH + insets.bottom + 16;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.night }]}>
        <ActivityIndicator color={Colors.trust} size="large" />
      </View>
    );
  }

  if (!current || remaining <= 0) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.night, paddingTop: paddingT, paddingBottom: paddingB }]}>
        <KLogo size={40} color={Colors.boneGhost} />
        <Text style={styles.emptyTitle}>You're all caught up</Text>
        <Text style={styles.emptyBody}>New profiles appear as the community grows.</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { setIndex(0); refetch(); }}
          activeOpacity={0.8}
        >
          <Feather name="refresh-cw" size={14} color={Colors.trust} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.night }]}>
      <View style={[styles.header, { paddingTop: paddingT }]}>
        <KLogo size={24} color={Colors.trust} />
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{remaining}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: paddingB }]}
        showsVerticalScrollIndicator={false}
      >
        <IdentityCard person={current} />

        <View style={styles.actions}>
          {/* Pass */}
          <TouchableOpacity
            style={styles.passBtn}
            onPress={handlePass}
            activeOpacity={0.8}
          >
            <Feather name="x" size={22} color={Colors.danger} />
          </TouchableOpacity>

          {/* Not Now (defer) */}
          <TouchableOpacity
            style={styles.notNowBtn}
            onPress={handlePass}
            activeOpacity={0.8}
          >
            <Text style={styles.notNowText}>Not Now</Text>
          </TouchableOpacity>

          {/* Interested */}
          <TouchableOpacity
            style={[styles.interestBtn, { opacity: isInteresting ? 0.7 : 1 }]}
            onPress={() => handleInterest(current.id)}
            disabled={isInteresting}
            activeOpacity={0.85}
          >
            {isInteresting ? (
              <ActivityIndicator color={Colors.bone} size="small" />
            ) : (
              <Feather name="check" size={22} color={Colors.bone} />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  center: {
    flex: 1, justifyContent: "center", alignItems: "center",
    gap: 12, paddingHorizontal: 32,
  },
  header: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingHorizontal: 20,
    paddingBottom:  12,
    gap: 10,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   18,
    color:      Colors.bone,
    flex:       1,
  },
  countBadge: {
    backgroundColor: Colors.inkRaised,
    borderRadius:    10,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  countText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   11,
    color:      Colors.boneDim,
  },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 14 },

  card: {
    backgroundColor: Colors.ink,
    borderRadius:    28,
    overflow:        "hidden",
  },
  cardHeader: {
    padding: 20,
    gap:     10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    flexWrap:      "wrap",
  },
  name: {
    fontFamily: "Fraunces_700Bold",
    fontSize:   22,
    color:      Colors.bone,
    flex:       1,
  },
  agePill: {
    backgroundColor: Colors.inkRaised,
    borderRadius:    8,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  ageText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   14,
    color:      Colors.boneDim,
  },
  genderText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      Colors.boneDim,
  },
  vouchRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
  },
  goldDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
    marginRight:  6,
  },
  vouchText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   13,
    color:      Colors.gold,
  },
  vouchDim: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      Colors.boneDim,
  },
  divider: {
    height:          1,
    backgroundColor: Colors.divider,
    marginHorizontal: 20,
  },
  milieuBlock: {
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  milieuText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      Colors.trust,
    lineHeight: 20,
  },
  promptsBlock: {
    padding: 20,
    gap:     14,
  },
  promptItem: { gap: 4 },
  promptQ: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   12,
    color:      Colors.boneDim,
  },
  promptA: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      Colors.bone,
    lineHeight: 22,
  },
  photoRevealRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical: 12,
  },
  seePhotoText: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      Colors.boneDim,
  },

  actions: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  passBtn: {
    width:          56,
    height:         56,
    borderRadius:   28,
    backgroundColor: Colors.inkRaised,
    justifyContent: "center",
    alignItems:     "center",
  },
  notNowBtn: {
    flex:            1,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.inkRaised,
    justifyContent:  "center",
    alignItems:      "center",
  },
  notNowText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   15,
    color:      Colors.bone,
  },
  interestBtn: {
    width:          56,
    height:         56,
    borderRadius:   28,
    backgroundColor: Colors.trust,
    justifyContent: "center",
    alignItems:     "center",
  },
  emptyTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize:   22,
    color:      Colors.bone,
    textAlign:  "center",
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      Colors.boneDim,
    textAlign:  "center",
    lineHeight: 22,
  },
  refreshBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius:    100,
    borderWidth:     1.5,
    borderColor:     Colors.divider,
    marginTop:       8,
  },
  refreshText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   14,
    color:      Colors.trust,
  },
});
