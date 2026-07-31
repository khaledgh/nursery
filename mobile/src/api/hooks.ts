import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Announcement,
  AnnouncementRow,
  Attendance,
  Child,
  ChildAchievement,
  ChildMilestone,
  Classmate,
  CommunityPost,
  DailyReport,
  Dashboard,
  DiaperLog,
  DiaryEntry,
  EventDetail,
  EventItem,
  EventMedia,
  HealthProfile,
  HydrationLog,
  Invoice,
  ItemResponse,
  ListResponse,
  MealLog,
  NotificationItem,
  Reminder,
  ScheduleItem,
  SleepLog,
  WeeklyMenu,
  WeeklyPlan,
} from "./types";

export interface RangeParams {
  from?: string;
  to?: string;
  per_page?: number;
}

const list = async <T>(url: string, params?: Record<string, unknown>) =>
  (await api.get<ListResponse<T>>(url, { params })).data.data;

const item = async <T>(url: string, params?: Record<string, unknown>) =>
  (await api.get<ItemResponse<T>>(url, { params })).data.data;

// ---- children / dashboard ----

export function useChild(childId?: number) {
  return useQuery({
    queryKey: ["child", childId],
    enabled: !!childId,
    queryFn: () => item<Child>(`/children/${childId}`),
  });
}

export function useDashboard(childId?: number) {
  return useQuery({
    queryKey: ["dashboard", childId],
    enabled: !!childId,
    queryFn: () => item<Dashboard>(`/children/${childId}/dashboard`),
  });
}

// ---- care logs ----

export function useDiary(childId?: number, range?: RangeParams) {
  return useQuery({
    queryKey: ["diary", childId, range],
    enabled: !!childId,
    queryFn: () => list<DiaryEntry>(`/children/${childId}/diary`, { per_page: 50, ...range }),
  });
}

export function useMeals(childId?: number, range?: RangeParams) {
  return useQuery({
    queryKey: ["meals", childId, range],
    enabled: !!childId,
    queryFn: () => list<MealLog>(`/children/${childId}/meals`, { per_page: 50, ...range }),
  });
}

export function useSleep(childId?: number, range?: RangeParams) {
  return useQuery({
    queryKey: ["sleep", childId, range],
    enabled: !!childId,
    queryFn: () => list<SleepLog>(`/children/${childId}/sleep/history`, { per_page: 50, ...range }),
  });
}

export function useDiapers(childId?: number, range?: RangeParams) {
  return useQuery({
    queryKey: ["diapers", childId, range],
    enabled: !!childId,
    queryFn: () => list<DiaperLog>(`/children/${childId}/diaper/history`, { per_page: 50, ...range }),
  });
}

export function useHydration(childId?: number, range?: RangeParams) {
  return useQuery({
    queryKey: ["hydration", childId, range],
    enabled: !!childId,
    queryFn: () => list<HydrationLog>(`/children/${childId}/hydration`, { per_page: 14, ...range }),
  });
}

// ---- classroom: menu, schedule, plan, classmates ----

export function useWeeklyMenu(classroomId?: number | null, week?: string) {
  return useQuery({
    queryKey: ["menu", classroomId, week],
    enabled: !!classroomId,
    queryFn: () => item<WeeklyMenu[]>(`/classrooms/${classroomId}/menu`, { week }),
  });
}

export function useRateMenu(classroomId?: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { menuId: number; childId: number; rating: string }) =>
      api.post(`/menu/${input.menuId}/ratings`, { child_id: input.childId, rating: input.rating }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["menu", classroomId] }),
  });
}

export function useClassroom(classroomId?: number | null) {
  return useQuery({
    queryKey: ["classroom", classroomId],
    enabled: !!classroomId,
    queryFn: () => item<import("./types").Classroom>(`/classrooms/${classroomId}`),
  });
}

export function useClassroomSchedule(classroomId?: number | null) {
  return useQuery({
    queryKey: ["schedule", classroomId],
    enabled: !!classroomId,
    queryFn: () => item<ScheduleItem[]>(`/classrooms/${classroomId}/schedule`),
  });
}

export function useWeeklyPlan(classroomId?: number | null, week?: string) {
  return useQuery({
    queryKey: ["weeklyPlan", classroomId, week],
    enabled: !!classroomId,
    queryFn: () => item<WeeklyPlan | null>(`/classrooms/${classroomId}/weekly-plan`, { week }),
  });
}

