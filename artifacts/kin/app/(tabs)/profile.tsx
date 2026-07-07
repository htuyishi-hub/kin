import { Feather } from "@expo/vector-icons";
import {
  useGetMe, useGetMyPrompts, useAddPhoto,
  usePauseProfile,
} from "@workspace/api-client-react";
import { router } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PhotoGrid, PhotoSlot } from "@/components/PhotoGrid";

const TRUST_LABELS: [number, string][] = [
  [0,  "Building trust"],
  [31, "Growing"],
  [56, "Reliable"],
  [76, "Active & Reliable"],
  [90, "Highly Trusted"],
];

function trustLabel(score: number) {
  let label = TRUST_LABELS[0]![1];
  for (const [threshold, text] of TRUST_LABELS) {
    if (score >= threshold) label = text;
  }
  return label;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const { data: profile, isLoading, refetch } = useGetMe();
  const { data: prompts = [] } = useGetMyPrompts();
  const { mutate: addPhoto } = useAddPhoto();
  const { mutate: pauseProfile, isPending: isPausing } = usePauseProfile({
    mutation: { onSuccess: () => refetch() },
  });

  const [primaryPhotoUrl, setPrimaryPhotoUrl] = useState<string | null>(null);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([
    { id: null, publicUrl: null, storagePath: null, isPrimary: true,  sortOrder: 0 },
    { id: null, publicUrl: null, storagePath: null, isPrimary: false, sortOrder: 1 },
    { id: null, publicUrl: null, storagePath: null, isPrimary: false, sortOrder: 2 },
  ]);

  const tabBarH  = Platform.OS === "ios" ? 80 : 64;
  const paddingT = insets.top + 16;
  const paddingB = tabBarH + insets.bottom + 24;

  const handleAvatarUpload = (publicUrl: string, storagePath: string) => {
    setPrimaryPhotoUrl(publicUrl);
    addPhoto({ data: { publicUrl, storagePath, isPrimary: true } as any });
    setPhotoSlots(prev =>
      prev.map(s => s.sortOrder === 0
        ? { ...s, publicUrl, storagePath }
        : s
      )
    );
  };

  const handlePhotoGridChange = (updated: PhotoSlot[]) => {
    setPhotoSlots(updated);
    const primary = updated.find(s => s.isPrimary && s.publicUrl);
    if (primary) {
      addPhoto({ data: { publicUrl: primary.publicUrl!, storagePath: primary.storagePath!, isPrimary: true } as any });
    }
  };

  const isURVerified = Boolean((profile as any)?.institutionVerified);
  const vouchScore = Math.min(100, (profile?.vouchCount ?? 0) * 30);
  const isPaused = profile?.profilePaused ?? false;




  const initials = profile?.fullName
    ? profile.fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : undefined;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.night }]}>
        <ActivityIndicator color={Colors.trust} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.night }]}
      contentContainerStyle={{ paddingBottom: paddingB }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: paddingT }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push("/(onboarding)/prompts")} activeOpacity={0.8}>
          <Feather name="edit-2" size={20} color={Colors.trust} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Avatar + identity */}
        <View style={styles.identityCard}>
          <AvatarUpload
            currentPhotoUrl={primaryPhotoUrl}
            initials={initials}
            onUploadSuccess={handleAvatarUpload}
            size={120}
          />
          <View style={styles.identityInfo}>
            <Text style={styles.name}>
              {profile?.fullName ?? "—"}{profile?.age ? `, ${profile.age}` : ""}
            </Text>
            <View style={styles.vouchRow}>
              {isURVerified ? (
                <>
                  <View style={[styles.goldDot, { backgroundColor: Colors.trust }]} />
                  <Text style={styles.vouchText}>UR verified</Text>
                  {profile?.campusName && (
                    <Text style={styles.vouchDim}> · {profile.campusName}</Text>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.goldDot} />
                  <Text style={styles.vouchText}>Vouched by {profile?.vouchCount ?? 0}</Text>
                  {profile?.campusName && (
                    <Text style={styles.vouchDim}> · {profile.campusName}</Text>
                  )}
                </>
              )}
            </View>

          </View>
        </View>

        {/* Photo grid */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          <PhotoGrid slots={photoSlots} onChange={handlePhotoGridChange} />
        </View>

        {/* Trust level */}
        <View style={[styles.trustCard]}>
          <View style={styles.trustHeaderRow}>
            <Text style={styles.trustLabel}>Trust level</Text>
            <Text style={styles.trustBadge}>{trustLabel(vouchScore)}</Text>
          </View>
          <View style={styles.trustBarBg}>
            <View style={[styles.trustBarFill, { width: `${vouchScore}%` }]} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Vouches" value={String(profile?.vouchCount ?? 0)} />
          <View style={styles.statDivider} />
          <StatBox label="Tokens" value={String(profile?.tokensRemaining ?? 0)} gold />
          <View style={styles.statDivider} />
          <StatBox label="Intent" value={profile?.primaryIntent ?? "—"} />
        </View>

        {/* Prompts */}
        {prompts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>MY PROMPTS</Text>
              <TouchableOpacity onPress={() => router.push("/(onboarding)/prompts")}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            {prompts.map((p) => (
              <View key={p.id} style={styles.promptCard}>
                <Text style={styles.promptQ}>{p.promptText}</Text>
                <Text style={styles.promptA}>{p.answer}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SETTINGS</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => pauseProfile({ data: { paused: !isPaused } })}
            disabled={isPausing}
            activeOpacity={0.8}
          >
            <Feather name={isPaused ? "play" : "pause"} size={18} color={Colors.bone} />
            <Text style={styles.actionText}>{isPaused ? "Resume profile" : "Pause profile"}</Text>
            {isPausing && <ActivityIndicator size="small" color={Colors.boneDim} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/(onboarding)/vouch")}
            activeOpacity={0.8}
          >
            <Feather name="users" size={18} color={Colors.bone} />
            <Text style={styles.actionText}>Manage vouches</Text>
            <Feather name="chevron-right" size={16} color={Colors.boneGhost} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { borderColor: Colors.danger + "44" }]}
            onPress={signOut}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={Colors.danger} />
            <Text style={[styles.actionText, { color: Colors.danger }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, gold && { color: Colors.gold }]}>{value}</Text>
      <Text style={styles.statLabelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingHorizontal: 20,
    paddingBottom:  16,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   18,
    color:      Colors.bone,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  identityCard: {
    backgroundColor: Colors.ink,
    borderRadius:    24,
    padding:         20,
    flexDirection:   "row",
    alignItems:      "center",
    gap:             16,
  },
  identityInfo: { flex: 1, gap: 8 },
  name: {
    fontFamily: "Fraunces_700Bold",
    fontSize:   22,
    color:      Colors.bone,
    lineHeight: 26,
  },
  vouchRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
  },
  goldDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: Colors.gold,
    marginRight:     5,
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
  section: { gap: 10 },
  sectionLabel: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      11,
    color:         Colors.boneDim,
    letterSpacing: 1,
    marginLeft:    4,
  },
  sectionHeaderRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginLeft:     4,
  },
  editLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   13,
    color:      Colors.trust,
  },
  trustCard: {
    backgroundColor: Colors.ink,
    borderRadius:    16,
    padding:         16,
    gap:             10,
  },
  trustHeaderRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  trustLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   14,
    color:      Colors.bone,
  },
  trustBadge: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      Colors.boneDim,
  },
  trustBarBg: {
    height:          6,
    backgroundColor: Colors.inkRaised,
    borderRadius:    3,
    overflow:        "hidden",
  },
  trustBarFill: {
    height:          6,
    backgroundColor: Colors.trust,
    borderRadius:    3,
  },
  statsRow: {
    backgroundColor: Colors.ink,
    borderRadius:    16,
    flexDirection:   "row",
    overflow:        "hidden",
  },
  stat: {
    flex:           1,
    alignItems:     "center",
    paddingVertical: 16,
    gap:            4,
  },
  statValue: {
    fontFamily: "Fraunces_700Bold",
    fontSize:   20,
    color:      Colors.bone,
  },
  statLabelText: {
    fontFamily: "Inter_400Regular",
    fontSize:   11,
    color:      Colors.boneDim,
  },
  statDivider: {
    width:           1,
    backgroundColor: Colors.divider,
  },
  promptCard: {
    backgroundColor: Colors.ink,
    borderRadius:    14,
    padding:         16,
    gap:             6,
  },
  promptQ: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   13,
    color:      Colors.trust,
  },
  promptA: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      Colors.bone,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             14,
    padding:         16,
    borderRadius:    14,
    backgroundColor: Colors.ink,
    borderWidth:     1,
    borderColor:     Colors.divider,
  },
  actionText: {
    flex:       1,
    fontFamily: "Inter_500Medium",
    fontSize:   15,
    color:      Colors.bone,
  },
});
