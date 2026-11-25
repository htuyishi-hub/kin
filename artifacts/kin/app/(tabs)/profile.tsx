import { Feather } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import {
  useGetMe, useAddPhoto,
  usePauseProfile,
  useUpdateProfileExtras,
  useUpdateMe,
  useUploadVoiceIntro,
  useDeleteVoiceIntro,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { uploadVoiceIntroFile, resolveAudioUrl, getVoiceSignedUrl } from "@/services/voiceIntroService";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
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

const ALL_TAGS = [
  "faith", "family", "career", "education", "business",
  "travel", "music", "football", "humor", "kindness",
  "honesty", "ambition", "nature", "cooking", "reading",
  "art", "fitness", "technology", "community", "culture",
];
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

function ProfileVoiceSection({
  voiceIntroPath,
  voiceIntroDurationMs,
  userId,
  onRefetch,
}: {
  voiceIntroPath?: string | null;
  voiceIntroDurationMs?: number | null;
  userId: string;
  onRefetch: () => void;
}) {
  const { t } = useTranslation();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const { mutate: uploadVoiceIntro, isPending: isSavingVoice } = useUploadVoiceIntro({
    mutation: {
      onSuccess: () => {
        setIsUploading(false);
        setVoiceError(null);
        onRefetch();
      },
      onError: (err: any) => {
        setIsUploading(false);
        const errCode = err?.code || err?.response?.data?.code || err?.data?.code;
        if (errCode === "VOICE_INTRO_TOO_LONG") {
          setVoiceError(t("errors.voiceTooLong"));
        } else if (errCode === "VOICE_INTRO_TOO_SHORT") {
          setVoiceError(t("errors.voiceTooShort"));
        } else {
          setVoiceError(t("errors.generic"));
        }
      },
    },
  });

  const { mutate: deleteVoice, isPending: isDeletingVoice } = useDeleteVoiceIntro({
    mutation: {
      onSuccess: () => {
        setVoiceError(null);
        onRefetch();
      },
      onError: () => {
        setVoiceError(t("errors.generic"));
      },
    },
  });

  const [audioUri, setAudioUri] = useState<string | null>(() => {
    if (!voiceIntroPath) return null;
    if (voiceIntroPath.startsWith("http://") || voiceIntroPath.startsWith("https://")) return voiceIntroPath;
    return resolveAudioUrl(voiceIntroPath);
  });

  const loadAudio = async (forceRefresh = false) => {
    if (!voiceIntroPath) {
      setAudioUri(null);
      return;
    }
    if (voiceIntroPath.startsWith("http://") || voiceIntroPath.startsWith("https://")) {
      setAudioUri(voiceIntroPath);
      return;
    }
    const signed = await getVoiceSignedUrl("me", forceRefresh);
    if (signed) setAudioUri(signed);
  };

  useEffect(() => {
    loadAudio();
  }, [voiceIntroPath]);

  const player = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(player);
  const isPlaying = Boolean(playerStatus.playing);

  const handleTogglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (!audioUri) {
        loadAudio(true).then(() => player.play());
      } else {
        player.play();
      }
    }
  };

  const handleStartRecording = async () => {
    setVoiceError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setVoiceError(t("errors.micPermission"));
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setVoiceError(t("errors.micPermission"));
    }
  };

  const handleStopRecording = async () => {
    try {
      await recorder.stop();
      const durMs = Math.round(recorderState.durationMillis || (recorder.currentTime * 1000));
      if (durMs < 1000) {
        setVoiceError(t("errors.voiceTooShort"));
        return;
      }
      if (durMs > 20000) {
        setVoiceError(t("errors.voiceTooLong"));
        return;
      }
      setIsUploading(true);
      const uri = recorder.uri;
      if (!uri) {
        setVoiceError(t("errors.generic"));
        setIsUploading(false);
        return;
      }
      const res = await uploadVoiceIntroFile(userId, uri);
      if (!res.success) {
        if (res.error === "VOICE_INTRO_TOO_SHORT") {
          setVoiceError(t("errors.voiceTooShort"));
        } else if (res.error === "VOICE_INTRO_TOO_LONG") {
          setVoiceError(t("errors.voiceTooLong"));
        } else {
          setVoiceError(t("errors.generic"));
        }
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
      onRefetch();
    } catch {
      setVoiceError(t("errors.generic"));
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= 30000) {
      handleStopRecording();
    }
  }, [recorderState.isRecording, recorderState.durationMillis]);

  const hasVoice = Boolean(voiceIntroPath);
  const isBusy = isUploading || isSavingVoice || isDeletingVoice;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>{t("profile.voiceIntroTitle")}</Text>
        <Text style={styles.sectionCounter}>{t("profile.voiceLimit")}</Text>
      </View>

      {hasVoice ? (
        <View style={styles.voiceControlsRow}>
          <TouchableOpacity
            style={styles.voicePlayBtn}
            onPress={handleTogglePlay}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={16} color={Colors.bone} />
            <Text style={styles.voicePlayBtnText}>
              {isPlaying ? t("profile.pauseVoice") : t("profile.playVoice")}
            </Text>
          </TouchableOpacity>

          <View style={styles.voiceDurationBadge}>
            <Text style={styles.voiceDurationBadgeText}>
              {t("profile.voiceDuration", {
                seconds: Math.max(1, Math.round((voiceIntroDurationMs || 5000) / 1000)),
              })}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.voiceDeleteBtn}
            onPress={() => deleteVoice()}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            {isDeletingVoice ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <Feather name="trash-2" size={16} color={Colors.danger} />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.voiceRecordArea}>
          {recorderState.isRecording ? (
            <View style={styles.recordingActiveRow}>
              <View style={styles.recordingPulseDot} />
              <Text style={styles.recordingTimerText}>
                {Math.round(recorderState.durationMillis / 1000)}s / 30s
              </Text>
              <TouchableOpacity
                style={styles.voiceStopBtn}
                onPress={handleStopRecording}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Feather name="square" size={14} color={Colors.bone} />
                <Text style={styles.voiceStopBtnText}>{t("profile.stopRecording")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.voiceRecordBtn}
              onPress={handleStartRecording}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={Colors.bone} />
              ) : (
                <>
                  <Feather name="mic" size={16} color={Colors.bone} />
                  <Text style={styles.voiceRecordBtnText}>{t("profile.recordVoice")}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {voiceError && <Text style={styles.extrasErrorText}>{voiceError}</Text>}
    </View>
  );
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

  const { mutate: updateMe } = useUpdateMe();
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(false);
  const [hideFromPeople, setHideFromPeople] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>("unverified");
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyingSelfie, setVerifyingSelfie] = useState(false);
  const [blockedContacts, setBlockedContacts] = useState<{ id: string; blockedPhone: string }[]>([]);
  const [blockPhoneInput, setBlockPhoneInput] = useState("");
  const [blockingPhone, setBlockingPhone] = useState(false);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/contacts/blocked`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.contacts)) setBlockedContacts(d.contacts);
      })
      .catch(() => {});
  }, [token]);

  const handleBlockPhone = async () => {
    if (!token || !blockPhoneInput.trim()) return;
    setBlockingPhone(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber: blockPhoneInput.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setBlockedContacts(Array.isArray(d.contacts) ? d.contacts : []);
        setBlockPhoneInput("");
      }
    } finally {
      setBlockingPhone(false);
    }
  };

  const handleUnblockPhone = async (id: string) => {
    if (!token) return;
    setBlockedContacts((prev) => prev.filter((c) => c.id !== id));
    fetch(`${apiBaseUrl}/api/contacts/block/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selectedContactPhones, setSelectedContactPhones] = useState<Record<string, boolean>>({});
  const [contactSearch, setContactSearch] = useState("");
  const [isFreeTonight, setIsFreeTonight] = useState(false);
  const [passportCity, setPassportCity] = useState<string | null>(null);

  const handleToggleFreeTonight = async () => {
    if (!token) return;
    const next = !isFreeTonight;
    setIsFreeTonight(next);
    fetch(`${apiBaseUrl}/api/me/free-tonight`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isFreeTonight: next }),
    }).catch(() => {});
  };

  const handleActivatePassport = async (city: string) => {
    if (!token) return;
    const res = await fetch(`${apiBaseUrl}/api/me/passport`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ city }),
    });
    if (res.ok) {
      setPassportCity(city);
    }
  };

  const handleOpenContactPicker = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") return;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      const list: { id: string; name: string; phone: string }[] = [];
      for (const c of data || []) {
        const num = c.phoneNumbers?.[0]?.number;
        if (num) {
          list.push({ id: c.id ?? num, name: c.name || num, phone: num });
        }
      }
      setPhoneContacts(list);
      setSelectedContactPhones({});
      setContactSearch("");
      setContactPickerOpen(true);
    } catch {}
  };

  const handleBlockSelectedContacts = async () => {
    if (!token) return;
    const phones = Object.entries(selectedContactPhones)
      .filter(([, checked]) => checked)
      .map(([phone]) => phone);
    if (phones.length === 0) return;
    setBlockingPhone(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts/block-bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumbers: phones }),
      });
      if (res.ok) {
        const listRes = await fetch(`${apiBaseUrl}/api/contacts/blocked`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (listRes.ok) {
          const d = await listRes.json();
          if (Array.isArray(d.contacts)) setBlockedContacts(d.contacts);
        }
        setContactPickerOpen(false);
      }
    } finally {
      setBlockingPhone(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setReadReceiptsEnabled(Boolean((profile as any).readReceiptsEnabled));
      setHideFromPeople(Boolean((profile as any).hideFromPeople));
      setIsIncognito(Boolean((profile as any).isIncognito));
      setVerificationStatus((profile as any).verificationStatus ?? ((profile as any).isVerified ? "verified" : "unverified"));
    }
  }, [profile]);

  const handleToggleIncognito = async () => {
    if (!token) return;
    const nextVal = !isIncognito;
    setIsIncognito(nextVal);
    try {
      const res = await fetch(`${apiBaseUrl}/api/me/privacy`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isIncognito: nextVal }),
      });
      if (res.ok) {
        refetch();
      } else {
        setIsIncognito(!nextVal);
      }
    } catch {
      setIsIncognito(!nextVal);
    }
  };

  const handleVerifySelfie = async () => {
    if (!token) return;
    setVerifyingSelfie(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/me/verify-selfie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selfieUrl: primaryPhotoUrl ?? "selfie_verified" }),
      });
      if (res.ok) {
        setVerificationStatus("verified");
        setVerifyModalOpen(false);
        refetch();
      }
    } finally {
      setVerifyingSelfie(false);
    }
  };

  const handleToggleReadReceipts = async () => {
    const nextVal = !readReceiptsEnabled;
    setReadReceiptsEnabled(nextVal);
    updateMe(
      { data: { readReceiptsEnabled: nextVal } },
      {
        onSuccess: () => refetch(),
        onError: () => setReadReceiptsEnabled(!nextVal),
      }
    );
  };

  const handleToggleHideFromPeople = async () => {
    const nextVal = !hideFromPeople;
    setHideFromPeople(nextVal);
    updateMe(
      { data: { hideFromPeople: nextVal } },
      {
        onSuccess: () => refetch(),
        onError: () => setHideFromPeople(!nextVal),
      }
    );
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

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bioText, setBioText] = useState("");
  const [isExtrasInitialized, setIsExtrasInitialized] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [extrasSuccess, setExtrasSuccess] = useState(false);

  useEffect(() => {
    if (profile && !isExtrasInitialized) {
      if ((profile as any).tags) setSelectedTags((profile as any).tags);
      if ((profile as any).bio) setBioText((profile as any).bio);
      setIsExtrasInitialized(true);
    }
  }, [profile, isExtrasInitialized]);

  const { mutate: updateExtras, isPending: isUpdatingExtras } = useUpdateProfileExtras({
    mutation: {
      onSuccess: () => {
        setExtrasSuccess(true);
        setExtrasError(null);
        refetch();
        setTimeout(() => setExtrasSuccess(false), 2000);
      },
      onError: (err: any) => {
        setExtrasSuccess(false);
        const errCode = err?.code || err?.response?.data?.code || err?.data?.code;
        if (errCode === "BIO_CONTACT_INFO") {
          setExtrasError(t("errors.bioContactInfo"));
        } else if (errCode === "TOO_MANY_EDITS") {
          setExtrasError(t("errors.tooManyEdits"));
        } else if (errCode === "TAGS_LIMIT_EXCEEDED") {
          setExtrasError(t("errors.tagsLimitExceeded"));
        } else {
          setExtrasError(t("errors.generic"));
        }
      },
    },
  });

  const toggleTag = (tag: string) => {
    setExtrasError(null);
    setExtrasSuccess(false);
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= 5) {
        setExtrasError(t("errors.tagsLimitExceeded"));
        return;
      }
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleSaveExtras = () => {
    setExtrasError(null);
    setExtrasSuccess(false);
    updateExtras({
      data: {
        bio: bioText.trim() || null,
        tags: selectedTags,
      },
    });
  };

  const handleClearExtras = () => {
    setExtrasError(null);
    setExtrasSuccess(false);
    setBioText("");
    setSelectedTags([]);
    updateExtras({
      data: {
        bio: null,
        tags: [],
      },
    });
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

        {/* Tags */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>{t('profile.tagsTitle')}</Text>
            <Text style={styles.sectionCounter}>{selectedTags.length}/5</Text>
          </View>
          <View style={styles.tagChipsContainer}>
            {ALL_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChipSelectable, isSelected && styles.tagChipSelected]}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagChipSelectableText, isSelected && styles.tagChipSelectedText]}>
                    {t(`tags.${tag}`, { defaultValue: tag })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>{t('profile.bioTitle')}</Text>
            <Text style={styles.sectionCounter}>{bioText.length}/140</Text>
          </View>
          <TextInput
            style={styles.bioInput}
            value={bioText}
            onChangeText={(text) => {
              setBioText(text);
              setExtrasError(null);
              setExtrasSuccess(false);
            }}
            placeholder={t('profile.bioPlaceholder')}
            placeholderTextColor={Colors.boneDim}
            maxLength={140}
            multiline
            numberOfLines={3}
          />

          {extrasError && (
            <Text style={styles.extrasErrorText}>{extrasError}</Text>
          )}

          {extrasSuccess && (
            <Text style={styles.extrasSuccessText}>{t('profile.saved')}</Text>
          )}

          <View style={styles.extrasButtonsRow}>
            <TouchableOpacity
              style={[styles.saveExtrasBtn, isUpdatingExtras && { opacity: 0.6 }]}
              onPress={handleSaveExtras}
              disabled={isUpdatingExtras}
              activeOpacity={0.8}
            >
              {isUpdatingExtras ? (
                <ActivityIndicator size="small" color={Colors.bone} />
              ) : (
                <Text style={styles.saveExtrasBtnText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.clearExtrasBtn, isUpdatingExtras && { opacity: 0.6 }]}
              onPress={handleClearExtras}
              disabled={isUpdatingExtras}
              activeOpacity={0.8}
            >
              <Text style={styles.clearExtrasBtnText}>{t('profile.clearExtras')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice Intro Card */}
        <ProfileVoiceSection
          voiceIntroPath={(profile as any)?.voiceIntroPath}
          voiceIntroDurationMs={(profile as any)?.voiceIntroDurationMs}
          userId={profile?.id ?? ""}
          onRefetch={refetch}
        />

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

          {/* Read Receipts Switch */}
          <View style={styles.actionRow}>
            <Feather name="check-circle" size={18} color={Colors.bone} />
            <Text style={styles.actionText}>{t('profile.readReceipts')}</Text>
            <TouchableOpacity
              onPress={handleToggleReadReceipts}
              style={[styles.receiptToggleTrack, readReceiptsEnabled && styles.receiptToggleTrackActive]}
              activeOpacity={0.8}
            >
              <View style={[styles.receiptToggleThumb, readReceiptsEnabled && styles.receiptToggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {/* Hide from People Switch */}
          <View style={styles.actionRow}>
            <Feather name="eye-off" size={18} color={Colors.bone} />
            <Text style={styles.actionText}>{t('profile.hideFromPeople')}</Text>
            <TouchableOpacity
              onPress={handleToggleHideFromPeople}
              style={[styles.receiptToggleTrack, hideFromPeople && styles.receiptToggleTrackActive]}
              activeOpacity={0.8}
            >
              <View style={[styles.receiptToggleThumb, hideFromPeople && styles.receiptToggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {/* Free Tonight Switch */}
          <View style={styles.actionRow}>
            <Feather name="moon" size={18} color="#3FB950" />
            <Text style={styles.actionText}>{t('deck.freeTonight')}</Text>
            <TouchableOpacity
              onPress={handleToggleFreeTonight}
              style={[styles.receiptToggleTrack, isFreeTonight && styles.receiptToggleTrackActive]}
              activeOpacity={0.8}
            >
              <View style={[styles.receiptToggleThumb, isFreeTonight && styles.receiptToggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {/* Weekend Travel Passport (200 RWF) */}
          <View style={{ backgroundColor: Colors.inkRaised, borderRadius: 14, padding: 12, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: Colors.bone, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{t('passport.title')}</Text>
              {passportCity && (
                <Text style={{ color: "#38BDF8", fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  {t('passport.activeIn', { city: passportCity })}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["Rubavu", "Musanze", "Huye"].map((city) => (
                <TouchableOpacity
                  key={city}
                  onPress={() => handleActivatePassport(city)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: passportCity === city ? Colors.gold : Colors.ink,
                  }}
                >
                  <Text style={{ color: passportCity === city ? "#0D1117" : Colors.bone, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Incognito Mode Switch */}
          <View style={styles.actionRow}>
            <Feather name="shield" size={18} color={Colors.gold} />
            <Text style={styles.actionText}>{t('trust.incognito')}</Text>
            <TouchableOpacity
              onPress={handleToggleIncognito}
              style={[styles.receiptToggleTrack, isIncognito && styles.receiptToggleTrackActive]}
              activeOpacity={0.8}
            >
              <View style={[styles.receiptToggleThumb, isIncognito && styles.receiptToggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {/* Selfie Verification */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              if (verificationStatus !== "verified") {
                setVerifyModalOpen(true);
              }
            }}
            disabled={verificationStatus === "verified"}
            activeOpacity={0.8}
          >
            <Feather name="check-square" size={18} color={verificationStatus === "verified" ? "#38BDF8" : Colors.bone} />
            <Text style={[styles.actionText, verificationStatus === "verified" && { color: "#38BDF8" }]}>
              {verificationStatus === "verified" ? t('trust.verified') : t('trust.getVerified')}
            </Text>
          </TouchableOpacity>

          <Modal
            visible={verifyModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setVerifyModalOpen(false)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 }}>
              <View style={{ width: "100%", backgroundColor: "#161B22", borderRadius: 20, padding: 20, gap: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: Colors.bone, fontSize: 17, fontFamily: "Inter_700Bold" }}>
                    {t('trust.getVerified')}
                  </Text>
                  <TouchableOpacity onPress={() => setVerifyModalOpen(false)}>
                    <Feather name="x" size={20} color={Colors.boneDim} />
                  </TouchableOpacity>
                </View>
                <View style={{ alignItems: "center", paddingVertical: 16, gap: 10 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(56,189,248,0.15)", justifyContent: "center", alignItems: "center" }}>
                    <Feather name="camera" size={32} color="#38BDF8" />
                  </View>
                  <Text style={{ color: Colors.boneDim, fontSize: 14, fontFamily: "Inter_500Medium" }}>
                    {t('trust.smileCamera')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleVerifySelfie}
                  disabled={verifyingSelfie}
                  style={{ backgroundColor: "#38BDF8", paddingVertical: 13, borderRadius: 999, alignItems: "center" }}
                  activeOpacity={0.85}
                >
                  {verifyingSelfie ? (
                    <ActivityIndicator size="small" color="#0D1117" />
                  ) : (
                    <Text style={{ color: "#0D1117", fontSize: 14, fontFamily: "Inter_700Bold" }}>
                      {t('trust.verifyNow')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Hide Friends & Block Contacts */}
          <View style={{ backgroundColor: Colors.inkRaised, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="user-x" size={16} color={Colors.gold} />
              <Text style={{ color: Colors.bone, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                {t('contacts.title')}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={blockPhoneInput}
                onChangeText={setBlockPhoneInput}
                placeholder={t('contacts.placeholder')}
                placeholderTextColor={Colors.boneGhost}
                keyboardType="phone-pad"
                style={{
                  flex: 1,
                  backgroundColor: Colors.ink,
                  color: Colors.bone,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 13,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              />
              <TouchableOpacity
                onPress={handleBlockPhone}
                disabled={blockingPhone || !blockPhoneInput.trim()}
                style={{
                  backgroundColor: Colors.gold,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  justifyContent: "center",
                  opacity: blockingPhone || !blockPhoneInput.trim() ? 0.5 : 1,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: "#0D1117", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                  {t('contacts.block')}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handleOpenContactPicker}
              style={{
                backgroundColor: "rgba(37,99,235,0.18)",
                borderWidth: 1,
                borderColor: "rgba(56,189,248,0.4)",
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: "center",
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#38BDF8", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                📖 {t('contacts.importButton')}
              </Text>
            </TouchableOpacity>
            {blockedContacts.map((c) => (
              <View
                key={c.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: Colors.ink,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: Colors.bone, fontSize: 12 }}>{c.blockedPhone}</Text>
                <TouchableOpacity onPress={() => handleUnblockPhone(c.id)}>
                  <Text style={{ color: "#FF6B6B", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                    {t('contacts.unblock')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Modal
            visible={contactPickerOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setContactPickerOpen(false)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }}>
              <View style={{ backgroundColor: "#161B22", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%", gap: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: Colors.bone, fontSize: 16, fontFamily: "Inter_700Bold" }}>
                    {t('contacts.title')}
                  </Text>
                  <TouchableOpacity onPress={() => setContactPickerOpen(false)}>
                    <Feather name="x" size={20} color={Colors.boneDim} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={contactSearch}
                  onChangeText={setContactSearch}
                  placeholder={t('search.placeholder')}
                  placeholderTextColor={Colors.boneGhost}
                  style={{
                    backgroundColor: Colors.ink,
                    color: Colors.bone,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontSize: 13,
                  }}
                />
                <FlatList
                  data={phoneContacts.filter(
                    (c) =>
                      !contactSearch.trim() ||
                      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                      c.phone.includes(contactSearch)
                  )}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 340 }}
                  renderItem={({ item }) => {
                    const checked = Boolean(selectedContactPhones[item.phone]);
                    return (
                      <TouchableOpacity
                        onPress={() =>
                          setSelectedContactPhones((prev) => ({
                            ...prev,
                            [item.phone]: !prev[item.phone],
                          }))
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: "rgba(255,255,255,0.06)",
                        }}
                      >
                        <View>
                          <Text style={{ color: Colors.bone, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{item.name}</Text>
                          <Text style={{ color: Colors.boneDim, fontSize: 12 }}>{item.phone}</Text>
                        </View>
                        <Feather
                          name={checked ? "check-square" : "square"}
                          size={20}
                          color={checked ? Colors.gold : Colors.boneDim}
                        />
                      </TouchableOpacity>
                    );
                  }}
                />
                <TouchableOpacity
                  onPress={handleBlockSelectedContacts}
                  disabled={blockingPhone}
                  style={{ backgroundColor: Colors.gold, paddingVertical: 13, borderRadius: 999, alignItems: "center" }}
                >
                  <Text style={{ color: "#0D1117", fontSize: 14, fontFamily: "Inter_700Bold" }}>
                    {t('contacts.blockSelected')} ({Object.values(selectedContactPhones).filter(Boolean).length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

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
  receiptToggleTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.night,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: 2,
    justifyContent: "center",
  },
  receiptToggleTrackActive: {
    backgroundColor: Colors.trust,
    borderColor: Colors.trust,
  },
  receiptToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.boneDim,
  },
  receiptToggleThumbActive: {
    backgroundColor: Colors.bone,
    alignSelf: "flex-end",
  },
  sectionCounter: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.boneDim,
    marginRight: 4,
  },
  tagChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChipSelectable: {
    backgroundColor: Colors.ink,
    borderColor: Colors.divider,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagChipSelected: {
    backgroundColor: Colors.trust,
    borderColor: Colors.trust,
  },
  tagChipSelectableText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.boneDim,
  },
  tagChipSelectedText: {
    color: Colors.bone,
    fontFamily: "Inter_600SemiBold",
  },
  bioInput: {
    backgroundColor: Colors.ink,
    borderColor: Colors.divider,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.bone,
    minHeight: 70,
    textAlignVertical: "top",
  },
  extrasErrorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },
  extrasSuccessText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.trust,
    marginTop: 4,
    marginLeft: 4,
  },
  extrasButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  saveExtrasBtn: {
    flex: 1,
    backgroundColor: Colors.trust,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveExtrasBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.bone,
  },
  clearExtrasBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  clearExtrasBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.boneDim,
  },
  voiceControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  voicePlayBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.trust,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  voicePlayBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.bone,
  },
  voiceDurationBadge: {
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceDurationBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.gold,
  },
  voiceDeleteBtn: {
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.danger + "44",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceRecordArea: {
    marginTop: 6,
  },
  voiceRecordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.inkRaised,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 12,
    paddingVertical: 12,
  },
  voiceRecordBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.bone,
  },
  recordingActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.danger + "55",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recordingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.danger,
  },
  recordingTimerText: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.bone,
  },
  voiceStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  voiceStopBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.bone,
  },
});
