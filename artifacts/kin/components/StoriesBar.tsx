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
  viewsCount?: number;
  createdAt: string;
}

interface StoryGroup {
  userId: string;
  isOwn?: boolean;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  facultyFlair: string | null;
  stories: StoryItem[];
}

interface StoryViewerItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  campus: string | null;
  isVerified: boolean;
  viewedAt: string;
}

interface HighlightAlbum {
  category: string;
  coverUrl: string | null;
  items: StoryItem[];
}

const HIGHLIGHT_CATEGORIES = ["☕ Cafes", "🌊 Trips", "🎓 Campus", "👗 Style"];

export function StoriesBar() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [highlights, setHighlights] = useState<HighlightAlbum[]>([]);
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("Kigali");
  const [posting, setPosting] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerItem[]>([]);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const fetchStories = useCallback(async () => {
    if (!token) return;
    try {
      const [sRes, hRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/stories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBaseUrl}/api/stories/highlights`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        if (Array.isArray(d)) setGroups(d);
      }
      if (hRes.ok) {
        const hd = await hRes.json();
        if (Array.isArray(hd?.albums)) setHighlights(hd.albums);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const currentStory = activeGroup?.stories[storyIdx];

  useEffect(() => {
    if (!token || !currentStory || activeGroup?.isOwn) return;
    fetch(`${apiBaseUrl}/api/stories/${currentStory.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [token, currentStory?.id, activeGroup?.isOwn]);

  async function handleOpenViewers() {
    if (!token || !currentStory) return;
    setViewersOpen(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/stories/${currentStory.id}/viewers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setViewers(Array.isArray(d?.viewers) ? d.viewers : []);
      }
    } catch {}
  }

  async function handlePinHighlight(category: string) {
    if (!token || !currentStory) return;
    await fetch(`${apiBaseUrl}/api/stories/${currentStory.id}/highlight`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category }),
    }).catch(() => {});
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    fetchStories();
  }

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
    if (!token || !activeGroup || !currentStory) return;
    await fetch(`${apiBaseUrl}/api/stories/${currentStory.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageText: replyText.trim(), giftType }),
    }).catch(() => {});
    setReplyText("");
    setActiveGroup(null);
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 12 }}
        style={{ flexGrow: 0 }}
      >
        <TouchableOpacity
          onPress={() => setAddOpen(true)}
          style={{ alignItems: "center", gap: 4 }}
          activeOpacity={0.85}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: Colors.inkRaised,
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
              setViewersOpen(false);
            }}
            style={{ alignItems: "center", gap: 4 }}
            activeOpacity={0.85}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                padding: 2,
                borderWidth: 2,
                borderColor: "#3FB950",
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

        {highlights.map((alb) => (
          <TouchableOpacity
            key={alb.category}
            onPress={() => {
              setActiveGroup({
                userId: "highlight",
                isOwn: true,
                displayName: alb.category,
                avatarUrl: alb.coverUrl,
                isVerified: true,
                facultyFlair: null,
                stories: alb.items,
              });
              setStoryIdx(0);
              setViewersOpen(false);
            }}
            style={{ alignItems: "center", gap: 4 }}
            activeOpacity={0.85}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                padding: 2,
                borderWidth: 1.5,
                borderColor: Colors.gold,
              }}
            >
              {alb.coverUrl ? (
                <Image source={{ uri: alb.coverUrl }} style={{ width: "100%", height: "100%", borderRadius: 23 }} />
              ) : (
                <View style={{ width: "100%", height: "100%", borderRadius: 23, backgroundColor: Colors.inkRaised }} />
              )}
            </View>
            <Text style={{ color: Colors.gold, fontSize: 10, fontFamily: "Inter_600SemiBold", maxWidth: 56 }} numberOfLines={1}>
              {alb.category}
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

            {activeGroup.isOwn ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleOpenViewers}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#161B22", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}
                  >
                    <Feather name="eye" size={15} color="#38BDF8" />
                    <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                      {currentStory.viewsCount ?? 0}
                    </Text>
                  </TouchableOpacity>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {HIGHLIGHT_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => handlePinHighlight(cat)}
                        style={{ backgroundColor: "#1A1A2E", borderWidth: 1, borderColor: "rgba(201,168,76,0.45)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}
                      >
                        <Text style={{ color: Colors.gold, fontSize: 11, fontFamily: "Inter_700Bold" }}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
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
            )}

            {viewersOpen && (
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#161B22", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "55%" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ color: "#FFF", fontSize: 15, fontFamily: "Inter_700Bold" }}>👁️ {viewers.length}</Text>
                  <TouchableOpacity onPress={() => setViewersOpen(false)}>
                    <Feather name="x" size={20} color={Colors.boneDim} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ gap: 10 }}>
                  {viewers.map((v) => (
                    <View key={v.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {v.avatarUrl ? (
                        <Image source={{ uri: v.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inkRaised }} />
                      )}
                      <View>
                        <Text style={{ color: "#FFF", fontSize: 13, fontFamily: "Inter_700Bold" }}>{v.displayName}</Text>
                        {!!v.campus && <Text style={{ color: Colors.boneDim, fontSize: 11 }}>🎓 {v.campus}</Text>}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </Modal>
    </>
  );
}
