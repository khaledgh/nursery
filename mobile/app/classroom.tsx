import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useClassmates, useClassroom, useClassroomSchedule, useDiary } from "../src/api/hooks";
import { ChildAvatar } from "../src/components/ChildAvatar";
import { EmptyState } from "../src/components/EmptyState";
import { IconCircle } from "../src/components/IconCircle";
import { PillBadge } from "../src/components/PillBadge";
import { PhotoStrip, type StripPhoto } from "../src/components/PhotoStrip";
import { SectionHeader } from "../src/components/SectionHeader";
import { TimelineItem } from "../src/components/Timeline";
import { Card, Loading, Screen } from "../src/components/ui";
import { toISODate } from "../src/lib/stats";
import { useActiveChild } from "../src/store/activeChild";
import { colors, fonts, radius, safeIcon, spacing } from "../src/theme";

export default function ClassroomScreen() {
  const { t } = useTranslation();
  const { child } = useActiveChild();
  const classroomId = child?.classroom_id;

  const classroom = useClassroom(classroomId);
  const schedule = useClassroomSchedule(classroomId);
  const classmates = useClassmates(classroomId);
  const today = toISODate(new Date());
  const diary = useDiary(child?.id, { from: today, to: today });

  if (classroom.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  const room = classroom.data;
  if (!room) {
    return (
      <Screen>
        <EmptyState icon="school" title={t("common.empty")} />
      </Screen>
    );
  }

  const todaySchedule = (schedule.data ?? []).filter((s) => s.weekday === new Date().getDay());
  const updates: StripPhoto[] = (diary.data ?? [])
    .flatMap((e) => (e.media ?? []).filter((m) => m.media?.url).map((m) => ({ url: m.media!.url, caption: e.title })))
    .slice(0, 10);

  return (
    <Screen refreshing={classroom.isRefetching} onRefresh={() => void classroom.refetch()}>
      {/* Banner */}
      <Card style={styles.banner}>
        {room.image?.url ? (
          <Image source={{ uri: room.image.url }} style={styles.bannerImage} contentFit="cover" />
        ) : (
          <IconCircle name="school" accent="primary" size={56} squircle />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.bannerText}>{t("classroom.banner")}</Text>
        </View>
      </Card>

      {/* Facts */}
      <View style={styles.facts}>
        {[
          { icon: "people", label: t("classroom.childrenCount"), value: String(room.capacity || "—") },
          { icon: "happy", label: t("classroom.ageGroup"), value: room.age_group || "—" },
          { icon: "home", label: t("classroom.location"), value: room.room_location || "—" },
          { icon: "time", label: t("classroom.hours"), value: room.opens_at ? `${room.opens_at}–${room.closes_at}` : "—" },
        ].map((f, i) => (
          <Card key={i} style={styles.factCard}>
            <IconCircle name={f.icon} accent="primary" size={32} />
            <Text style={styles.factValue} numberOfLines={1}>
              {f.value}
            </Text>
            <Text style={styles.factLabel} numberOfLines={1}>
              {f.label}
            </Text>
          </Card>
        ))}
      </View>

      {/* Today's schedule */}
      <SectionHeader title={`🗓️ ${t("classroom.todayInClassroom")}`} />
      {todaySchedule.length === 0 ? (
        <Card>
          <Text style={styles.noSchedule}>{t("classroom.noSchedule")}</Text>
        </Card>
      ) : (
        <Card>
          {todaySchedule.map((item, i) => (
            <TimelineItem
              key={item.id}
              time={item.starts_at}
              icon={safeIcon(item.icon, "sparkles")}
              accent="primary"
              last={i === todaySchedule.length - 1}
            >
              <Text style={styles.scheduleTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.scheduleSub}>{item.description}</Text> : null}
            </TimelineItem>
          ))}
        </Card>
      )}

      {/* Teachers */}
      {(room.teachers ?? []).length > 0 && (
        <>
          <SectionHeader title={`👩‍🏫 ${t("classroom.teachers")}`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teacherRow}>
            {(room.teachers ?? []).map((ct) => (
              <Card key={ct.id} style={styles.teacherCard}>
                <ChildAvatar url={ct.teacher?.avatar?.url} name={ct.teacher?.name ?? "?"} size={52} />
                <Text style={styles.teacherName} numberOfLines={1}>
                  {ct.teacher?.name}
                </Text>
                <PillBadge
                  label={ct.role === "lead" ? t("classroom.lead") : t("classroom.assistant")}
                  accent={ct.role === "lead" ? "primary" : "neutral"}
                />
              </Card>
            ))}
          </ScrollView>
        </>
      )}

      {/* Friends */}
      {child && (classmates.data ?? []).length > 0 && (
        <>
          <SectionHeader title={`💜 ${t("classroom.friends", { name: child.first_name })}`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
            {(classmates.data ?? [])
              .filter((c) => c.id !== child.id)
              .map((c) => (
                <View key={c.id} style={styles.friend}>
                  <ChildAvatar url={c.avatar?.url} name={c.first_name} size={56} ringColor={colors.primaryLight} />
                  <Text style={styles.friendName} numberOfLines={1}>
                    {c.first_name}
                  </Text>
                </View>
              ))}
          </ScrollView>
        </>
      )}

      {/* Updates */}
      {updates.length > 0 && (
        <>
          <SectionHeader title={`📣 ${t("classroom.updates")}`} />
          <PhotoStrip photos={updates} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.primaryLight },
  bannerImage: { width: 72, height: 72, borderRadius: radius.lg },
  roomName: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.primaryDark },
  bannerText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.text },
  facts: { flexDirection: "row", gap: spacing.sm },
  factCard: { flex: 1, alignItems: "center", gap: 3, padding: spacing.sm },
  factValue: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text },
  factLabel: { fontSize: 9, fontFamily: fonts.semibold, color: colors.textMuted },
  noSchedule: { fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
  scheduleTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  scheduleSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  teacherRow: { gap: spacing.sm },
  teacherCard: { width: 140, alignItems: "center", gap: 6 },
  teacherName: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text },
  friendsRow: { gap: spacing.md },
  friend: { alignItems: "center", gap: 4, width: 64 },
  friendName: { fontSize: 11, fontFamily: fonts.bold, color: colors.text },
});
