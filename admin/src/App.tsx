import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { HeroUIProvider } from "@heroui/react";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { UsersPage } from "./features/users/UsersPage";
import { ChildrenPage } from "./features/children/ChildrenPage";
import { ClassroomsPage } from "./features/classrooms/ClassroomsPage";
import { CarePage } from "./features/care/CarePage";
import { AnnouncementsPage } from "./features/announcements/AnnouncementsPage";
import { EventsPage } from "./features/events/EventsPage";
import { RemindersPage } from "./features/reminders/RemindersPage";
import { InvoicesPage } from "./features/payments/InvoicesPage";
import { InvoiceDetailPage } from "./features/payments/InvoiceDetailPage";
import { NotificationsPage } from "./features/notifications/NotificationsPage";
import { LocalesPage } from "./features/locales/LocalesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { NurserySettingsPage } from "./features/settings/NurserySettingsPage";
import { AuditLogsPage } from "./features/audit/AuditLogsPage";
import { MenusPage } from "./features/menus/MenusPage";
import { WeeklyPlansPage } from "./features/plans/WeeklyPlansPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { AnalyticsPage } from "./features/reports/AnalyticsPage";
import { MilestonesPage } from "./features/milestones/MilestonesPage";
import { AttendancePage } from "./features/attendance/AttendancePage";
import { CommunityPage } from "./features/community/CommunityPage";
import { NewFamilyPage } from "./features/families/NewFamilyPage";
import { ParentDetailPage } from "./features/families/ParentDetailPage";
import { ChildDetailPage } from "./features/children/ChildDetailPage";
import { ClassroomDetailPage } from "./features/classrooms/ClassroomDetailPage";
import { MessagesPage } from "./features/messages/MessagesPage";
import { BillingPage } from "./features/billing/BillingPage";
import { NurseriesPage } from "./features/superadmin/NurseriesPage";
import { NurseryDetailPage } from "./features/superadmin/NurseryDetailPage";
import { PlansPage } from "./features/superadmin/PlansPage";
import { SuperAdminDashboardPage } from "./features/superadmin/SuperAdminDashboardPage";
import { SuperAdminReportsPage } from "./features/superadmin/SuperAdminReportsPage";
import { SuperAdminRemindersPage } from "./features/superadmin/SuperAdminRemindersPage";
import { DemoRequestsPage } from "./features/superadmin/DemoRequestsPage";

import { useAuthStore } from "./store/auth";

function RootPage() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === "superadmin") {
    return <SuperAdminDashboardPage />;
  }
  return <DashboardPage />;
}

function AppContent() {
  const navigate = useNavigate();

  return (
    <HeroUIProvider navigate={navigate}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<RootPage />} />
            <Route path="users" element={<UsersPage />} />
            {/* Real routes, so a family is linkable and survives a refresh. */}
            <Route path="families/new" element={<NewFamilyPage />} />
            <Route path="parents/:id" element={<ParentDetailPage />} />
            <Route path="children" element={<ChildrenPage />} />
            <Route path="children/:id" element={<ChildDetailPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="superadmin" element={<NurseriesPage />} />
            <Route path="superadmin/nurseries/:id" element={<NurseryDetailPage />} />
            <Route path="superadmin/dashboard" element={<SuperAdminDashboardPage />} />
            <Route path="superadmin/plans" element={<PlansPage />} />
            <Route path="superadmin/reports" element={<SuperAdminReportsPage />} />
            <Route path="superadmin/reminders" element={<SuperAdminRemindersPage />} />
            <Route path="superadmin/demo-requests" element={<DemoRequestsPage />} />
            <Route path="classrooms" element={<ClassroomsPage />} />
            <Route path="classrooms/:id" element={<ClassroomDetailPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="care" element={<CarePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="milestones" element={<MilestonesPage />} />
            <Route path="menus" element={<MenusPage />} />
            <Route path="weekly-plans" element={<WeeklyPlansPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="reminders" element={<RemindersPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="locales" element={<SuperAdminOnly><LocalesPage /></SuperAdminOnly>} />
            <Route path="settings" element={<RoleSettings />} />
            <Route path="audit" element={<SuperAdminOnly><AuditLogsPage /></SuperAdminOnly>} />
          </Route>
        </Route>
      </Routes>
    </HeroUIProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

/** Platform-wide pages (languages, audit): the API enforces this too. */
function SuperAdminOnly({ children }: { children: ReactElement }) {
  const role = useAuthStore((s) => s.user?.role);
  return role === "superadmin" ? children : <Navigate to="/" replace />;
}

/** Superadmin gets platform settings; a nursery admin gets their nursery's. */
function RoleSettings() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "superadmin" ? <SettingsPage /> : <NurserySettingsPage />;
}
