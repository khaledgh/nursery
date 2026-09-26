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
  LayoutDashboard,
  BellRing,
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

  const isSuperAdmin = user?.role === "superadmin";

  const visible: NavSection[] = isSuperAdmin
    ? [
        {
          label: "Platform",
          items: [
            { to: "/superadmin/dashboard", icon: LayoutDashboard, key: "nav.superadmin_dashboard", end: true },
            { to: "/superadmin", icon: Building2, key: "nav.nurseries", end: true },
            { to: "/superadmin/plans", icon: Layers, key: "nav.plans_admin" },
            { to: "/superadmin/reports", icon: BarChart3, key: "nav.superadmin_reports" },
            { to: "/superadmin/reminders", icon: BellRing, key: "nav.superadmin_reminders" },
          ],
        },
        {
          label: "System",
          items: [
            { to: "/settings", icon: Settings, key: "nav.settings" },
            { to: "/audit", icon: ScrollText, key: "nav.audit" },
          ],
        },
      ]
    : NAV.filter((s) => s.label !== "Platform")
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (item.roles && !item.roles.includes(user?.role ?? "")) return false;
            if (item.capability && ctx && !ctx.capabilities.includes(item.capability)) return false;
            return true;
          }),
        }))
        .filter((section) => section.items.length > 0);

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
      {/* Sleek HeroUI Sticky Sidebar */}
      <aside
        className={`sticky top-0 h-screen flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 shrink-0 z-40 overflow-hidden ${
          collapsed ? "w-16" : "w-56 sm:w-60"
        } shadow-sm`}
      >
        {/* Brand Header */}
        <div
          className={`shrink-0 h-12 sm:h-13 flex items-center border-b border-slate-100 dark:border-slate-800 transition-all px-3 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-8 w-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-xs border border-slate-200/80 dark:border-slate-700 p-0.5 overflow-hidden">
              <img src="/logo.png" alt="Nursee+" className="h-full w-full object-contain block max-h-full max-w-full" />
            </div>
            {!collapsed && (
              <div className="min-w-0 truncate">
                <span className="block text-sm font-black text-slate-900 dark:text-slate-100 truncate leading-tight tracking-tight">
                  {t("app.name")}
                </span>
                <span className="inline-block text-[9.5px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  {isSuperAdmin ? "Platform Console" : "Admin Portal"}
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="md"
              onPress={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="h-7 w-7 min-w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Menu size={16} />
            </Button>
          )}
        </div>

        {/* Navigation list - smooth internal scroll */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 px-2.5 py-2.5">
          {visible.map((section) => (
            <div key={section.label} className="space-y-0.5">
              {!collapsed && (
                <p className="px-3 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {section.label}
                </p>
              )}
              {section.items.map(({ to, icon: Icon, key, end }) => {
                const navLink = (
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center rounded-xl transition-all duration-150 ${
                        collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2"
                      } ${
                        isActive
                          ? "bg-[#2CAFA8] text-white shadow-sm font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white font-semibold"
                      } text-xs sm:text-[13px]`
                    }
                  >
                    <Icon size={17} className="shrink-0" />
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
        <div className="shrink-0 p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar
                  size="sm"
                  name={userInitials}
                  classNames={{
                    base: "w-7 h-7 bg-[#2CAFA8] text-white font-bold text-[10px] shrink-0 shadow-xs",
                  }}
                />
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate leading-tight">
                    {user?.name}
                  </div>
                  <Chip size="sm" color="primary" variant="flat" className="h-3.5 text-[8px] font-black px-1 uppercase leading-none mt-0.5">
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
                  radius="md"
                  onPress={signOut}
                  aria-label={t("nav.logout")}
                  className="h-7 w-7 min-w-7 text-danger hover:bg-danger/10"
                >
                  <LogOut size={14} />
                </Button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip content={t("nav.logout")} placement="right">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                radius="md"
                onPress={signOut}
                aria-label={t("nav.logout")}
                className="w-full h-9 text-danger hover:bg-danger/10"
              >
                <LogOut size={16} />
              </Button>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 h-12 sm:h-13 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            {collapsed && (
              <Button
                isIconOnly
                variant="light"
                radius="md"
                size="sm"
                onPress={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className="h-8 w-8 min-w-8 text-slate-500 hover:text-slate-800 dark:text-slate-400"
              >
                <Menu size={16} />
              </Button>
            )}
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Locale Switcher */}
            <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/60 dark:border-slate-700">
              {LOCALES.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => switchLocale(code)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition-all ${
                    locale === code
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Notification Popover Dropdown */}
            <Popover placement="bottom-end" showArrow offset={8}>
              <PopoverTrigger>
                <button
                  type="button"
                  className="relative flex items-center justify-center h-7 w-7 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors focus:outline-none"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8.5px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
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

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

            {/* User Profile Dropdown */}
            <Dropdown
              placement="bottom-end"
              classNames={{
                content: "p-2 min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl rounded-xl",
              }}
            >
              <DropdownTrigger>
                <button className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800 focus:outline-none">
                  <Avatar
                    size="sm"
                    name={userInitials}
                    classNames={{
                      base: "w-6.5 h-6.5 bg-brand-600 text-white font-bold text-[10px] shadow-sm",
                    }}
                  />
                  <div className="text-start hidden sm:block">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight">
                      {user?.name}
                    </div>
                    <div className="text-[9px] font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-wider leading-none mt-0.5">
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

        <main className="flex-1 p-3 sm:p-3.5 lg:p-4 w-full max-w-[1600px] mx-auto min-w-0">
          <BillingBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}


