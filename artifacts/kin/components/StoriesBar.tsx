import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "@workspace/i18n";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

interface StoryItem {
  id: string;
  mediaUrl: string;
  caption: string | null;
  locationName: string | null;
  createdAt: string;
}

interface StoryGroup {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  facultyFlair: string | null;
  stories: StoryItem[];
}

export function StoriesBar() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("Kigali");
  const [posting, setPosting] = useState(false);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const fetchStories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/stories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d)) setGroups(d);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  async function handlePostStory() {
    if (!token) return;
    setPosting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption: caption.trim(), locationName: locationName.trim() }),
      });
      if (res.ok) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        setAddOpen(false);
        setCaption("");
        await fetchStories();
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleReply(giftType: "rose" | "none") {
    if (!token || !activeGroup) return;
    const current = activeGroup.stories[storyIdx];
    if (!current) return;
    await fetch(`${apiBaseUrl}/api/stories/${current.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageText: replyText.trim(), giftType }),
    }).catch(() => {});
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    setReplyText("");
    setActiveGroup(null);
  }

  const currentStory = activeGroup?.stories[storyIdx];

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}
      >
        <TouchableOpacity onPress={() => setAddOpen(true)} style={{ alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: Colors.ink,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: Colors.gold,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name="plus" size={20} color={Colors.gold} />
          </View>
          <Text style={{ color: Colors.boneDim, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
            {t("stories.addStory")}
          </Text>
        </TouchableOpacity>

        {groups.map((g) => (
          <TouchableOpacity
            key={g.userId}
            onPress={() => {
              setActiveGroup(g);
              setStoryIdx(0);
            }}
            style={{ alignItems: "center", gap: 4 }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                padding: 2,
                borderWidth: 2,
                borderColor: Colors.gold,
              }}
            >
              {g.avatarUrl ? (
                <Image source={{ uri: g.avatarUrl }} style={{ width: "100%", height: "100%", borderRadius: 23 }} />
              ) : (
                <View style={{ width: "100%", height: "100%", borderRadius: 23, backgroundColor: Colors.inkRaised }} />
              )}
            </View>
            <Text style={{ color: Colors.bone, fontSize: 10, fontFamily: "Inter_600SemiBold", maxWidth: 54 }} numberOfLines={1}>
              {g.displayName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#161B22", borderRadius: 20, padding: 20, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: Colors.bone, fontSize: 16, fontFamily: "Inter_700Bold" }}>{t("stories.addStory")}</Text>
              <TouchableOpacity onPress={() => setAddOpen(false)}>
                <Feather name="x" size={20} color={Colors.boneDim} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="..."
              placeholderTextColor={Colors.boneGhost}
              style={{ backgroundColor: Colors.ink, color: Colors.bone, borderRadius: 10, padding: 10, fontSize: 13 }}
            />
            <TextInput
              value={locationName}
              onChangeText={setLocationName}
              placeholder="Kimihurura"
              placeholderTextColor={Colors.boneGhost}
              style={{ backgroundColor: Colors.ink, color: Colors.bone, borderRadius: 10, padding: 10, fontSize: 13 }}
            />
            <TouchableOpacity
              onPress={handlePostStory}
              disabled={posting}
              style={{ backgroundColor: Colors.gold, paddingVertical: 12, borderRadius: 999, alignItems: "center" }}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#0D1117" />
              ) : (
                <Text style={{ color: "#0D1117", fontSize: 13, fontFamily: "Inter_700Bold" }}>{t("stories.postCta")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(activeGroup && currentStory)} animationType="slide" onRequestClose={() => setActiveGroup(null)}>
        {activeGroup && currentStory && (
          <View style={{ flex: 1, backgroundColor: "#000", paddingTop: 48, paddingBottom: 24, paddingHorizontal: 16, justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" }}>{activeGroup.displayName}</Text>
                {!!currentStory.locationName && (
                  <Text style={{ color: "#CBD5E1", fontSize: 12 }}>📍 {currentStory.locationName}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setActiveGroup(null)}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.95}
              style={{ flex: 1, marginVertical: 12, borderRadius: 16, overflow: "hidden", justifyContent: "center" }}
              onPress={() => {
                if (storyIdx + 1 < activeGroup.stories.length) setStoryIdx(storyIdx + 1);
                else setActiveGroup(null);
              }}
            >
              <Image source={{ uri: currentStory.mediaUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              {!!currentStory.caption && (
                <View style={{ position: "absolute", bottom: 16, left: 16, right: 16, backgroundColor: "rgba(0,0,0,0.65)", padding: 10, borderRadius: 12 }}>
                  <Text style={{ color: "#FFF", textAlign: "center", fontSize: 14 }}>{currentStory.caption}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder={t("stories.replyPlaceholder")}
                placeholderTextColor={Colors.boneGhost}
                style={{ flex: 1, backgroundColor: Colors.ink, color: Colors.bone, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 }}
              />
              <TouchableOpacity
                onPress={() => handleReply("rose")}
                style={{ backgroundColor: "#FF6B6B", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 }}
              >
                <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" }}>{t("stories.sendRose")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleReply("none")}
                style={{ backgroundColor: Colors.trust, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" }}
              >
                <Feather name="send" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
}
