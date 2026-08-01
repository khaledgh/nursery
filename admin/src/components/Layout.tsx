import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  HeartPulse,
  Home,
  Languages,
  LogOut,
  MessagesSquare,
  School,
  ScrollText,
  Settings,
  Trophy,
  Users,
  UtensilsCrossed,
  Baby,
  BookOpen,
  Search,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/auth";
import { applyLocale } from "../i18n";
import { api } from "../lib/api";

const NAV = [
  { to: "/", icon: Home, key: "nav.dashboard", end: true },
  { to: "/users", icon: Users, key: "nav.users" },
  { to: "/children", icon: Baby, key: "nav.children" },
  { to: "/classrooms", icon: School, key: "nav.classrooms" },
  { to: "/attendance", icon: CalendarCheck, key: "nav.attendance" },
  { to: "/care", icon: HeartPulse, key: "nav.care" },
  { to: "/reports", icon: FileText, key: "nav.reports" },
  { to: "/milestones", icon: Trophy, key: "nav.milestones" },
  { to: "/menus", icon: UtensilsCrossed, key: "nav.menus" },
  { to: "/weekly-plans", icon: BookOpen, key: "nav.plans" },
  { to: "/announcements", icon: Bell, key: "nav.announcements" },
  { to: "/events", icon: CalendarDays, key: "nav.events" },
  { to: "/community", icon: MessagesSquare, key: "nav.community" },
  { to: "/reminders", icon: ClipboardList, key: "nav.reminders" },
  { to: "/invoices", icon: CreditCard, key: "nav.invoices" },
  { to: "/locales", icon: Languages, key: "nav.locales" },
  { to: "/settings", icon: Settings, key: "nav.settings" },
  { to: "/audit", icon: ScrollText, key: "nav.audit" },
];

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "sv", label: "SV" },
  { code: "ar", label: "ع" },
];

export function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, locale, setLocale, refreshToken, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

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
    <div className="flex min-h-screen bg-slate-50/40">
      <aside className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 shrink-0 ${collapsed ? "w-20" : "w-64"}`}>
        <div className={`flex items-center gap-3 py-6 border-b border-slate-100 transition-all duration-300 ${collapsed ? "justify-center px-2" : "px-6"}`}>
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 rounded-xl bg-brand-50 p-1.5 border border-brand-100 shadow-sm"
          />
          {!collapsed && (
            <div className="min-w-0 truncate">
              <span className="block text-[15px] font-extrabold leading-tight text-brand-900 truncate">{t("app.name")}</span>
              <span className="block text-[10px] font-bold text-brand-600/80 uppercase tracking-widest mt-0.5 truncate">Admin Portal</span>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? t(key) : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-xl transition-all duration-200 ${
                  collapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                } ${
                  isActive
                    ? "bg-brand-50 text-brand-800 shadow-sm shadow-brand-600/5 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 font-semibold"
                } text-sm`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{t(key)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={signOut}
            title={collapsed ? t("nav.logout") : undefined}
            className={`w-full flex items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors ${
              collapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
            } text-sm font-semibold`}
          >
            <LogOut size={18} />
            {!collapsed && <span>{t("nav.logout")}</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4 shadow-sm shadow-slate-100/10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-xl p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={18} />
            </button>
            <div className="relative w-48 md:w-64">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search rooms, kids, records..."
                className="w-full rounded-xl bg-slate-50/70 border-none px-4 py-2 ps-9 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all placeholder:text-slate-400 text-slate-700"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center rounded-xl bg-slate-50 border border-slate-100 p-0.5">
              {LOCALES.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => switchLocale(code)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    locale === code ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            
            <div className="h-6 w-px bg-slate-200"></div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white font-extrabold text-xs shadow-md shadow-brand-600/20">
                {userInitials}
              </div>
              <div className="text-sm">
                <div className="font-bold text-slate-800 leading-tight">{user?.name}</div>
                <div className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mt-0.5">{user?.role}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