export function useClassmates(classroomId?: number | null) {
  return useQuery({
    queryKey: ["classmates", classroomId],
    enabled: !!classroomId,
    queryFn: () => item<Classmate[]>(`/classrooms/${classroomId}/children`),
  });
}

// ---- development ----

export function useReports(childId?: number, range?: RangeParams) {
  return useQuery({
    queryKey: ["reports", childId, range],
    enabled: !!childId,
    queryFn: () => list<DailyReport>(`/children/${childId}/reports`, { per_page: 31, ...range }),
  });
}

export function useMilestones(childId?: number) {
  return useQuery({
    queryKey: ["milestones", childId],
    enabled: !!childId,
    queryFn: () => item<ChildMilestone[]>(`/children/${childId}/milestones`),
  });
}

export function useAchievements(childId?: number) {
  return useQuery({
    queryKey: ["achievements", childId],
    enabled: !!childId,
    queryFn: () => item<ChildAchievement[]>(`/children/${childId}/achievements`),
  });
}

// ---- health ----

export function useHealthProfile(childId?: number) {
  return useQuery({
    queryKey: ["health", childId],
    enabled: !!childId,
    queryFn: () => item<HealthProfile>(`/children/${childId}/health`),
  });
}

// ---- attendance ----

export function useRequestAttendance(childId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; status: "absent" | "late" | "early_pickup"; note?: string }) =>
      (await api.post<ItemResponse<Attendance>>(`/children/${childId}/attendance`, input)).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attendance", childId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", childId] });
    },
  });
}

// ---- events ----

export function useEvents(tab: "upcoming" | "previous") {
  return useQuery({
    queryKey: ["events", tab],
    queryFn: () => list<EventItem>("/events", { tab, per_page: 30 }),
  });
}

export function useEvent(id?: number) {
  return useQuery({
    queryKey: ["event", id],
    enabled: !!id,
    queryFn: () => item<EventDetail>(`/events/${id}`),
  });
}

export function useEventMedia(id?: number) {
  return useQuery({
    queryKey: ["eventMedia", id],
    enabled: !!id,
    queryFn: () => item<EventMedia[]>(`/events/${id}/media`),
  });
}

export function useRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventId: number; response: "yes" | "maybe" | "no"; childId?: number }) =>
      api.post(`/events/${input.eventId}/rsvp`, { response: input.response, child_id: input.childId }),
    onSuccess: (_, input) => {
      void qc.invalidateQueries({ queryKey: ["events"] });
      void qc.invalidateQueries({ queryKey: ["event", input.eventId] });
    },
  });
}

export function useEventFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventId: number; loved: boolean; comment?: string }) =>
      api.post(`/events/${input.eventId}/feedback`, { loved: input.loved, comment: input.comment ?? "" }),
    onSuccess: (_, input) => void qc.invalidateQueries({ queryKey: ["event", input.eventId] }),
  });
}

// ---- announcements ----

export function useAnnouncements(tab: "all" | "unread" | "archived") {
  return useQuery({
    queryKey: ["announcements", tab],
    queryFn: () => list<AnnouncementRow>("/announcements", { tab: tab === "all" ? undefined : tab, per_page: 30 }),
  });
}

export function useAnnouncement(id?: number) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["announcement", id],
    enabled: !!id,
    queryFn: async () => {
      // The GET marks the announcement read server-side.
      const data = await item<Announcement>(`/announcements/${id}`);
      void qc.invalidateQueries({ queryKey: ["announcements"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      return data;
    },
  });
}

