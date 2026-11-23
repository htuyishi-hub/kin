import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import * as ScreenCapture from "expo-screen-capture";
import { useTranslation } from "@workspace/i18n";
import { Colors } from "../constants/colors";
import { useAuth } from "../contexts/AuthContext";

export type PostItem = {
  id: string;
  authorId: string;
  firstName: string;
  age?: number | null;
  location?: string | null;
  isVerified: boolean;
  text: string;
  photoUrls: string[];
  createdAt: string;
  isLiked: boolean;
  isOwn: boolean;
  likeCount?: number | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function formatRelativeTime(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function PostsFeed({
  apiBaseUrl,
  token,
  userId,
}: {
  apiBaseUrl: string;
  token: string | null;
  userId: string | null;
}) {
  const { t } = useTranslation();

  // Enable screenshot blocking on mobile
  if (Platform.OS !== "web") {
    ScreenCapture.usePreventScreenCapture();
  }

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Context Menu State
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("post");
  const [isReporting, setIsReporting] = useState(false);

  // Fetch feed
  const fetchFeed = useCallback(
    async (cursor?: string | null, isRefresh = false) => {
      if (!token) return;
      try {
        if (isRefresh) setIsRefreshing(true);
        else if (!cursor) setIsLoading(true);

        const url = new URL(`${apiBaseUrl}/api/posts`);
        url.searchParams.set("limit", "10");
        if (cursor) url.searchParams.set("cursor", cursor);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (isRefresh || !cursor) {
            setPosts(data.posts ?? []);
          } else {
            setPosts((prev) => [...prev, ...(data.posts ?? [])]);
          }
          setNextCursor(data.nextCursor ?? null);
        }
      } catch {
        // non-fatal
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [apiBaseUrl, token]
  );

  React.useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Toggle Like
  const handleToggleLike = async (postId: string) => {
    if (!token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const newLiked = !p.isLiked;
        let newLikeCount = p.likeCount;
        if (p.isOwn && p.likeCount !== null && p.likeCount !== undefined) {
          newLikeCount = newLiked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1);
        }
        return {
          ...p,
          isLiked: newLiked,
          likeCount: newLikeCount,
        };
      })
    );

    try {
      const res = await fetch(`${apiBaseUrl}/api/posts/${postId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 429) {
        Alert.alert(t("errors.likeRateLimit"));
        fetchFeed(null, true);
      }
    } catch {
      fetchFeed(null, true);
    }
  };

  // Hide Author
  const handleHideAuthor = async (post: PostItem) => {
    if (!token) return;
    try {
      await fetch(`${apiBaseUrl}/api/posts/${post.id}/hide-author`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Remove all posts by this author locally
      setPosts((prev) => prev.filter((p) => p.authorId !== post.authorId));
      setIsActionModalOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // non-fatal
    }
  };

  // Delete Post
  const handleDeletePost = async (post: PostItem) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setIsActionModalOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // non-fatal
    }
  };

  // Report Post
  const handleReportPost = async () => {
    if (!token || !selectedPost) return;
    setIsReporting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/posts/${selectedPost.id}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reportReason }),
      });
      if (res.ok) {
        setIsReportModalOpen(false);
        setIsActionModalOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("posts.reported"));
      }
    } catch {
      // non-fatal
    } finally {
      setIsReporting(false);
    }
  };

  // Render Post Card
  const renderItem = ({ item }: { item: PostItem }) => {
    const hasPhotos = item.photoUrls && item.photoUrls.length > 0;

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.authorRow}>
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>
                  {item.firstName}
                  {item.age ? `, ${item.age}` : ""}
                </Text>
                {item.isVerified && (
                  <Feather name="check-circle" size={13} color={Colors.trust} style={styles.verifiedIcon} />
                )}
              </View>
              {item.location && <Text style={styles.authorLocation}>{item.location}</Text>}
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedPost(item);
                setIsActionModalOpen(true);
              }}
              style={styles.moreBtn}
            >
              <Feather name="more-horizontal" size={18} color={Colors.boneDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Text */}
        <Text style={styles.postText}>{item.text}</Text>

        {/* Photos (up to 2) */}
        {hasPhotos && (
          <View style={[styles.photoContainer, item.photoUrls.length === 2 && styles.photoGrid]}>
            {item.photoUrls.slice(0, 2).map((url, idx) => (
              <Image
                key={idx}
                source={{ uri: url }}
                style={[styles.postPhoto, item.photoUrls.length === 2 && styles.halfPhoto]}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </View>
        )}

        {/* Footer Actions: Private Likes */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.likeBtn}
            onPress={() => handleToggleLike(item.id)}
            activeOpacity={0.7}
          >
            <Feather
              name="heart"
              size={18}
              color={item.isLiked ? Colors.coral : Colors.boneDim}
              style={item.isLiked ? styles.heartFilled : undefined}
            />
            {/* Viewers never see any count; author sees count ONLY when > 0 */}
            {item.isOwn && typeof item.likeCount === "number" && item.likeCount > 0 && (
              <Text style={styles.likeCount}>{item.likeCount}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <Text style={styles.feedTitle}>{t("posts.title")}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color={Colors.night} />
          <Text style={styles.createBtnText}>{t("posts.createPost")}</Text>
        </TouchableOpacity>
      </View>

      {/* Feed List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.trust} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{t("posts.noPosts")}</Text>
          <TouchableOpacity
            style={[styles.createBtn, { marginTop: 16 }]}
            onPress={() => setIsCreateModalOpen(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color={Colors.night} />
            <Text style={styles.createBtnText}>{t("posts.createPost")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={() => fetchFeed(null, true)}
          onEndReached={() => {
            if (nextCursor) fetchFeed(nextCursor);
          }}
          onEndReachedThreshold={0.4}
        />
      )}

      {/* Action / Context Menu Modal */}
      <Modal
        visible={isActionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsActionModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsActionModalOpen(false)}
        >
          <View style={styles.actionSheet}>
            {selectedPost?.isOwn ? (
              <TouchableOpacity
                style={[styles.actionRow, styles.actionRowDanger]}
                onPress={() => selectedPost && handleDeletePost(selectedPost)}
              >
                <Feather name="trash-2" size={18} color={Colors.coral} />
                <Text style={[styles.actionText, { color: Colors.coral }]}>{t("posts.delete")}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    setIsActionModalOpen(false);
                    setIsReportModalOpen(true);
                  }}
                >
                  <Feather name="flag" size={18} color={Colors.bone} />
                  <Text style={styles.actionText}>{t("posts.report")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => selectedPost && handleHideAuthor(selectedPost)}
                >
                  <Feather name="eye-off" size={18} color={Colors.bone} />
                  <Text style={styles.actionText}>{t("posts.hideAuthor")}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.actionRow, styles.cancelActionRow]}
              onPress={() => setIsActionModalOpen(false)}
            >
              <Text style={styles.cancelText}>{t("matches.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={isReportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsReportModalOpen(false)}
        >
          <View style={styles.reportModal}>
            <Text style={styles.reportTitle}>{t("matches.report")}</Text>
            <View style={styles.reasonList}>
              {[
                { id: "post", label: t("posts.report") },
                { id: "harassment", label: t("matches.reasonHarassment") },
                { id: "inappropriate", label: t("matches.reasonInappropriate") },
                { id: "fake", label: t("matches.reasonFake") },
                { id: "other", label: t("matches.reasonOther") },
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.reasonOption, reportReason === r.id && styles.reasonOptionSelected]}
                  onPress={() => setReportReason(r.id)}
                >
                  <Text
                    style={[
                      styles.reasonOptionText,
                      reportReason === r.id && styles.reasonOptionTextSelected,
                    ]}
                  >
                    {r.label}
                  </Text>
                  {reportReason === r.id && <Feather name="check" size={16} color={Colors.gold} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.reportModalActions}>
              <TouchableOpacity
                style={styles.reportCancelBtn}
                onPress={() => setIsReportModalOpen(false)}
              >
                <Text style={styles.reportCancelText}>{t("matches.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportSubmitBtn}
                onPress={handleReportPost}
                disabled={isReporting}
              >
                {isReporting ? (
                  <ActivityIndicator size="small" color={Colors.night} />
                ) : (
                  <Text style={styles.reportSubmitText}>{t("matches.report")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Post Modal */}
      <CreatePostModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchFeed(null, true);
        }}
        apiBaseUrl={apiBaseUrl}
        token={token}
        userId={userId}
      />
    </View>
  );
}

// =============================================================================
// CREATE POST MODAL COMPONENT
// =============================================================================

function CreatePostModal({
  visible,
  onClose,
  onSuccess,
  apiBaseUrl,
  token,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl: string;
  token: string | null;
  userId: string | null;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setText("");
    setPhotoUris([]);
    setErrorMessage(null);
    setIsSubmitting(false);
  };

  const handlePickPhoto = async () => {
    if (photoUris.length >= 2) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setPhotoUris((prev) => [...prev, res.assets[0].uri].slice(0, 2));
      }
    } catch {
      // non-fatal
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!token || !userId) return;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 200) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const uploadedPaths: string[] = [];

      // Upload and confirm photos
      for (const uri of photoUris) {
        // Compress to JPEG <= 500 KB
        const manip = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Get signed upload URL
        const uploadUrlRes = await fetch(`${apiBaseUrl}/api/posts/media/upload-url`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!uploadUrlRes.ok) {
          const err = await uploadUrlRes.json().catch(() => ({}));
          throw new Error(err.message || "Failed to get upload URL");
        }

        const { uploadUrl, path } = await uploadUrlRes.json();

        // Read binary and upload
        const base64 = await FileSystem.readAsStringAsync(manip.uri, { encoding: "base64" });
        const binary = Uint8Array.from(atob(base64).split("").map((c) => c.charCodeAt(0)));

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: binary,
        });

        if (!putRes.ok) throw new Error("Failed to upload image");

        // Confirm
        const confirmRes = await fetch(`${apiBaseUrl}/api/posts/media/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ path }),
        });

        if (!confirmRes.ok) throw new Error("Failed to confirm image");
        uploadedPaths.push(path);
      }

      // Create post
      const createRes = await fetch(`${apiBaseUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: trimmed,
          photoPaths: uploadedPaths,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (err.code === "POST_CONTACT_INFO") {
          setErrorMessage(t("errors.postContactInfo"));
        } else if (err.code === "POST_DAILY_LIMIT") {
          setErrorMessage(t("errors.postDailyLimit"));
        } else if (err.code === "MAX_ACTIVE_POSTS") {
          setErrorMessage(t("errors.maxActivePosts"));
        } else if (err.code === "POST_TOO_LONG") {
          setErrorMessage(t("errors.postTooLong"));
        } else {
          setErrorMessage(t("errors.generic"));
        }
        setIsSubmitting(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      onSuccess();
    } catch {
      setErrorMessage(t("errors.generic"));
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.createModalContainer}>
        {/* Header */}
        <View style={styles.createModalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.createCancelBtn}>
            <Text style={styles.createCancelText}>{t("matches.cancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.createModalTitle}>{t("posts.newPost")}</Text>
          <TouchableOpacity
            style={[styles.publishBtn, (text.trim().length === 0 || isSubmitting) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={text.trim().length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.night} />
            ) : (
              <Text style={styles.publishBtnText}>{t("posts.publish")}</Text>
            )}
          </TouchableOpacity>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.createModalBody}>
          <TextInput
            style={styles.createInput}
            multiline
            placeholder={t("posts.textPlaceholder")}
            placeholderTextColor={Colors.boneGhost}
            value={text}
            onChangeText={setText}
            maxLength={200}
            autoFocus
          />

          <View style={styles.counterRow}>
            <Text style={styles.counterText}>{text.length}/200</Text>
          </View>

          {/* Photo slots */}
          <View style={styles.photoPickerRow}>
            {photoUris.map((uri, idx) => (
              <View key={idx} style={styles.pickedPhotoWrapper}>
                <Image source={{ uri }} style={styles.pickedPhoto} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => handleRemovePhoto(idx)}
                >
                  <Feather name="x" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}

            {photoUris.length < 2 && (
              <TouchableOpacity
                style={styles.addPhotoSlot}
                onPress={handlePickPhoto}
                activeOpacity={0.7}
              >
                <Feather name="camera" size={20} color={Colors.boneDim} />
                <Text style={styles.addPhotoSlotText}>{t("posts.addPhoto")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.night,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.bone,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  createBtnText: {
    color: Colors.night,
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.boneDim,
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.inkRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorInfo: {
    gap: 2,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.bone,
  },
  verifiedIcon: {
    marginTop: 1,
  },
  authorLocation: {
    fontSize: 11,
    color: Colors.boneGhost,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    color: Colors.boneGhost,
  },
  moreBtn: {
    padding: 4,
  },
  postText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.bone,
  },
  photoContainer: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: "row",
    gap: 6,
  },
  postPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: Colors.ink,
  },
  halfPhoto: {
    flex: 1,
    height: 180,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  heartFilled: {
    transform: [{ scale: 1.05 }],
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.boneDim,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: Colors.inkRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.ink,
  },
  actionRowDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.bone,
  },
  cancelActionRow: {
    marginTop: 4,
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.boneGhost,
    textAlign: "center",
  },
  reportModal: {
    margin: 20,
    backgroundColor: Colors.inkRaised,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.bone,
  },
  reasonList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.ink,
  },
  reasonOptionSelected: {
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  reasonOptionText: {
    fontSize: 13,
    color: Colors.bone,
  },
  reasonOptionTextSelected: {
    fontWeight: "700",
    color: Colors.gold,
  },
  reportModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  reportCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reportCancelText: {
    fontSize: 13,
    color: Colors.boneGhost,
  },
  reportSubmitBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  reportSubmitText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.night,
  },
  createModalContainer: {
    flex: 1,
    backgroundColor: Colors.night,
  },
  createModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  createModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.bone,
  },
  createCancelBtn: {
    padding: 4,
  },
  createCancelText: {
    fontSize: 14,
    color: Colors.boneGhost,
  },
  publishBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
  },
  publishBtnDisabled: {
    opacity: 0.4,
  },
  publishBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.night,
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 68, 68, 0.3)",
  },
  errorBannerText: {
    color: Colors.coral,
    fontSize: 12,
    fontWeight: "600",
  },
  createModalBody: {
    padding: 16,
    gap: 12,
  },
  createInput: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.bone,
    minHeight: 120,
    textAlignVertical: "top",
  },
  counterRow: {
    alignItems: "flex-end",
  },
  counterText: {
    fontSize: 11,
    color: Colors.boneGhost,
  },
  photoPickerRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  pickedPhotoWrapper: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
  },
  pickedPhoto: {
    width: "100%",
    height: "100%",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoSlot: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoSlotText: {
    fontSize: 10,
    color: Colors.boneDim,
  },
});
