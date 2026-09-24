import {
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Home,
  Languages,
  LogOut,
  MessagesSquare,
  School,
  ScrollText,
  Settings,
  Users,
  Baby,
  Menu,
  Wallet,
  Building2,
  Layers,
  BarChart3,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Chip,
  Tooltip,
} from "@heroui/react";
import { useAuthStore } from "../store/auth";
import { applyLocale } from "../i18n";
import { api } from "../lib/api";
import { useMeContext } from "../hooks/useMeContext";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { BillingBanner } from "./SeatMeter";
import { GlobalSearch } from "./GlobalSearch";
import type { Capability, ListResponse, Notification } from "../types/api";

interface NavItem {
  to: string;
  icon: typeof Home;
  key: string;
  end?: boolean;
  capability?: Capability;
  roles?: string[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [{ to: "/", icon: Home, key: "nav.dashboard", end: true }],
  },
  {
    label: "People",
    items: [
      { to: "/users", icon: Users, key: "nav.users" },
      { to: "/children", icon: Baby, key: "nav.children" },
      { to: "/classrooms", icon: School, key: "nav.classrooms" },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/messages", icon: MessagesSquare, key: "nav.messages", capability: "chat" },
      { to: "/announcements", icon: Bell, key: "nav.announcements" },
      { to: "/events", icon: CalendarDays, key: "nav.events", capability: "events" },
      { to: "/community", icon: Users, key: "nav.community", capability: "community" },
      { to: "/reminders", icon: ClipboardList, key: "nav.reminders" },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/invoices", icon: CreditCard, key: "nav.invoices", capability: "payments" },
      { to: "/analytics", icon: BarChart3, key: "nav.analytics", capability: "reports" },
      { to: "/billing", icon: Wallet, key: "nav.billing", roles: ["admin", "superadmin"] },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/settings", icon: Settings, key: "nav.settings" },
      { to: "/locales", icon: Languages, key: "nav.locales" },
      { to: "/audit", icon: ScrollText, key: "nav.audit" },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/superadmin", icon: Building2, key: "nav.nurseries", roles: ["superadmin"] },
      { to: "/superadmin/plans", icon: Layers, key: "nav.plans_admin", roles: ["superadmin"] },
    ],
  },
];

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "sv", label: "SV" },
  { code: "ar", label: "ع" },
];

