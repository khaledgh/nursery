// Shapes mirrored from the Go API (GORM models serialize directly).

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

export interface Media {
  id: number;
  url: string;
  mime: string;
  created_at?: string;
}

export interface Guardian {
  id: number;
  parent_user_id: number;
  child_id: number;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
}

export interface ClassroomTeacher {
  id: number;
  teacher_user_id: number;
  role: "lead" | "assistant";
  teacher?: { id: number; name: string; avatar?: Media | null };
}

export interface Classroom {
  id: number;
  name: string;
  room_location: string;
  age_group: string;
  capacity: number;
  opens_at: string;
  closes_at: string;
  image?: Media | null;
  teachers?: ClassroomTeacher[];
}

export interface Child {
  id: number;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  blood_type: string;
  classroom_id: number | null;
  classroom?: Classroom | null;
  present_status: "checked_in" | "checked_out" | "absent";
  checked_in_at: string | null;
  avatar?: Media | null;
  guardians?: Guardian[];
}

export interface Classmate {
  id: number;
  first_name: string;
  avatar?: Media | null;
}

// ---- care ----

export interface MealLog {
  id: number;
  meal_type: "breakfast" | "lunch" | "snack" | "dinner";
  status: "ate_well" | "ate_half" | "ate_little" | "didnt_eat";
  served_at: string;
  note: string;
  image?: Media | null;
}

export interface SleepLog {
  id: number;
  start_at: string;
  end_at: string;
  total_minutes: number;
  quality_pct: number;
  mood_after: string;
  deep_min: number;
  light_min: number;
  awake_min: number;
  took_to_sleep_min: number;
}

export interface DiaperLog {
  id: number;
  time: string;
  wetness: "dry" | "wet" | "heavy";
  stool: "none" | "hard" | "normal" | "soft" | "loose" | "diarrhea";
  comfort: "happy" | "fussy";
  note: string;
}

export interface HydrationLog {
  id: number;
  date: string;
  cups: number;
  rating: string;
}

export interface DiaryEntry {
  id: number;
  type: "meal" | "sleep" | "activity" | "diaper" | "note" | "photo";
  title: string;
  body: string;
  occurred_at: string;
  is_live: boolean;
  logged_by?: { name: string } | null;
  media?: { media?: Media | null; sort: number }[];
}

export interface Dashboard {
  child: Child;
  meals: MealLog[];
  sleep: SleepLog[];
  diapers: DiaperLog[];
  hydration: HydrationLog;
  diary: DiaryEntry[];
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

// ---- planning ----

export interface ScheduleItem {
  id: number;
  weekday: number; // 0=Sunday .. 6=Saturday
  starts_at: string; // "09:00"
  title: string;
  description: string;
  icon: string;
  color: string;
  sort: number;
}

export interface WeeklyPlanItem {
  id: number;
  kind: "learning_area" | "activity" | "gain";
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

// ---- development ----

export interface MilestoneCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface ChildMilestone {
  id: number;
  category_id: number;
  category?: MilestoneCategory;
  progress_pct: number;
  description: string;
  status: "not_started" | "in_progress" | "achieved";
  assessed_at: string;
}

export interface ChildAchievement {
  id: number;
  template?: { title: string; description: string; icon: string; color: string };
  awarded_date: string;
  note: string;
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
  date: string;
  summary: string;
  highlight_text: string;
  highlight_media?: Media | null;
  home_tips: string[] | null;
  moods: ReportMood[] | null;
  ratings?: ReportRating[];
}

// ---- health ----

export interface Allergy {
  id: number;
  name: string;
  severity: "mild" | "moderate" | "severe";
}

export interface IllnessLog {
  id: number;
  title: string;
  status: "active" | "recovered" | "resolved";
  temperature: number;
  date: string;
  note: string;
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  schedule: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface Immunization {
  id: number;
  vaccine: string;
  given_date: string;
  next_due_date: string;
  status: string;
}

export interface Checkup {
  id: number;
  type: string;
  date: string;
  outcome: string;
  doctor: string;
}

export interface GrowthRecord {
  id: number;
  date: string;
  height_cm: number;
  weight_kg: number;
  head_circ_cm: number;
}

export interface VitalLog {
  id: number;
  date: string;
  temperature: number;
  mood: string;
  energy: string;
  appetite: string;
  sleep_summary: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relation: string;
  phone: string;
  priority: number;
}

export interface InsuranceInfo {
  id: number;
  provider: string;
  policy_no: string;
  status: string;
  valid_until: string;
}

export interface MedicalDocument {
  id: number;
  media?: Media | null;
  title: string;
  kind: string;
}

export interface HealthNote {
  id: number;
  title: string;
  body: string;
}

export interface HealthProfile {
  child: Child;
  allergies: Allergy[];
  illnesses: IllnessLog[];
  medications: Medication[];
  immunizations: Immunization[];
  checkups: Checkup[];
  growth: GrowthRecord[];
  vitals: VitalLog[];
  emergency_contacts: EmergencyContact[];
  insurance: InsuranceInfo[];
  documents: MedicalDocument[];
  notes: HealthNote[];
}

// ---- engagement ----

export interface EventRSVP {
  id: number;
  user_id: number;
  child_id: number | null;
  response: "yes" | "maybe" | "no";
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  location: string;
  audience: string;
  starts_at: string;
  ends_at: string | null;
  cover_media?: Media | null;
  status: "upcoming" | "completed" | "cancelled";
  rsvps?: EventRSVP[];
}

export interface EventDetail {
  event: EventItem;
  my_rsvp: EventRSVP | null;
  my_feedback: { loved: boolean; comment: string } | null;
}

export interface EventMedia {
  id: number;
  media?: Media | null;
  caption: string;
  child_id: number | null;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  category: "updates" | "reminders" | "events" | "health" | "general";
  badge: string;
  published_at: string | null;
  attachments?: { media?: Media | null }[];
}

export interface AnnouncementRow {
  announcement: Announcement;
  read_at: string | null;
  acknowledged_at: string | null;
  archived_at: string | null;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  author?: { id: number; name: string; role: string; avatar?: Media | null };
  body: string;
  created_at: string;
}

export interface MeetupRSVP {
  id: number;
  user_id: number;
  response: "going" | "interested";
}

export interface Meetup {
  id: number;
  title: string;
  location: string;
  starts_at: string;
  rsvps?: MeetupRSVP[];
}

export interface CommunityPost {
  id: number;
  author?: { id: number; name: string; role: string; avatar?: Media | null };
  type: "moment" | "activity";
  body: string;
  child_id: number | null;
  media?: { media?: Media | null }[];
  comments?: CommunityComment[];
  likes?: { user_id: number }[];
  meetup?: Meetup | null;
  created_at: string;
}

export interface Reminder {
  id: number;
  scope: string;
  title: string;
  description: string;
  date: string;
  items: string[] | null;
  kind: "upcoming" | "general";
  weather_alert: boolean;
  icon: string;
}

export interface NotificationItem {
  id: number;
  category: "updates" | "reminders" | "events" | "messages" | "health" | "general";
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface Attendance {
  id: number;
  child_id: number;
  date: string;
  status: "present" | "absent" | "late" | "early_pickup";
  note: string;
  confirmed_at: string | null;
}

// ---- payments ----

export interface InvoiceItem {
  id: number;
  label: string;
  amount_minor: number;
}

export interface InvoicePayment {
  id: number;
  provider: string;
  amount_minor: number;
  status: string;
  paid_at: string | null;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  currency: string;
  total_minor: number;
  due_date: string;
  status: "due" | "paid" | "overdue" | "cancelled";
  period: string;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}
