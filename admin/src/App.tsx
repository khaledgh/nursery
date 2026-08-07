import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import { LocalesPage } from "./features/locales/LocalesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
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
import { MessagesPage } from "./features/messages/MessagesPage";
import { BillingPage } from "./features/billing/BillingPage";
import { NurseriesPage } from "./features/superadmin/NurseriesPage";
import { PlansPage } from "./features/superadmin/PlansPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            {/* Real routes, so a family is linkable and survives a refresh. */}
            <Route path="families/new" element={<NewFamilyPage />} />
            <Route path="parents/:id" element={<ParentDetailPage />} />
            <Route path="children" element={<ChildrenPage />} />
            <Route path="children/:id" element={<ChildDetailPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="superadmin" element={<NurseriesPage />} />
            <Route path="superadmin/plans" element={<PlansPage />} />
            <Route path="classrooms" element={<ClassroomsPage />} />
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
            <Route path="locales" element={<LocalesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit" element={<AuditLogsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
