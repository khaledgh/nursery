// Shapes mirrored from the Go API responses.

export interface Meta {
  page: number;
  per_page: number;
  total: number;
}

export interface ListResponse<T> {
  data: T[];
  meta: Meta;
}

export interface ItemResponse<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export type Role = "superadmin" | "admin" | "teacher" | "parent";

export interface Media {
  id: number;
  url: string;
  mime: string;
  size: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  locale: string;
  status: "active" | "inactive";
  last_login_at: string | null;
  created_at: string;
  avatar?: Media | null;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  /** Nursery-issued mobile credential. Absent for admins and superadmins. */
  login_id?: string | null;
  role: Role;
  locale: string;
  nursery_id: number;
}

// --- multi-tenancy, subscription, capabilities ---

export type Capability =
  | "payments"
  | "reports"
  | "community"
  | "chat"
  | "events"
  | "health";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

export interface SeatUsage {
  plan_code: string;
  plan_name: string;
  status: SubscriptionStatus;
  students_used: number;
  students_max: number;
  students_remaining: number;
  staff_used: number;
  staff_max: number;
  /** False once a subscription lapses — reads stay open, writes stop. */
  allows_writes: boolean;
  payment_due: boolean;
  period_end: string | null;
  grace_until: string | null;
}

export interface Nursery {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended" | "cancelled";
  locale: string;
  timezone: string;
}

/** One call on load: identity, tenant, purchased modules, seats left. */
export interface MeContext {
  user: AuthUser;
  nursery: Nursery;
  capabilities: Capability[];
  seats?: SeatUsage;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  max_students: number;
  max_staff: number;
  price_minor: number;
  currency: string;
  billing_period: "monthly" | "yearly";
  is_active: boolean;
}

export interface NurseryOverview extends Nursery {
  plan_code: string;
  subscription_status: SubscriptionStatus;
  students_used: number;
  students_max: number;
  created_at: string;
}

export interface PlatformStats {
  nurseries: number;
  active_nurseries: number;
  children: number;
  users: number;
  overdue_invoices: number;
  mrr_minor: number;
  nurseries_past_due: number;
}

export interface SubscriptionInvoice {
  id: number;
  nursery_id: number;
  invoice_no: string;
  amount_minor: number;
  currency: string;
  period: string;
  due_date: string;
  status: "due" | "paid" | "overdue" | "cancelled";
  paid_at: string | null;
}

// --- chat ---

export interface Conversation {
  id: number;
  type: "parent_teacher" | "parent_admin";
  parent_user_id: number;
  recipient_user_id: number;
  parent_user?: User | null;
  recipient_user?: User | null;
  child?: Child | null;
  last_message_at: string | null;
  last_message_preview: string;
  unread_count: number;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_user_id: number;
  sender_user?: User | null;
  body: string;
  media?: Media | null;
  read_at: string | null;
  created_at: string;
}

// --- family workflow ---

export interface FamilyParent {
  id: number;
  name: string;
  email: string;
  phone: string;
  login_id?: string | null;
  status: string;
  locale: string;
}

export interface FamilyChild extends Child {
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
}

export interface FamilyResponse {
  parent: FamilyParent;
  child: Child;
  created: boolean;
}

/** Backs /parents/:id — the family hub the panel previously lacked. */
export interface ParentDetail {
  parent: FamilyParent;
  children: FamilyChild[];
  invoices: Invoice[];
  outstanding_minor: number;
  paid_minor: number;
  unpaid_invoices: number;
}

export interface TokenPair {
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: TokenPair;
}

export interface Guardian {
  id: number;
  parent_user_id: number;
  child_id: number;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
  parent?: User;
}

export interface Child {
  id: number;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  blood_type: string;
  classroom_id: number | null;
  status: string;
  present_status: "checked_in" | "checked_out" | "absent";
  checked_in_at: string | null;
  classroom?: Classroom | null;
  guardians?: Guardian[];
  avatar?: Media | null;
  created_at: string;
}

export interface ClassroomTeacher {
  id: number;
  classroom_id: number;
  teacher_user_id: number;
  role: "lead" | "assistant";
  teacher?: User;
}

export interface ClassroomTranslation {
  locale: string;
  name: string;
}

export interface Classroom {
  id: number;
  name: string;
  room_location: string;
  age_group: string;
  capacity: number;
  opens_at: string;
  closes_at: string;
  teachers?: ClassroomTeacher[];
  image?: Media | null;
}