export function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, locale, setLocale, refreshToken, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const { data: ctx } = useMeContext();
  const unread = useUnreadCount();

  // Fetch recent notifications for header dropdown
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications-list-recent"],
    queryFn: async () =>
      (await api.get<ListResponse<Notification>>("/notifications", { params: { per_page: 6 } })).data.data,
    enabled: Boolean(user),
    refetchInterval: 45_000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-list"] });
      void qc.invalidateQueries({ queryKey: ["notifications-list-recent"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const notifications = notificationsData ?? [];

  const visible = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.roles && !item.roles.includes(user?.role ?? "")) return false;
      if (item.capability && ctx && !ctx.capabilities.includes(item.capability)) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const signOut = async () => {
    try {
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } catch {
      // best effort — local logout regardless
    }
    logout();
    navigate("/login");
  };

  const switchLocale = (code: string) => {
    setLocale(code);
    applyLocale(code);
  };

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "AD";

  return (
    <div className="flex min-h-screen bg-slate-50/70 dark:bg-slate-950">
      {/* Redesigned HeroUI Sticky Sidebar */}
      <aside
        className={`sticky top-0 h-screen flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 shrink-0 z-40 overflow-hidden ${
          collapsed ? "w-20" : "w-72"
        } shadow-sm`}
      >
        {/* Brand Header */}
        <div
          className={`shrink-0 flex items-center gap-3 py-4 px-4 border-b border-slate-100 dark:border-slate-800 transition-all ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary/25 p-1.5">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain filter brightness-0 invert" />
            </div>
            {!collapsed && (
              <div className="min-w-0 truncate">
                <span className="block text-base font-black text-slate-900 dark:text-slate-100 truncate leading-snug">
                  {t("app.name")}
                </span>
                <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  Admin Portal
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              onPress={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Menu size={16} />
            </Button>
          )}
        </div>

        {/* Navigation list - smooth internal scroll */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-6 px-3 py-4">
          {visible.map((section) => (
            <div key={section.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.label}
                </p>
              )}
              {section.items.map(({ to, icon: Icon, key, end }) => {
                const navLink = (
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center rounded-2xl transition-all duration-200 ${
                        collapsed ? "justify-center p-3" : "gap-3.5 px-3.5 py-2.5"
                      } ${
                        isActive
                          ? "bg-primary text-white shadow-lg shadow-primary/25 font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100 font-semibold"
                      } text-sm`
                    }
                  >
                    <Icon size={19} className="shrink-0" />
                    {!collapsed && <span className="truncate">{t(key)}</span>}
                  </NavLink>
                );

                return (
                  <div key={to}>
                    {collapsed ? (
                      <Tooltip content={t(key)} placement="right" color="foreground" delay={100}>
                        {navLink}
                      </Tooltip>
                    ) : (
                      navLink
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: User Card & Sign Out */}
        <div className="shrink-0 p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  size="sm"
                  name={userInitials}
                  classNames={{
                    base: "bg-primary text-white font-bold text-xs shrink-0 shadow-sm",
                  }}
                />
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate">
                    {user?.name}
                  </div>
                  <Chip size="sm" color="primary" variant="flat" className="h-4 text-[9px] font-bold px-1 uppercase">
                    {user?.role}
                  </Chip>
                </div>
              </div>

              <Tooltip content={t("nav.logout")} placement="top">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  radius="lg"
                  onPress={signOut}
                  aria-label={t("nav.logout")}
                  className="text-danger hover:bg-danger/10"
                >
                  <LogOut size={16} />
                </Button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip content={t("nav.logout")} placement="right">
              <Button
                isIconOnly
                size="md"
                variant="light"
                color="danger"
                radius="lg"
                onPress={signOut}
                aria-label={t("nav.logout")}
                className="w-full text-danger hover:bg-danger/10"
              >
                <LogOut size={18} />
              </Button>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-8 py-3.5 shadow-sm">
          <div className="flex items-center gap-4">
            {collapsed && (
              <Button
                isIconOnly
                variant="light"
                radius="lg"
                size="sm"
                onPress={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400"
              >
                <Menu size={18} />
              </Button>
            )}
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-4 sm:gap-5">
            {/* Locale Switcher */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/60 dark:border-slate-700">
              {LOCALES.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => switchLocale(code)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    locale === code
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Notification Popover Dropdown */}
            <Popover placement="bottom-end" showArrow offset={10}>
              <PopoverTrigger>
                <button
                  type="button"
                  className="relative flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors focus:outline-none"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 sm:w-96 p-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 backdrop-blur-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-150 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Notifications</h4>
                    {unread > 0 && (
                      <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px] font-bold">
                        {unread} new
                      </Chip>
                    )}
                  </div>
                  {unread > 0 && (
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      className="text-xs font-bold h-7 px-2"
                      isLoading={markAllRead.isPending}
                      onPress={() => markAllRead.mutate()}
                      startContent={<CheckCheck size={14} />}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-medium">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          !n.read_at ? "bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                            !n.read_at
                              ? "bg-primary/10 text-primary-700 dark:text-primary-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          }`}
                        >
                          <Bell size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {n.body}
                            </p>
                          )}
                          <span className="text-[10px] font-semibold text-slate-400 mt-1 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {!n.read_at && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 shadow-sm shadow-primary/50" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer link */}
                <div className="p-2.5 border-t border-slate-150 dark:border-slate-800 text-center">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    className="w-full text-xs font-bold"
                    endContent={<ChevronRight size={14} />}
                    onPress={() => navigate("/notifications")}
                  >
                    View all notifications
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

            {/* User Profile Dropdown */}
            <Dropdown
              placement="bottom-end"
              classNames={{
                content: "p-2 min-w-[240px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-2xl",
              }}
            >
              <DropdownTrigger>
                <button className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800 focus:outline-none">
                  <Avatar
                    size="sm"
                    name={userInitials}
                    classNames={{
                      base: "bg-primary text-white font-bold text-xs shadow-md shadow-primary/25",
                    }}
                  />
                  <div className="text-start hidden sm:block">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight">
                      {user?.name}
                    </div>
                    <div className="text-[10px] font-extrabold text-primary uppercase tracking-wider mt-0.5">
                      {user?.role}
                    </div>
                  </div>
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="User Actions"
                variant="flat"
                className="p-1"
                itemClasses={{
                  base: "rounded-xl py-2 px-3 text-xs font-semibold data-[hover=true]:bg-slate-100 dark:data-[hover=true]:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-200",
                }}
              >
                <DropdownItem
                  key="profile"
                  className="h-14 gap-2 opacity-100 cursor-default bg-slate-50 dark:bg-slate-800/40 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-800"
                  textValue="Signed in user"
                >
                  <p className="font-semibold text-[11px] text-slate-400">Signed in as</p>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{user?.email}</p>
                </DropdownItem>
                <DropdownItem
                  key="settings"
                  startContent={<Settings size={15} className="text-slate-400" />}
                  onPress={() => navigate("/settings")}
                >
                  {t("nav.settings")}
                </DropdownItem>
                <DropdownItem
                  key="audit"
                  startContent={<ScrollText size={15} className="text-slate-400" />}
                  onPress={() => navigate("/audit")}
                >
                  {t("nav.audit")}
                </DropdownItem>
                <DropdownItem
                  key="logout"
                  color="danger"
                  className="text-danger data-[hover=true]:bg-danger/10 mt-1 border-t border-slate-100 dark:border-slate-800/60 pt-2"
                  startContent={<LogOut size={15} className="text-danger" />}
                  onPress={signOut}
                >
                  {t("nav.logout")}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 p-8">
          <BillingBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}


