import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useChildMedia } from "../../src/api/hooks";
import type { Media } from "../../src/api/types";
import { EmptyState } from "../../src/components/EmptyState";
import { Loading } from "../../src/components/ui";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, spacing } from "../../src/theme";

const { width } = Dimensions.get("window");
const columns = 3;
// Calculate item size with spacing: padding is md (16), gap between items is sm (8)
const itemSize = (width - spacing.md * 2 - spacing.sm * (columns - 1)) / columns;

export default function GalleryScreen() {
  const { t } = useTranslation();
  const { child } = useActiveChild();

  const [page, setPage] = useState(1);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Media | null>(null);

  const [actionLoading, setActionLoading] = useState<"save" | "share" | null>(null);

  const mediaQuery = useChildMedia(child?.id, page);

  useEffect(() => {
    if (mediaQuery.data) {
      setAllMedia((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newItems = mediaQuery.data.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newItems];
      });
    }
  }, [mediaQuery.data]);

  const handleRefresh = async () => {
    setPage(1);
    setAllMedia([]);
    await mediaQuery.refetch();
  };

  const loadMore = () => {
    if (mediaQuery.data && mediaQuery.data.length === 24 && !mediaQuery.isFetching) {
      setPage((p) => p + 1);
    }
  };

  const saveToGallery = async (photo: Media) => {
    if (!photo.url) return;
    try {
      setActionLoading("save");

      // Request media library write permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("gallery.title"), t("gallery.permissionDenied"));
        return;
      }

      // Download the photo to document directory
      const ext = photo.mime.split("/")[1] || "jpg";
      const filename = `child_photo_${photo.id}.${ext}`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      const { uri } = await FileSystem.downloadAsync(photo.url, localUri);

      // Save to device photo library
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t("gallery.title"), t("gallery.saveSuccess"));
    } catch (err) {
      console.error(err);
      Alert.alert(t("gallery.title"), t("gallery.saveError"));
    } finally {
      setActionLoading(null);
    }
  };

  const shareToWhatsApp = async (photo: Media) => {
    if (!photo.url) return;
    try {
      setActionLoading("share");

      // Verify device can share files
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t("gallery.title"), t("gallery.shareError"));
        return;
      }

      // Download the photo to cache directory with proper extension so share sheet handles it as image
      const ext = photo.mime.split("/")[1] || "jpg";
      const filename = `share_photo_${photo.id}.${ext}`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const { uri } = await FileSystem.downloadAsync(photo.url, localUri);

      // Share local file natively (which includes WhatsApp, showing it as a photo)
      await Sharing.shareAsync(uri, {
        mimeType: photo.mime || "image/jpeg",
        dialogTitle: t("gallery.title"),
      });
    } catch (err) {
      console.error(err);
      Alert.alert(t("gallery.title"), t("gallery.shareError"));
    } finally {
      setActionLoading(null);
    }
  };

  const renderThumbnail = ({ item: photo }: { item: Media }) => (
    <Pressable style={styles.thumbnailWrapper} onPress={() => setSelectedPhoto(photo)}>
      <Image
        source={{ uri: photo.url }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={200}
      />
    </Pressable>
  );

  if (mediaQuery.isLoading && allMedia.length === 0) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allMedia}
        renderItem={renderThumbnail}
        keyExtractor={(item) => item.id.toString()}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshing={mediaQuery.isRefetching && page === 1}
        onRefresh={() => void handleRefresh()}
        ListEmptyComponent={
          !mediaQuery.isLoading ? <EmptyState icon="images" title={t("gallery.empty")} /> : null
        }
        ListFooterComponent={
          mediaQuery.isFetching && page > 1 ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.footerLoader} />
          ) : null
        }
      />

      {/* Lightbox / Fullscreen Modal */}
      {selectedPhoto && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedPhoto(null)}
        >
          <View style={styles.modalBackground}>
            {/* Header / Close */}
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.closeButton}
                onPress={() => setSelectedPhoto(null)}
                hitSlop={12}
              >
                <Ionicons name="close" size={28} color="#ffffff" />
              </Pressable>
            </View>

            {/* Photo View */}
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.fullscreenPhoto}
                contentFit="contain"
              />
            </View>

            {/* Actions Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.actionButton, styles.saveButton]}
                onPress={() => void saveToGallery(selectedPhoto)}
                disabled={actionLoading !== null}
              >
                {actionLoading === "save" ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#ffffff" />
                    <Text style={styles.actionText}>{t("common.save")}</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.shareButton]}
                onPress={() => void shareToWhatsApp(selectedPhoto)}
                disabled={actionLoading !== null}
              >
                {actionLoading === "share" ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
                    <Text style={styles.actionText}>WhatsApp</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 96,
  },
  row: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumbnailWrapper: {
    width: itemSize,
    height: itemSize,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#e2ecd8",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  footerLoader: {
    paddingVertical: spacing.md,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "space-between",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  fullscreenPhoto: {
    width: "100%",
    height: "100%",
  },
  modalFooter: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 50,
    justifyContent: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    minWidth: 130,
    height: 46,
  },
  saveButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  shareButton: {
    backgroundColor: "#25d366", // WhatsApp green brand color
  },
  actionText: {
    color: "#ffffff",
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
