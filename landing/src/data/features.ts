import {
  BookHeart,
  CalendarDays,
  Camera,
  CreditCard,
  HeartPulse,
  MessagesSquare,
  Megaphone,
  ShieldCheck,
  Sprout,
  UserCheck,
  BellRing,
  UtensilsCrossed,
} from "lucide-react";
import type { Dict } from "../i18n";

type Key = keyof Dict["features"]["items"];

export const features: { key: Key; icon: typeof BookHeart; color: string; tint: string }[] = [
  { key: "diary", icon: BookHeart, color: "#2cafa8", tint: "#eefbf9" },
  { key: "attendance", icon: UserCheck, color: "#10b981", tint: "#d1fae5" },
  { key: "chat", icon: MessagesSquare, color: "#6c5ce7", tint: "#ede9fe" },
  { key: "announcements", icon: Megaphone, color: "#f97316", tint: "#ffedd5" },
  { key: "events", icon: CalendarDays, color: "#ec4899", tint: "#fce7f3" },
  { key: "health", icon: HeartPulse, color: "#ef4444", tint: "#fee2e2" },
  { key: "milestones", icon: Sprout, color: "#16a34a", tint: "#dcfce7" },
  { key: "payments", icon: CreditCard, color: "#0ea5e9", tint: "#e0f2fe" },
  { key: "gallery", icon: Camera, color: "#ff5e7e", tint: "#ffe4e6" },
  { key: "plans", icon: UtensilsCrossed, color: "#f59e0b", tint: "#fef3c7" },
  { key: "push", icon: BellRing, color: "#8b5cf6", tint: "#ede9fe" },
  { key: "roles", icon: ShieldCheck, color: "#1f7571", tint: "#eefbf9" },
];
