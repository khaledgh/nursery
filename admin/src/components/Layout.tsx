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
} from "lucide-react";
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-brand-900 text-brand-100">
        {/* The logo mark reads on the dark sidebar; the artwork's own wordmark is
            dark blue and would not, so the name is rendered as text beside it. */}
        <div className="flex items-center gap-3 px-6 py-5">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded-lg bg-white p-1"
          />
          <span className="text-base font-bold leading-tight text-white">{t("app.name")}</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-brand-700 text-white" : "hover:bg-brand-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-brand-800 hover:text-white"
        >
          <LogOut size={18} />
          {t("nav.logout")}
        </button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {LOCALES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => switchLocale(code)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  locale === code ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="text-sm">
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.role}</div>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
