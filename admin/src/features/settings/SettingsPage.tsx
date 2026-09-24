import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Building2,
  Check,
  Cloud,
  Coins,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  History,
  Layers,
  Save,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Switch, Tab, Tabs } from "@heroui/react";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { usePagedList } from "../../hooks/usePagedList";
import { api, errorMessage } from "../../lib/api";
import { ACTION_TINT } from "../../lib/tints";
import type { AuditLog, ItemResponse } from "../../types/api";

type SettingsMap = Record<string, any>;

const CURRENCY_PRESETS = [
  { code: "SEK", symbol: "kr", label: "Swedish Krona (SEK)" },
  { code: "SAR", symbol: "﷼", label: "Saudi Riyal (SAR)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (AED)" },
  { code: "KWD", symbol: "د.ك", label: "Kuwaiti Dinar (KWD)" },
  { code: "USD", symbol: "$", label: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", label: "Euro (EUR)" },
  { code: "GBP", symbol: "£", label: "British Pound (GBP)" },
  { code: "QAR", symbol: "﷼", label: "Qatari Riyal (QAR)" },
  { code: "BHD", symbol: ".د.ب", label: "Bahraini Dinar (BHD)" },
];

const LOCALES = [
  { code: "en", name: "English", dir: "ltr", flag: "🇬🇧" },
  { code: "ar", name: "العربية (Arabic)", dir: "rtl", flag: "🇸🇦" },
  { code: "sv", name: "Svenska (Swedish)", dir: "ltr", flag: "🇸🇪" },
];

export function SettingsPage() {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<string>("general");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form States
  const [nurseryName, setNurseryName] = useState("Sunny Stars Childcare");
  const [currency, setCurrency] = useState("SEK");
  const [customCurrency, setCustomCurrency] = useState("");
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [featureCommunity, setFeatureCommunity] = useState(true);
  const [featurePayments, setFeaturePayments] = useState(true);

  // Storage States
  const [storageDriver, setStorageDriver] = useState<"local" | "s3">("local");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Region, setS3Region] = useState("auto");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3PublicUrl, setS3PublicUrl] = useState("");
  const [s3PathStyle, setS3PathStyle] = useState(true);
  const [showS3Secret, setShowS3Secret] = useState(false);

  // OneSignal States
  const [oneSignalEnabled, setOneSignalEnabled] = useState(true);
  const [oneSignalAppId, setOneSignalAppId] = useState("");
  const [oneSignalApiKey, setOneSignalApiKey] = useState("");
  const [showOneSignalKey, setShowOneSignalKey] = useState(false);

  // Fetch Settings
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get<ItemResponse<SettingsMap>>("/admin/settings");
      return res.data.data;
    },
  });

  // Audit Logs
  const auditList = usePagedList<AuditLog>("audit-logs", "/admin/audit-logs");

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      if (typeof s.nursery_name === "string") setNurseryName(s.nursery_name);
      if (typeof s.currency === "string") {
        setCurrency(s.currency);
        if (!CURRENCY_PRESETS.some((c) => c.code === s.currency)) {
          setCustomCurrency(s.currency);
        }
      }
      if (typeof s.default_locale === "string") setDefaultLocale(s.default_locale);
      if (typeof s.feature_community === "boolean") setFeatureCommunity(s.feature_community);
      if (typeof s.feature_payments === "boolean") setFeaturePayments(s.feature_payments);

      if (s.storage_driver === "local" || s.storage_driver === "s3") setStorageDriver(s.storage_driver);
      if (typeof s.s3_bucket === "string") setS3Bucket(s.s3_bucket);
      if (typeof s.s3_region === "string") setS3Region(s.s3_region);
      if (typeof s.s3_endpoint === "string") setS3Endpoint(s.s3_endpoint);
      if (typeof s.s3_access_key === "string") setS3AccessKey(s.s3_access_key);
      if (typeof s.s3_secret_key === "string") setS3SecretKey(s.s3_secret_key);
      if (typeof s.s3_public_url === "string") setS3PublicUrl(s.s3_public_url);
      if (typeof s.s3_path_style === "boolean") setS3PathStyle(s.s3_path_style);

      if (typeof s.onesignal_enabled === "boolean") setOneSignalEnabled(s.onesignal_enabled);
      if (typeof s.onesignal_app_id === "string") setOneSignalAppId(s.onesignal_app_id);
      if (typeof s.onesignal_rest_api_key === "string") setOneSignalApiKey(s.onesignal_rest_api_key);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const effectiveCurrency = (customCurrency || currency || "SEK").trim().toUpperCase();
      const payload: Record<string, any> = {
        nursery_name: nurseryName,
        currency: effectiveCurrency,
        default_locale: defaultLocale,
        feature_community: featureCommunity,
        feature_payments: featurePayments,
        storage_driver: storageDriver,
      };

      if (storageDriver === "s3") {
        payload.s3_bucket = s3Bucket;
        payload.s3_region = s3Region || "auto";
        payload.s3_endpoint = s3Endpoint;
        payload.s3_access_key = s3AccessKey;
        payload.s3_secret_key = s3SecretKey;
        payload.s3_public_url = s3PublicUrl;
        payload.s3_path_style = s3PathStyle;
      }

      payload.onesignal_enabled = oneSignalEnabled;
      payload.onesignal_app_id = oneSignalAppId;
      payload.onesignal_rest_api_key = oneSignalApiKey;

      await api.put("/admin/settings", payload);
    },
    onSuccess: () => {
      setSaved(true);
      setError("");
      void settingsQuery.refetch();
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["parent"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      setError(errorMessage(err));
    },
  });

  const auditColumns: Column<AuditLog>[] = [
    {
      header: "Action",
      render: (l) => (
        <span className={`badge uppercase text-[10px] font-black ${ACTION_TINT[l.action] ?? "bg-slate-100 text-slate-700"}`}>
          {l.action}
        </span>
      ),
    },
    {
      header: "Entity",
      render: (l) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {l.entity} <span className="text-slate-400 font-mono text-xs">#{l.entity_id}</span>
        </span>
      ),
    },
    {
      header: "Actor",
      render: (l) => (
        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
          User #{l.actor_user_id}
        </span>
      ),
    },
    {
      header: "Change Diff",
      render: (l) => (
        <code className="block max-w-sm truncate text-[11px] font-mono p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {l.diff ? JSON.stringify(l.diff) : "—"}
        </code>
      ),
    },
    {
      header: "IP Address",
      render: (l) => <span className="font-mono text-xs text-slate-400">{l.ip || "—"}</span>,
    },
    {
      header: t("common.date"),
      render: (l) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {new Date(l.created_at).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={t("nav.settings")}
        subtitle="Manage nursery branding, currency, language, media cloud storage, and push notifications"
        actions={
          selectedTab !== "audit" ? (
            <Button
              color="primary"
              radius="lg"
              startContent={saved ? <Check size={16} /> : <Save size={16} />}
              isLoading={saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
              className="font-bold shadow-md shadow-primary/25"
            >
              {saved ? "Saved ✓" : t("common.save")}
            </Button>
          ) : undefined
        }
      />

      {/* Notifications feedback */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center gap-2">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm font-bold flex items-center gap-2">
          <Check size={16} className="shrink-0" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Tab Navigation */}
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(String(key))}
        variant="underlined"
        classNames={{
          tabList: "gap-6 w-full border-b border-slate-200/80 dark:border-slate-800 p-0",
          cursor: "w-full bg-primary",
          tab: "max-w-fit px-1 h-12 text-sm font-bold text-slate-500 data-[selected=true]:text-primary",
        }}
      >
        <Tab
          key="general"
          title={
            <div className="flex items-center gap-2">
              <Building2 size={16} />
              <span>General & Currency</span>
            </div>
          }
        />
        <Tab
          key="language"
          title={
            <div className="flex items-center gap-2">
              <Globe size={16} />
              <span>Language & Regional</span>
            </div>
          }
        />
        <Tab
          key="storage"
          title={
            <div className="flex items-center gap-2">
              <Cloud size={16} />
              <span>Media & S3 Storage</span>
            </div>
          }
        />
        <Tab
          key="notifications"
          title={
            <div className="flex items-center gap-2">
              <BellRing size={16} />
              <span>Push (OneSignal)</span>
            </div>
          }
        />
        <Tab
          key="audit"
          title={
            <div className="flex items-center gap-2">
              <History size={16} />
              <span>Audit Logs</span>
            </div>
          }
        />
      </Tabs>

      {/* Tab 1: General & Currency */}
      {selectedTab === "general" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-6 border border-slate-200/80 dark:border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 size={18} className="text-primary" />
                Nursery Profile
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Primary name and branding information shown across the application.
              </p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Nursery Name
                </label>
                <input
                  className="input"
                  value={nurseryName}
                  onChange={(e) => setNurseryName(e.target.value)}
                  placeholder="e.g. Sunny Stars Childcare"
                />
              </div>
            </div>

            {/* Currency Section */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Coins size={18} className="text-amber-500" />
                  Nursery Currency
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select or type the currency code used for invoices, tuition fees, and balances.
                </p>
              </div>

              {/* Currency Presets */}
              <div className="flex flex-wrap gap-2 pt-1">
                {CURRENCY_PRESETS.map((c) => {
                  const active = currency === c.code && !customCurrency;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setCurrency(c.code);
                        setCustomCurrency("");
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        active
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50"
                      }`}
                    >
                      <span className="font-mono text-sm opacity-80">{c.symbol}</span>
                      <span>{c.code}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Currency Field */}
              <div className="max-w-xs pt-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Or enter custom currency code:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="input uppercase font-mono font-bold"
                    placeholder="e.g. SAR, USD, JOD"
                    maxLength={6}
                    value={customCurrency}
                    onChange={(e) => {
                      setCustomCurrency(e.target.value.toUpperCase());
                      setCurrency(e.target.value.toUpperCase());
                    }}
                  />
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    Preview: 1,500.00 {customCurrency || currency}
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Flags */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers size={18} className="text-sky-500" />
                  System Features
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enable or disable module visibility for staff and parents.
                </p>
              </div>

              <div className="space-y-3 max-w-lg">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Community Social Feed</p>
                    <p className="text-xs text-slate-400">Class photos, announcements, and parent comments</p>
                  </div>
                  <Switch isSelected={featureCommunity} onValueChange={setFeatureCommunity} color="primary" />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Tuition & Invoicing</p>
                    <p className="text-xs text-slate-400">Invoice generation, due dates tracking, and payments</p>
                  </div>
                  <Switch isSelected={featurePayments} onValueChange={setFeaturePayments} color="primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Language & Regional */}
      {selectedTab === "language" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-6 border border-slate-200/80 dark:border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                Default Nursery Language
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                The primary language used when sending notifications, reports, and for new accounts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LOCALES.map((l) => {
                const active = defaultLocale === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setDefaultLocale(l.code)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{l.flag}</span>
                      {active ? (
                        <span className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mt-2">
                      {l.name}
                    </p>
                    <p className="text-xs text-slate-400 font-mono uppercase mt-0.5">
                      Code: {l.code} · {l.dir.toUpperCase()}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Switch Admin Dashboard Language (Current Session)
              </h4>
              <div className="flex items-center gap-2">
                {LOCALES.map((l) => (
                  <Button
                    key={l.code}
                    size="sm"
                    variant={i18n.language.startsWith(l.code) ? "solid" : "bordered"}
                    color={i18n.language.startsWith(l.code) ? "primary" : "default"}
                    onPress={() => void i18n.changeLanguage(l.code)}
                    className="font-bold"
                  >
                    {l.flag} {l.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Media & S3 Storage */}
      {selectedTab === "storage" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-6 border border-slate-200/80 dark:border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cloud size={18} className="text-primary" />
                Media Storage Engine
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose where child photos, activity media, and documents are securely saved.
              </p>
            </div>

            {/* Driver Toggle Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setStorageDriver("local")}
                className={`p-5 rounded-2xl border text-left transition-all ${
                  storageDriver === "local"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <HardDrive size={20} />
                  </div>
                  {storageDriver === "local" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">Local Disk Storage</p>
                <p className="text-xs text-slate-400 mt-1">
                  Stores media files directly on the API server local volume. Best for development and single-server setups.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStorageDriver("s3")}
                className={`p-5 rounded-2xl border text-left transition-all ${
                  storageDriver === "s3"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Cloud size={20} />
                  </div>
                  {storageDriver === "s3" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">Cloud S3 / Cloudflare R2</p>
                <p className="text-xs text-slate-400 mt-1">
                  Amazon S3 or S3-compatible cloud storage (Cloudflare R2, MinIO, Wasabi) with direct secure presigned links.
                </p>
              </button>
            </div>

            {/* S3 Configuration Fields */}
            {storageDriver === "s3" && (
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      S3 / Cloudflare R2 Credentials
                    </h4>
                    <p className="text-xs text-slate-400">
                      Configure your cloud bucket parameters. Changes apply immediately upon saving.
                    </p>
                  </div>

                  {/* Preset Helper */}
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setS3Region("auto");
                      setS3PathStyle(true);
                    }}
                    className="font-bold text-xs"
                  >
                    Quick Preset: Cloudflare R2
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bucket Name *
                    </label>
                    <input
                      className="input font-mono text-xs"
                      placeholder="e.g. littletalentchildcare"
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Region *
                    </label>
                    <input
                      className="input font-mono text-xs"
                      placeholder="auto (for R2) or us-east-1, eu-north-1"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      S3 Endpoint URL (Required for Cloudflare R2 / MinIO)
                    </label>
                    <input
                      className="input font-mono text-xs"
                      placeholder="https://<account-id>.r2.cloudflarestorage.com"
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Access Key ID *
                    </label>
                    <input
                      className="input font-mono text-xs"
                      placeholder="e.g. af10d7b6d2cd8071ef4ddd..."
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Secret Access Key *
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showS3Secret ? "text" : "password"}
                        className="input font-mono text-xs pr-10"
                        placeholder="e.g. e9aa62825ba90265104..."
                        value={s3SecretKey}
                        onChange={(e) => setS3SecretKey(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowS3Secret(!showS3Secret)}
                        className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600"
                      >
                        {showS3Secret ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Custom Public CDN URL (Optional)
                    </label>
                    <input
                      className="input font-mono text-xs"
                      placeholder="https://media.mychildcare.com"
                      value={s3PublicUrl}
                      onChange={(e) => setS3PublicUrl(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Force Path Style</p>
                      <p className="text-[11px] text-slate-400">Required for Cloudflare R2 and MinIO</p>
                    </div>
                    <Switch isSelected={s3PathStyle} onValueChange={setS3PathStyle} size="sm" color="primary" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Push Notifications (OneSignal) */}
      {selectedTab === "notifications" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-6 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BellRing size={18} className="text-rose-500" />
                  OneSignal Push Notifications
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send live push notifications to teachers and parents on mobile devices.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {oneSignalEnabled ? "Enabled" : "Disabled"}
                </span>
                <Switch isSelected={oneSignalEnabled} onValueChange={setOneSignalEnabled} color="primary" />
              </div>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  OneSignal App ID *
                </label>
                <input
                  className="input font-mono text-xs"
                  placeholder="e.g. f04b30a6-6386-41a4-9a50-05f846e2574b"
                  value={oneSignalAppId}
                  onChange={(e) => setOneSignalAppId(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Found in your OneSignal Dashboard under Settings &gt; Keys &amp; IDs. Matches the mobile app configuration.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  REST API Key *
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showOneSignalKey ? "text" : "password"}
                    className="input font-mono text-xs pr-10"
                    placeholder="os_v2_app_..."
                    value={oneSignalApiKey}
                    onChange={(e) => setOneSignalApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOneSignalKey(!showOneSignalKey)}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    {showOneSignalKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Secret API key for server-side push dispatch.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Logs */}
      {selectedTab === "audit" && (
        <div className="space-y-4">
          <DataTable
            columns={auditColumns}
            rows={auditList.rows}
            meta={auditList.meta}
            loading={auditList.loading}
            search={auditList.search}
            onSearch={auditList.setSearch}
            onPage={auditList.setPage}
            rowKey={(l) => l.id}
          />
        </div>
      )}
    </div>
  );
}