export interface Attendance {
  id: number;
  child_id: number;
  date: string;
  status: "present" | "absent" | "late" | "early_pickup";
  checked_in_at: string | null;
  checked_out_at: string | null;
  note: string;
  confirmed_at: string | null;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  category: string;
  badge: string;
  published_at: string | null;
  created_at: string;
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  location: string;
  audience: string;
  starts_at: string;
  ends_at: string | null;
  status: "upcoming" | "completed" | "cancelled";
  rsvps?: { response: string }[];
}

export interface Reminder {
  id: number;
  scope: "global" | "classroom" | "child";
  scope_id: number | null;
  title: string;
  description: string;
  date: string;
  kind: string;
  weather_alert: boolean;
}

export interface InvoiceItem {
  id: number;
  label: string;
  amount_minor: number;
}

export interface Invoice {
  id: number;
  child_id: number;
  payer_user_id: number;
  invoice_no: string;
  currency: string;
  total_minor: number;
  due_date: string;
  status: "due" | "paid" | "overdue" | "cancelled";
  period: string;
  items?: InvoiceItem[];
  child?: Child;
}

export interface Locale {
  code: string;
  name: string;
  native_name: string;
  direction: "ltr" | "rtl";
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface UITranslation {
  id: number;
  locale: string;
  namespace: string;
  key: string;
  value: string;
}

export interface ContentTranslation {
  id: number;
  entity_type: string;
  entity_id: number;
  locale: string;
  field: string;
  value: string;
}

export interface AuditLog {
  id: number;
  actor_user_id: number;
  action: string;
  entity: string;
  entity_id: number;
  diff: unknown;
  ip: string;
  created_at: string;
}

export interface MenuRating {
  id: number;
  weekly_menu_id: number;
  child_id: number;
  rating: "eats" | "sometimes" | "doesnt_eat";
}

export interface WeeklyMenu {
  id: number;
  classroom_id: number;
  date: string;
  meal_type: "breakfast" | "lunch" | "snack" | "dinner";
  dish_name: string;
  items: string[] | null;
  is_balanced: boolean;
  image?: Media | null;
  ratings?: MenuRating[];
}

export interface ScheduleItem {
  id: number;
  classroom_id: number;
  weekday: number; // 0=Sunday .. 6=Saturday
  starts_at: string; // "09:00"
  title: string;
  description: string;
  icon: string;
  color: string;
  sort: number;
}

export type PlanItemKind = "learning_area" | "activity" | "gain";

export interface WeeklyPlanItem {
  id: number;
  kind: PlanItemKind;
  day: number | null;
  title: string;
  description: string;
  icon: string;
  color: string;
  sort: number;
}

export interface WeeklyPlan {
  id: number;
  classroom_id: number;
  week_start: string;
  note: string;
  items?: WeeklyPlanItem[];
}

export interface ReportRating {
  dimension: "social" | "participation" | "listening" | "focus" | "hygiene" | "eating";
  rating: "thriving" | "doing_well" | "improving" | "needs_support";
  note: string;
}

export interface ReportMood {
  key: "social" | "creative" | "happy" | "calm";
  rating: "great" | "good" | "okay";
}

export interface DailyReport {
  id: number;
  child_id: number;
  date: string;
  summary: string;
  highlight_text: string;
  highlight_media?: Media | null;
  home_tips: string[] | null;
  moods: ReportMood[] | null;
  ratings?: ReportRating[];
}

export interface ChildMilestone {
  id: number;
  child_id: number;
  category_id: number;
  category?: MilestoneCategory;
  progress_pct: number;
  description: string;
  status: "not_started" | "in_progress" | "achieved";
  assessed_at: string;
}

export interface ChildAchievement {
  id: number;
  child_id: number;
  achievement_template_id: number;
  template?: AchievementTemplate;
  awarded_date: string;
  note: string;
}

export interface EventMedia {
  id: number;
  event_id: number;
  media?: Media;
  caption: string;
  child_id: number | null;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  author?: User;
  body: string;
  created_at: string;
}

export interface CommunityPost {
  id: number;
  author?: User;
  type: "moment" | "activity";
  body: string;
  media?: { media?: Media }[];
  comments?: CommunityComment[];
  likes?: { user_id: number }[];
  meetup?: { id: number; title: string; location: string; starts_at: string } | null;
  created_at: string;
}

export interface MilestoneCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface AchievementTemplate {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
}

// --- global search ---

export interface SearchHit {
  id: number;
  label: string;
  sub: string;
}

export interface SearchResults {
  children?: SearchHit[];
  parents?: SearchHit[];
  staff?: SearchHit[];
  classrooms?: SearchHit[];
  invoices?: SearchHit[];
}
