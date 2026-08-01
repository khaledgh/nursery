import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SectionList,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";

import { useChildMedia } from "../../src/api/hooks";
import type { Media } from "../../src/api/types";
import { EmptyState } from "../../src/components/EmptyState";
import { Loading } from "../../src/components/ui";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, spacing } from "../../src/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const columns = 3;
// Calculate item size with spacing: padding is md (16), gap between items is sm (8)
const itemSize = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * (columns - 1)) / columns;

interface ZoomableImageProps {
  uri: string;
  onZoomStateChange: (isZoomed: boolean) => void;
  viewRef?: React.RefObject<View | null>;
}

function ZoomableImage({ uri, onZoomStateChange, viewRef }: ZoomableImageProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const currentScale = useRef(1);
  const currentPan = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const scaleListener = scale.addListener(({ value }) => {
      currentScale.current = value;
    });
    const panListener = pan.addListener(({ x, y }) => {
      currentPan.current = { x, y };
    });
    return () => {
      scale.removeListener(scaleListener);
      pan.removeListener(panListener);
    };
  }, []);

  const lastDistance = useRef<number | null>(null);
  const initialScale = useRef(1);
  const lastTap = useRef<number>(0);

  const reset = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pan, {
        toValue: { x: 0, y: 0 },
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onZoomStateChange(false);
    });
  };

  const handleDoubleTap = () => {
    if (currentScale.current > 1) {
      reset();
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 2.5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pan, {
          toValue: { x: 0, y: 0 },
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onZoomStateChange(true);
      });
    }
  };

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return currentScale.current > 1 || gestureState.numberActiveTouches === 2;
      },
      onPanResponderGrant: (evt) => {
        pan.setOffset({ x: currentPan.current.x, y: currentPan.current.y });
        pan.setValue({ x: 0, y: 0 });

        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          lastDistance.current = Math.sqrt(dx * dx + dy * dy);
          initialScale.current = currentScale.current;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2 && lastDistance.current !== null) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          let nextScale = (distance / lastDistance.current) * initialScale.current;
          nextScale = Math.max(1, Math.min(nextScale, 4));
          scale.setValue(nextScale);
          onZoomStateChange(nextScale > 1);
        } else if (touches.length === 1 && currentScale.current > 1) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        lastDistance.current = null;

        if (currentScale.current <= 1) {
          reset();
        } else {
          const maxTx = (SCREEN_WIDTH * (currentScale.current - 1)) / 2;
          const maxTy = (SCREEN_HEIGHT * (currentScale.current - 1)) / 2;

          let targetX = currentPan.current.x;
          let targetY = currentPan.current.y;

          if (Math.abs(targetX) > maxTx) {
            targetX = targetX > 0 ? maxTx : -maxTx;
          }
          if (Math.abs(targetY) > maxTy) {
            targetY = targetY > 0 ? maxTy : -maxTy;
          }

          Animated.timing(pan, {
            toValue: { x: targetX, y: targetY },
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        reset();
      },
    })
  ).current;

  return (
    <View ref={viewRef} style={zoomStyles.container} collapsable={false} {...panResponder.panHandlers}>
      <Pressable onPress={handlePress} style={zoomStyles.pressable}>
        <Animated.Image
          source={{ uri }}
          style={[
            zoomStyles.image,
            {
              transform: [
                { scale },
                { translateX: pan.x },
                { translateY: pan.y },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </Pressable>

      {/* Watermark overlay in bottom corner */}
      <View style={zoomStyles.watermarkBadge} pointerEvents="none">
        <Image
          source={require("../../assets/notification-icon-large.png")}
          style={zoomStyles.watermarkIcon}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const zoomStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  pressable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  watermarkBadge: {
    position: "absolute",
    bottom: 110,
    right: 20,
    zIndex: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  watermarkIcon: {
    width: 36,
    height: 36,
  },
});

const formatDateHeader = (dateStr: string, t: any) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return t("common.today", "Today");
  } else if (date.toDateString() === yesterday.toDateString()) {
    return t("common.yesterday", "Yesterday");
  } else {
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
};

const getGroupedSections = (mediaList: Media[], t: any) => {
  const groups: { [key: string]: Media[] } = {};

  mediaList.forEach((item) => {
    const dateStr = item.created_at || new Date().toISOString();
    const datePart = dateStr.split("T")[0]; // YYYY-MM-DD
    if (!groups[datePart]) {
      groups[datePart] = [];
    }
    groups[datePart].push(item);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const sections: { title: string; data: Media[][] }[] = sortedDates.map((dateStr) => {
    const items = groups[dateStr];
    const chunked: Media[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      chunked.push(items.slice(i, i + columns));
    }
    return {
      title: formatDateHeader(dateStr, t),
      data: chunked,
    };
  });

  return sections;
};

export default function GalleryScreen() {
  const { t } = useTranslation();
  const { child } = useActiveChild();

  const [page, setPage] = useState(1);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);

  const [actionLoading, setActionLoading] = useState<"save" | "share" | null>(null);

  const mediaQuery = useChildMedia(child?.id, page);

  useEffect(() => {
    if (mediaQuery.data) {
      if (page === 1) {
        setAllMedia(mediaQuery.data);
      } else {
        setAllMedia((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = mediaQuery.data.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [mediaQuery.data, page]);

  const handleRefresh = async () => {
    if (page === 1) {
      await mediaQuery.refetch();
    } else {
      setPage(1);
    }
  };

  const loadMore = () => {
    if (mediaQuery.data && mediaQuery.data.length === 24 && !mediaQuery.isFetching) {
      setPage((p) => p + 1);
    }
  };

  const activeViewRef = useRef<View>(null);

  const saveToGallery = async (photo: Media) => {
    if (!photo || !photo.url) return;
    try {
      setActionLoading("save");

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("gallery.title"), t("gallery.permissionDenied"));
        return;
      }

      let targetUri: string | null = null;
      if (activeViewRef.current) {
        try {
          targetUri = await captureRef(activeViewRef, { format: "png", quality: 0.95 });
        } catch (e) {
          console.warn("captureRef failed, falling back to download", e);
        }
      }

      if (!targetUri) {
        const ext = photo.mime.split("/")[1] || "jpg";
        const filename = `child_photo_${photo.id}.${ext}`;
        const localUri = `${FileSystem.documentDirectory}${filename}`;
        const downloaded = await FileSystem.downloadAsync(photo.url, localUri);
        targetUri = downloaded.uri;
      }

      await MediaLibrary.saveToLibraryAsync(targetUri);
      Alert.alert(t("gallery.title"), t("gallery.saveSuccess"));
    } catch (err) {
      console.error(err);
      Alert.alert(t("gallery.title"), t("gallery.saveError"));
    } finally {
      setActionLoading(null);
    }
  };

  const shareToWhatsApp = async (photo: Media) => {
    if (!photo || !photo.url) return;
    try {
      setActionLoading("share");

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t("gallery.title"), t("gallery.shareError"));
        return;
      }

      let targetUri: string | null = null;
      if (activeViewRef.current) {
        try {
          targetUri = await captureRef(activeViewRef, { format: "png", quality: 0.95 });
        } catch (e) {
          console.warn("captureRef failed, falling back to download", e);
        }
      }

      if (!targetUri) {
        const ext = photo.mime.split("/")[1] || "jpg";
        const filename = `share_photo_${photo.id}.${ext}`;
        const localUri = `${FileSystem.cacheDirectory}${filename}`;
        const downloaded = await FileSystem.downloadAsync(photo.url, localUri);
        targetUri = downloaded.uri;
      }

      await Sharing.shareAsync(targetUri, {
        mimeType: "image/png",
        dialogTitle: t("gallery.title"),
      });
    } catch (err) {
      console.error(err);
      Alert.alert(t("gallery.title"), t("gallery.shareError"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseModal = () => {
    setSelectedPhotoIndex(null);
    setPagerScrollEnabled(true);
  };

  const renderRow = ({ item: rowItems }: { item: Media[] }) => (
    <View style={styles.row}>
      {rowItems.map((photo) => {
        const globalIndex = allMedia.findIndex((m) => m.id === photo.id);
        return (
          <Pressable
            key={photo.id}
            style={styles.thumbnailWrapper}
            onPress={() => {
              setSelectedPhotoIndex(globalIndex);
            }}
          >
            <Image
              source={{ uri: photo.url }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        );
      })}
      {rowItems.length < columns &&
        Array.from({ length: columns - rowItems.length }).map((_, i) => (
          <View
            key={`empty-${i}`}
            style={[styles.thumbnailWrapper, { backgroundColor: "transparent" }]}
          />
        ))}
    </View>
  );

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  if (mediaQuery.isLoading && allMedia.length === 0) {
    return <Loading />;
  }

  const groupedSections = getGroupedSections(allMedia, t);

  return (
    <View style={styles.container}>
      <SectionList
        sections={groupedSections}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshing={mediaQuery.isRefetching && page === 1}
        onRefresh={() => void handleRefresh()}
        stickySectionHeadersEnabled={true}
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
      {selectedPhotoIndex !== null && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalBackground}>
            {/* Header / Close */}
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.closeButton}
                onPress={handleCloseModal}
                hitSlop={12}
              >
                <Ionicons name="close" size={28} color="#ffffff" />
              </Pressable>
            </View>

            {/* Photo View */}
            <View style={styles.photoContainer}>
              <FlatList
                data={allMedia}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={pagerScrollEnabled}
                keyExtractor={(item) => item.id.toString()}
                initialScrollIndex={selectedPhotoIndex}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setSelectedPhotoIndex(index);
                }}
                renderItem={({ item, index }) => (
                  <ZoomableImage
                    uri={item.url}
                    onZoomStateChange={(isZoomed) => setPagerScrollEnabled(!isZoomed)}
                    viewRef={index === selectedPhotoIndex ? activeViewRef : undefined}
                  />
                )}
              />
            </View>

            {/* Actions Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.actionButton, styles.saveButton]}
                onPress={() => void saveToGallery(allMedia[selectedPhotoIndex])}
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
                onPress={() => void shareToWhatsApp(allMedia[selectedPhotoIndex])}
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
    flexDirection: "row",
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
  sectionHeader: {
    backgroundColor: colors.bg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  modalFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
