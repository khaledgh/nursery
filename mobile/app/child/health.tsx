import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useHealthProfile } from "../../src/api/hooks";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatTile } from "../../src/components/StatTile";
import { TipBanner } from "../../src/components/TipBanner";
import { Card, Divider, InfoRow, Loading, Screen } from "../../src/components/ui";
import { formatDate } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, spacing, type AccentName } from "../../src/theme";

const SEVERITY_ACCENT: Record<string, AccentName> = { mild: "meals", moderate: "community", severe: "health" };

export default function HealthScreen() {
  const { t, i18n } = useTranslation();
  const { child } = useActiveChild();
  const profile = useHealthProfile(child?.id);

  if (profile.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  const p = profile.data;
  if (!p || !child) {
    return (
      <Screen>
        <EmptyState icon="medkit" title={t("common.empty")} />
      </Screen>
    );
  }

  const latestVital = p.vitals?.[0];
  const activeMeds = (p.medications ?? []).filter((m) => m.active);
  const activeIllness = (p.illnesses ?? []).find((i) => i.status === "active");
  const records = [...(p.illnesses ?? [])].slice(0, 5);
  const nextImmunization = (p.immunizations ?? []).find((i) => i.next_due_date);

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <HeroCard
        variant="tint"
        photoUrl={child.avatar?.url}
        name={child.first_name}
        title={`${child.first_name} ${child.last_name}`}
        subtitle={t("health.subtitle")}
      >
        <View style={styles.heroPills}>
          {child.blood_type ? <PillBadge label={`${t("health.bloodType")}: ${child.blood_type}`} accent="health" /> : null}
          {(p.allergies ?? []).slice(0, 2).map((a) => (
            <PillBadge key={a.id} label={a.name} accent={SEVERITY_ACCENT[a.severity] ?? "meals"} dot />
          ))}
        </View>
      </HeroCard>

      {/* Stat tiles */}
      <View style={styles.tiles}>
        <StatTile
          icon="thermometer"
          accent="hydration"
          value={latestVital?.temperature ? `${latestVital.temperature}°C` : "—"}
          label={t("health.temperature")}
        />
        <StatTile
          icon="heart"
          accent="health"
          value={latestVital?.mood || "—"}
          label={t("health.wellness")}
        />
        <StatTile
          icon="medkit"
          accent="hydration"
          value={activeMeds.length ? String(activeMeds.length) : t("health.none")}
          label={t("health.medications")}
        />
        <StatTile
          icon="shield-checkmark"
          accent="primary"
          value={t("health.upToDate")}
          label={t("health.immunizations")}
          sub={nextImmunization?.next_due_date ? t("health.next", { date: formatDate(nextImmunization.next_due_date, i18n.language) }) : undefined}
        />
      </View>

      {/* Status banner */}
      {activeIllness ? (
        <TipBanner icon="alert-circle" accent="health" title={activeIllness.title} text={t("health.activeIllness")} />
      ) : (
        <TipBanner
          icon="shield-checkmark"
          accent="primary"
          title={t("health.doingGreat", { name: child.first_name })}
          text={t("health.noConcerns")}
        />
      )}

      {/* Today's summary */}
      {latestVital && (
        <>
          <SectionHeader title={t("health.todaySummary")} />
          <Card style={styles.vitalsRow}>
            {[
              { icon: "thermometer", label: t("health.temperature"), value: latestVital.temperature ? `${latestVital.temperature}°C` : "—" },
              { icon: "happy", label: t("health.mood"), value: latestVital.mood || "—" },
              { icon: "flash", label: t("health.energy"), value: latestVital.energy || "—" },
              { icon: "restaurant", label: t("health.appetite"), value: latestVital.appetite || "—" },
              { icon: "moon", label: t("health.sleepLastNight"), value: latestVital.sleep_summary || "—" },
            ].map((v, i) => (
              <View key={i} style={styles.vitalItem}>
                <IconCircle name={v.icon} accent="primary" size={32} />
                <Text style={styles.vitalLabel}>{v.label}</Text>
                <Text style={styles.vitalValue} numberOfLines={1}>
                  {v.value}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Recent records */}
      {records.length > 0 && (
        <>
          <SectionHeader title={t("health.records")} />
          <Card>
            {records.map((r, i) => (
              <View key={r.id}>
                <View style={styles.recordRow}>
                  <IconCircle
                    name={r.status === "active" ? "thermometer" : "checkmark-circle"}
                    accent={r.status === "active" ? "health" : "activity"}
                    size={38}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>{r.title}</Text>
                    <Text style={styles.recordSub}>
                      {formatDate(r.date, i18n.language)}
                      {r.temperature ? ` · ${r.temperature}°C` : ""}
                    </Text>
                  </View>
                  <PillBadge
                    label={r.status}
                    accent={r.status === "active" ? "health" : "activity"}
                    dot
                  />
                </View>
                {i < records.length - 1 && <Divider />}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Medications */}
      <SectionHeader title={t("health.medications")} />
      {activeMeds.length === 0 ? (
        <TipBanner icon="checkmark-circle" accent="activity" title={t("health.noMedsToday")} text={t("health.noMedsSub")} />
      ) : (
        <Card>
          {activeMeds.map((m, i) => (
            <View key={m.id}>
              <View style={styles.recordRow}>
                <IconCircle name="medkit" accent="hydration" size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordTitle}>{m.name}</Text>
                  <Text style={styles.recordSub}>
                    {m.dosage}
                    {m.schedule ? ` · ${m.schedule}` : ""}
                  </Text>
                </View>
              </View>
              {i < activeMeds.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      )}

      {/* Info grid */}
      <View style={styles.infoGrid}>
        <Card style={styles.infoCard}>
          <IconCircle name="warning" accent="health" size={36} squircle />
          <Text style={styles.infoTitle}>{t("health.allergies")}</Text>
          {(p.allergies ?? []).length === 0 ? (
            <Text style={styles.infoSub}>{t("health.none")}</Text>
          ) : (
            (p.allergies ?? []).map((a) => (
              <Text key={a.id} style={styles.infoSub}>
                {a.name} · {t(`enums.severity.${a.severity}`)}
              </Text>
            ))
          )}
        </Card>

        <Card style={styles.infoCard}>
          <IconCircle name="shield-checkmark" accent="primary" size={36} squircle />
          <Text style={styles.infoTitle}>{t("health.immunizations")}</Text>
          {(p.immunizations ?? []).slice(0, 3).map((im) => (
            <Text key={im.id} style={styles.infoSub}>
              {im.vaccine} · {formatDate(im.given_date, i18n.language)}
            </Text>
          ))}
          {(p.immunizations ?? []).length === 0 && <Text style={styles.infoSub}>{t("health.none")}</Text>}
        </Card>

        <Card style={styles.infoCard}>
          <IconCircle name="call" accent="meals" size={36} squircle />
          <Text style={styles.infoTitle}>{t("health.contacts")}</Text>
          {(p.emergency_contacts ?? []).map((c) => (
            <Pressable key={c.id} onPress={() => void Linking.openURL(`tel:${c.phone}`)}>
              <Text style={[styles.infoSub, styles.phone]}>
                {c.name} ({c.relation}) · {c.phone}
              </Text>
            </Pressable>
          ))}
          {(p.emergency_contacts ?? []).length === 0 && <Text style={styles.infoSub}>{t("health.none")}</Text>}
        </Card>

        <Card style={styles.infoCard}>
          <IconCircle name="card" accent="payments" size={36} squircle />
          <Text style={styles.infoTitle}>{t("health.insurance")}</Text>
          {(p.insurance ?? []).map((ins) => (
            <View key={ins.id}>
              <Text style={styles.infoSub}>{ins.provider}</Text>
              <Text style={styles.infoSub}>{t("health.policy", { no: ins.policy_no })}</Text>
            </View>
          ))}
          {(p.insurance ?? []).length === 0 && <Text style={styles.infoSub}>{t("health.none")}</Text>}
        </Card>

        <Card style={styles.infoCard}>
          <IconCircle name="document-text" accent="hydration" size={36} squircle />
          <Text style={styles.infoTitle}>{t("health.documents")}</Text>
          <Text style={styles.infoSub}>{t("health.files", { count: (p.documents ?? []).length })}</Text>
        </Card>

        <Card style={styles.infoCard}>
          <IconCircle name="reader" accent="activity" size={36} squircle />
          <Text style={styles.infoTitle}>{t("health.notes")}</Text>
          {(p.notes ?? []).slice(0, 2).map((n) => (
            <Text key={n.id} style={styles.infoSub} numberOfLines={2}>
              {n.title}
            </Text>
          ))}
          {(p.notes ?? []).length === 0 && <Text style={styles.infoSub}>{t("health.none")}</Text>}
        </Card>
      </View>

      {/* Growth */}
      {(p.growth ?? []).length > 0 && (
        <>
          <SectionHeader title={t("health.growth")} />
          <Card>
            {(p.growth ?? []).slice(0, 5).map((g) => (
              <InfoRow
                key={g.id}
                label={formatDate(g.date, i18n.language)}
                value={`${g.height_cm} cm · ${g.weight_kg} kg`}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  vitalsRow: { flexDirection: "row", justifyContent: "space-between" },
  vitalItem: { alignItems: "center", gap: 3, flex: 1 },
  vitalLabel: { fontSize: 9, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
  vitalValue: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.text },
  recordRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingVertical: 4 },
  recordTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  recordSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  infoCard: { width: "48%", gap: 5 },
  infoTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text },
  infoSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  phone: { color: colors.primary },
});