export function useAcknowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.post(`/announcements/${id}/ack`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useArchiveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; archived: boolean }) =>
      api.post(`/announcements/${input.id}/${input.archived ? "archive" : "unarchive"}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

// ---- notifications ----

export function useNotifications(category?: string) {
  return useQuery({
    queryKey: ["notifications", category ?? "all"],
    queryFn: () => list<NotificationItem>("/notifications", { category: category || undefined, per_page: 50 }),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => item<{ unread: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ---- community ----

export function useCommunityPosts() {
  return useQuery({
    queryKey: ["community"],
    queryFn: () => list<CommunityPost>("/community/posts", { per_page: 30 }),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: "moment" | "activity";
      body: string;
      media_ids?: number[];
      meetup?: { title: string; location: string; starts_at: string };
    }) => api.post("/community/posts", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["community"] }),
  });
}

export function useComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: number; body: string }) =>
      api.post(`/community/posts/${input.postId}/comments`, { body: input.body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["community"] }),
  });
}

export function useToggleLike(myUserId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => api.post(`/community/posts/${postId}/like`),
    // Optimistic: flip my like locally, reconcile on settle.
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["community"] });
      const prev = qc.getQueryData<CommunityPost[]>(["community"]);
      if (prev && myUserId) {
        qc.setQueryData<CommunityPost[]>(
          ["community"],
          prev.map((p) => {
            if (p.id !== postId) return p;
            const likes = p.likes ?? [];
            const mine = likes.some((l) => l.user_id === myUserId);
            return { ...p, likes: mine ? likes.filter((l) => l.user_id !== myUserId) : [...likes, { user_id: myUserId }] };
          }),
        );
      }
      return { prev };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["community"], ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["community"] }),
  });
}

export function useMeetupRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { meetupId: number; response: "going" | "interested" }) =>
      api.post(`/meetups/${input.meetupId}/rsvp`, { response: input.response }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["community"] }),
  });
}

// ---- reminders ----

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => item<Reminder[]>("/reminders"),
  });
}

// ---- payments ----

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: () => list<Invoice>("/invoices", { per_page: 50 }),
  });
}

export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: number) =>
      (await api.post<ItemResponse<Record<string, unknown>>>(`/invoices/${invoiceId}/pay`, {})).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

// ---- teacher ----

/**
 * The children assigned to the signed-in teacher. `GET /children` is already
 * scoped server-side (teacher → their classrooms), so no dedicated endpoint is
 * needed; `present_status` and `checked_in_at` come back on each row, which is
 * what the roster renders.
 */
export function useTeacherRoster() {
  return useQuery({
    queryKey: ["teacherRoster"],
    queryFn: () => list<Child>("/children", { per_page: 100, sort: "first_name" }),
  });
}

/** Invalidates everything a care write can affect for one child. */
function invalidateChild(qc: ReturnType<typeof useQueryClient>, childId: number) {
  void qc.invalidateQueries({ queryKey: ["dashboard", childId] });
  void qc.invalidateQueries({ queryKey: ["teacherRoster"] });
}

export function useCheckInOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { childId: number; action: "check_in" | "check_out" }) =>
      (await api.post<ItemResponse<Attendance>>(`/children/${input.childId}/check`, { action: input.action })).data
        .data,
    onSuccess: (_res, input) => invalidateChild(qc, input.childId),
  });
}

export interface MealInput {
  childId: number;
  meal_type: string;
  status: string;
  note?: string;
  served_at?: string;
}

export function useLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, ...body }: MealInput) =>
      (await api.post<ItemResponse<MealLog>>(`/children/${childId}/meals`, body)).data.data,
    onSuccess: (_res, input) => invalidateChild(qc, input.childId),
  });
}

export interface SleepInput {
  childId: number;
  start_at: string;
  end_at?: string;
  quality?: number;
  note?: string;
}

export function useLogSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, ...body }: SleepInput) =>
      (await api.post<ItemResponse<SleepLog>>(`/children/${childId}/sleep`, body)).data.data,
    onSuccess: (_res, input) => invalidateChild(qc, input.childId),
  });
}

export interface DiaperInput {
  childId: number;
  wetness: string;
  stool: string;
  comfort?: string;
  note?: string;
  occurred_at?: string;
}

export function useLogDiaper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, ...body }: DiaperInput) =>
      (await api.post<ItemResponse<DiaperLog>>(`/children/${childId}/diaper`, body)).data.data,
    onSuccess: (_res, input) => invalidateChild(qc, input.childId),
  });
}

export function useUpsertHydration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { childId: number; cups: number }) =>
      (await api.put<ItemResponse<HydrationLog>>(`/children/${input.childId}/hydration`, { cups: input.cups })).data
        .data,
    onSuccess: (_res, input) => invalidateChild(qc, input.childId),
  });
}

export interface DiaryInput {
  childId: number;
  type: string;
  title: string;
  body?: string;
  media_ids?: number[];
  occurred_at?: string;
  /** Omit to notify guardians (the default); false posts the entry silently. */
  notify?: boolean;
}

export function useCreateDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, ...body }: DiaryInput) =>
      (await api.post<ItemResponse<DiaryEntry>>(`/children/${childId}/diary`, body)).data.data,
    onSuccess: (_res, input) => {
      invalidateChild(qc, input.childId);
      void qc.invalidateQueries({ queryKey: ["diary", input.childId] });
    },
  });
}
