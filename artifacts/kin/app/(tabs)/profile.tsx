import { Feather } from "@expo/vector-icons";
import {
  useGetMe, useAddPhoto,
  usePauseProfile,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation, changeLanguage, getCurrentLanguage, type SupportedLanguage } from "@workspace/i18n";
import { supabase } from "@/lib/supabase";

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

  // IMPORTANT: don’t call /api/me until the auth token is restored.
  // Without this, web reloads can fire an unauthenticated request and crash the UI.
  const { token, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading, refetch } = useGetMe({
    query: { enabled: !authLoading && !!token },
  } as any);

  const { mutate: addPhoto } = useAddPhoto();
  const { mutate: pauseProfile, isPending: isPausing } = usePauseProfile({
    mutation: { onSuccess: () => refetch() },
  });

  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setCurrentLang(lang);
    try {
      await AsyncStorage.setItem('@kin_language', lang);
    } catch {}
    if (profile?.id) {
      try {
        await supabase.from('profiles').update({ language: lang }).eq('id', profile.id);
      } catch {}
    }
  };

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
        <Text style={styles.headerTitle}>{t('profile.tabTitle')}</Text>
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
                  <Text style={styles.vouchText}>{t('profile.urStudentVerified')}</Text>
                  {profile?.campusName && (
                    <Text style={styles.vouchDim}> · {profile.campusName}</Text>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.goldDot} />
                  <Text style={styles.vouchText}>{t('profile.verifiedMember')}</Text>
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
          <Text style={styles.sectionLabel}>{t('profile.photos')}</Text>
          <PhotoGrid slots={photoSlots} onChange={handlePhotoGridChange} />
        </View>

        {/* Invite link card */}
        <View style={styles.trustCard}>
          <View style={styles.trustHeaderRow}>
            <Text style={styles.trustLabel}>{t('profile.inviteLink')}</Text>
            <Text style={styles.trustBadge}>
              {t('profile.invitedCount', { count: String((profile as any)?.invite_count ?? profile?.vouchCount ?? 0) })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: "row",
                gap: 6,
                backgroundColor: Colors.trust,
                paddingVertical: 12,
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={async () => {
                const link = (profile as any)?.invite_link ?? `https://kin.rw/invite/${(profile as any)?.invite_code ?? "KIN"}`;
                try {
                  await Share.share({
                    message: t("profile.shareInviteMessage", { link }),
                    url: link,
                  });
                } catch {}
              }}
              activeOpacity={0.85}
            >
              <Feather name="share-2" size={15} color={Colors.bone} />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.bone }}>{t('profile.shareInvite')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label={t('profile.statsInvites')} value={String((profile as any)?.invite_count ?? profile?.vouchCount ?? 0)} />
          <View style={styles.statDivider} />
          <StatBox label={t('profile.statsTokens')} value={String(profile?.tokensRemaining ?? 0)} gold />
          <View style={styles.statDivider} />
          <StatBox label={t('profile.statsIntent')} value={profile?.primaryIntent ?? "—"} />
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.settings')}</Text>

          {/* Language Switch */}
          <View style={styles.actionRow}>
            <Feather name="globe" size={18} color={Colors.bone} />
            <Text style={styles.actionText}>{t('profile.language')}</Text>
            <View style={styles.langToggleContainer}>
              <TouchableOpacity
                onPress={() => handleLanguageChange('en')}
                style={[styles.langToggleBtn, currentLang === 'en' && styles.langToggleBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.langToggleText, currentLang === 'en' && styles.langToggleTextActive]}>
                  {t('profile.languageEn')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleLanguageChange('rw')}
                style={[styles.langToggleBtn, currentLang === 'rw' && styles.langToggleBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.langToggleText, currentLang === 'rw' && styles.langToggleTextActive]}>
                  {t('profile.languageRw')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => pauseProfile({ data: { paused: !isPaused } })}
            disabled={isPausing}
            activeOpacity={0.8}
          >
            <Feather name={isPaused ? "play" : "pause"} size={18} color={Colors.bone} />
            <Text style={styles.actionText}>{isPaused ? t('profile.resumeProfile') : t('profile.pauseProfile')}</Text>
            {isPausing && <ActivityIndicator size="small" color={Colors.boneDim} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push("/(onboarding)/invite")}
            activeOpacity={0.8}
          >
            <Feather name="user-plus" size={18} color={Colors.bone} />
            <Text style={styles.actionText}>{t('profile.inviteFriends')}</Text>
            <Feather name="chevron-right" size={16} color={Colors.boneGhost} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { borderColor: Colors.danger + "44" }]}
            onPress={signOut}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={Colors.danger} />
            <Text style={[styles.actionText, { color: Colors.danger }]}>{t('profile.signOut')}</Text>
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
  trustChainBadge: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             5,
    backgroundColor: Colors.inkRaised,
    borderColor:     Colors.trustDim,
    borderWidth:     1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius:    8,
    alignSelf:       "flex-start",
    marginTop:       4,
  },
  trustChainText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   12,
    color:      Colors.bone,
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
  langToggleContainer: {
    flexDirection:   "row",
    backgroundColor: Colors.night,
    borderRadius:    20,
    padding:         3,
    borderWidth:     1,
    borderColor:     Colors.divider,
    gap:             2,
  },
  langToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      16,
  },
  langToggleBtnActive: {
    backgroundColor: Colors.trust,
  },
  langToggleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   12,
    color:      Colors.boneDim,
  },
  langToggleTextActive: {
    color:      Colors.bone,
  },
});
