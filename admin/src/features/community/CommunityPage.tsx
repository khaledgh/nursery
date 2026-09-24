import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MessageCircle,
  Moon,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserX,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Switch,
  Tab,
  Tabs,
} from "@heroui/react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { api, errorMessage } from "../../lib/api";
import type {
  CommunityModerationStatus,
  CommunityPost,
  ItemResponse,
  ListResponse,
} from "../../types/api";

type DeleteTarget = { kind: "post" | "comment"; id: number; label: string };

export function CommunityPage() {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("feed");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [banUserTarget, setBanUserTarget] = useState<{ id: number; name: string; email: string } | null>(null);
  const [banReason, setBanReason] = useState("Inappropriate language and tone in community discussions");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Feed Query
  const postsQuery = useQuery({
    queryKey: ["community-admin-posts"],
    queryFn: async () =>
      (await api.get<ListResponse<CommunityPost>>("/community/posts", { params: { per_page: 100 } })).data.data,
  });

  // Moderation & Hours Query
  const moderationQuery = useQuery({
    queryKey: ["community-moderation"],
    queryFn: async () =>
      (await api.get<ItemResponse<CommunityModerationStatus>>("/admin/community/moderation")).data.data,
  });

  // Hours local form state
  const modData = moderationQuery.data;
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [hoursStart, setHoursStart] = useState("07:00");
  const [hoursEnd, setHoursEnd] = useState("00:00");
  const [hoursFormSynced, setHoursFormSynced] = useState(false);

  if (modData && !hoursFormSynced) {
    setHoursEnabled(modData.hours_enabled);
    setHoursStart(modData.hours_start || "07:00");
    setHoursEnd(modData.hours_end || "00:00");
    setHoursFormSynced(true);
  }

  // Delete Post or Comment Mutation
  const removeMutation = useMutation({
    mutationFn: async (target: DeleteTarget) =>
      target.kind === "post"
        ? api.delete(`/community/posts/${target.id}`)
        : api.delete(`/community/comments/${target.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-admin-posts"] });
      setDeleting(null);
      setError("");
      setSuccessMsg("Item deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // Ban User Mutation
  const banMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) =>
      api.post("/admin/community/ban", { user_id: userId, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-moderation"] });
      void qc.invalidateQueries({ queryKey: ["community-admin-posts"] });
      setBanUserTarget(null);
      setBanReason("Inappropriate language and tone in community discussions");
      setError("");
      setSuccessMsg("User has been suspended from posting or commenting in the community.");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // Unban User Mutation
  const unbanMutation = useMutation({
    mutationFn: async (userId: number) =>
      api.post("/admin/community/unban", { user_id: userId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-moderation"] });
      void qc.invalidateQueries({ queryKey: ["community-admin-posts"] });
      setError("");
      setSuccessMsg("User access to community has been restored.");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // Save Hours Mutation
  const saveHoursMutation = useMutation({
    mutationFn: async () =>
      api.put("/admin/community/hours", {
        enabled: hoursEnabled,
        start: hoursStart,
        end: hoursEnd,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-moderation"] });
      setError("");
      setSuccessMsg("Community active hours updated successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const bannedUserIds = useMemo(() => {
    return new Set((modData?.banned_users ?? []).map((b) => b.user_id));
  }, [modData?.banned_users]);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    const list = postsQuery.data ?? [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (p) =>
        p.body.toLowerCase().includes(q) ||
        p.author?.name?.toLowerCase().includes(q) ||
        p.meetup?.title?.toLowerCase().includes(q)
    );
  }, [postsQuery.data, searchTerm]);

  const totalCommentsCount = useMemo(() => {
    return (postsQuery.data ?? []).reduce((acc, p) => acc + (p.comments?.length || 0), 0);
  }, [postsQuery.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Community & Social Hub"
        subtitle="Manage nursery parent discussions, moderate content, set talking hours, and handle suspensions."
      />

      {/* Top 4 KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Posts */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Community Posts
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {postsQuery.data?.length ?? 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
          </CardBody>
        </Card>

        {/* Total Comments */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total Comments
              </span>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {totalCommentsCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Users size={18} />
            </div>
          </CardBody>
        </Card>

        {/* Operating Hours Status */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Talking Schedule
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                {modData?.hours_enabled ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color={modData.is_open ? "success" : "warning"}
                    className="h-5 text-[10px] font-black"
                  >
                    {modData.is_open ? "OPEN (Active)" : "QUIET HOURS"}
                  </Chip>
                ) : (
                  <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px] font-black">
                    24/7 OPEN
                  </Chip>
                )}
              </div>
              <p className="text-[10px] font-semibold text-slate-400 mt-1">
                {modData?.hours_enabled
                  ? `${modData.hours_start} to ${modData.hours_end === "00:00" ? "Midnight" : modData.hours_end}`
                  : "No restrictions"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </CardBody>
        </Card>

        {/* Suspended Members */}
        <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900 rounded-2xl">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Suspended Members
              </span>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {modData?.banned_users?.length ?? 0}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                Blocked from posting
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <UserX size={18} />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Notifications / Feedback Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as string)}
        color="primary"
        variant="underlined"
        classNames={{
          tabList: "gap-6 w-full relative rounded-none p-0 border-b border-slate-200 dark:border-slate-800",
          cursor: "w-full bg-primary",
          tab: "max-w-fit px-0 h-10 font-bold text-sm",
        }}
      >
        <Tab
          key="feed"
          title={
            <div className="flex items-center gap-2">
              <MessageCircle size={15} />
              <span>Posts & Moderation</span>
              <Chip size="sm" variant="flat" color="primary" className="h-4 text-[9px] font-black">
                {postsQuery.data?.length ?? 0}
              </Chip>
            </div>
          }
        />
        <Tab
          key="hours"
          title={
            <div className="flex items-center gap-2">
              <Clock size={15} />
              <span>Talking Hours & Quiet Time</span>
              {modData?.hours_enabled && (
                <Chip size="sm" variant="flat" color="warning" className="h-4 text-[9px] font-black">
                  ACTIVE
                </Chip>
              )}
            </div>
          }
        />
        <Tab
          key="suspended"
          title={
            <div className="flex items-center gap-2">
              <UserX size={15} />
              <span>Suspended Members</span>
              {(modData?.banned_users?.length ?? 0) > 0 && (
                <Chip size="sm" variant="flat" color="danger" className="h-4 text-[9px] font-black">
                  {modData?.banned_users.length}
                </Chip>
              )}
            </div>
          }
        />
      </Tabs>

      {/* TAB 1: POSTS & FEED MODERATION */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <Input
                size="sm"
                variant="bordered"
                radius="lg"
                placeholder="Search discussions or members..."
                startContent={<Search size={14} className="text-slate-400" />}
                value={searchTerm}
                onValueChange={setSearchTerm}
                classNames={{
                  inputWrapper: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9",
                }}
              />
            </div>
            <p className="text-xs font-semibold text-slate-400">
              Showing {filteredPosts.length} post{filteredPosts.length === 1 ? "" : "s"}
            </p>
          </div>

          {postsQuery.isLoading && (
            <div className="py-16 text-center text-xs font-bold text-slate-400">
              Loading community discussions...
            </div>
          )}

          {!postsQuery.isLoading && filteredPosts.length === 0 && (
            <div className="card p-12 text-center text-sm font-semibold text-slate-400">
              No discussions match your filter or community is quiet.
            </div>
          )}

          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const isAuthorBanned = post.author_user_id ? bannedUserIds.has(post.author_user_id) : false;
              const postDateStr = new Date(post.created_at).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Card
                  key={post.id}
                  shadow="sm"
                  className={`border ${
                    isAuthorBanned
                      ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10"
                      : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900"
                  } rounded-2xl`}
                >
                  <CardHeader className="flex items-start justify-between px-6 pt-5 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center">
                        {post.author?.name ? post.author.name[0].toUpperCase() : "U"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                            {post.author?.name ?? "Unknown Parent"}
                          </span>
                          <span className="badge text-[9px] uppercase font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {post.author?.role || "parent"}
                          </span>
                          {isAuthorBanned && (
                            <Chip size="sm" variant="flat" color="danger" className="h-4 text-[9px] font-black px-1">
                              SUSPENDED
                            </Chip>
                          )}
                          {post.type === "activity" && (
                            <Chip size="sm" variant="flat" color="success" className="h-4 text-[9px] font-black px-1">
                              MEETUP
                            </Chip>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                          {postDateStr}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Delete & Ban */}
                    <div className="flex items-center gap-1.5">
                      {!isAuthorBanned && post.author_user_id && post.author?.role === "parent" && (
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          startContent={<Ban size={13} />}
                          onPress={() =>
                            setBanUserTarget({
                              id: Number(post.author_user_id || post.author?.id),
                              name: post.author?.name || "Parent",
                              email: post.author?.email || "",
                            })
                          }
                          className="font-bold text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          Block Member
                        </Button>
                      )}

                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        title="Delete post"
                        onPress={() => setDeleting({ kind: "post", id: post.id, label: "post" })}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardBody className="px-6 pb-6 pt-1 space-y-3">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {post.body}
                    </p>

                    {/* Media Attachments */}
                    {!!post.media?.length && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {post.media.map(
                          (m, i) =>
                            m.media && (
                              <img
                                key={i}
                                src={m.media.url}
                                alt="Attachment"
                                className="h-28 w-28 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                              />
                            )
                        )}
                      </div>
                    )}

                    {/* Meetup Card if present */}
                    {post.meetup && (
                      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <Calendar size={13} className="text-primary" />
                            <span>{post.meetup.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            📍 {post.meetup.location || "Nursery Playground"} · {new Date(post.meetup.starts_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Stats footer: Likes & Comments */}
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Heart size={14} className="text-rose-500" />
                        <span>{post.likes?.length ?? 0} likes</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle size={14} className="text-primary" />
                        <span>{post.comments?.length ?? 0} comments</span>
                      </span>
                    </div>

                    {/* Threaded Comments List */}
                    {!!post.comments?.length && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                        {post.comments.map((comment) => {
                          const isCommenterBanned = comment.author_user_id
                            ? bannedUserIds.has(comment.author_user_id)
                            : false;
                          return (
                            <div
                              key={comment.id}
                              className={`p-3 rounded-xl border ${
                                isCommenterBanned
                                  ? "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20"
                                  : "border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40"
                              } flex items-start justify-between gap-3 text-xs`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                                    {comment.author?.name ?? "Parent"}
                                  </span>
                                  {isCommenterBanned && (
                                    <Chip size="sm" variant="flat" color="danger" className="h-3.5 text-[8px] font-black px-1">
                                      SUSPENDED
                                    </Chip>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap font-medium">
                                  {comment.body}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {!isCommenterBanned && comment.author_user_id && comment.author?.role === "parent" && (
                                  <button
                                    onClick={() =>
                                      setBanUserTarget({
                                        id: Number(comment.author_user_id || comment.author?.id),
                                        name: comment.author?.name || "Parent",
                                        email: comment.author?.email || "",
                                      })
                                    }
                                    className="text-[10px] text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-100"
                                    title="Block this member"
                                  >
                                    Block
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeleting({ kind: "comment", id: comment.id, label: "comment" })}
                                  className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                                  title="Delete comment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TALKING HOURS & QUIET TIME */}
      {activeTab === "hours" && (
        <div className="max-w-2xl space-y-6">
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="px-6 pt-6 pb-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Moon size={18} className="text-amber-500" />
                  Community Operating Hours & Quiet Curfew
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Set allowed hours when parents can post and chat. Disables late-night messages (e.g. after 12 Midnight).
                </p>
              </div>
            </CardHeader>

            <CardBody className="px-6 pb-6 pt-3 space-y-6">
              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">
                    Enforce Daily Quiet Hours
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    When enabled, discussions lock outside of the designated schedule.
                  </span>
                </div>
                <Switch isSelected={hoursEnabled} onValueChange={setHoursEnabled} color="primary" />
              </div>

              {/* Time Configuration */}
              <div className={`space-y-4 ${!hoursEnabled ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Time */}
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                      Opening Time (Morning)
                    </label>
                    <select
                      className="input w-full font-bold text-xs"
                      value={hoursStart}
                      onChange={(e) => setHoursStart(e.target.value)}
                    >
                      <option value="06:00">06:00 AM (Early)</option>
                      <option value="07:00">07:00 AM (Recommended)</option>
                      <option value="08:00">08:00 AM</option>
                      <option value="09:00">09:00 AM</option>
                    </select>
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                      Closing Time (Night Curfew)
                    </label>
                    <select
                      className="input w-full font-bold text-xs"
                      value={hoursEnd}
                      onChange={(e) => setHoursEnd(e.target.value)}
                    >
                      <option value="21:00">09:00 PM (21:00)</option>
                      <option value="22:00">10:00 PM (22:00)</option>
                      <option value="23:00">11:00 PM (23:00)</option>
                      <option value="00:00">12:00 Midnight (00:00 - Recommended)</option>
                      <option value="01:00">01:00 AM (Night Owl)</option>
                    </select>
                  </div>
                </div>

                {/* Helpful Summary Banner */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                  <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      Parent Access Rule:
                    </p>
                    <p>
                      Parents and guardians will be allowed to publish posts and leave replies between{" "}
                      <span className="font-bold text-primary">{hoursStart}</span> and{" "}
                      <span className="font-bold text-primary">
                        {hoursEnd === "00:00" ? "12:00 Midnight" : hoursEnd}
                      </span>
                      .
                    </p>
                    <p className="text-[11px] text-slate-400">
                      * Nursery Directors & Teachers can still publish urgent notices at any time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <Button
                  color="primary"
                  radius="lg"
                  isLoading={saveHoursMutation.isPending}
                  onPress={() => saveHoursMutation.mutate()}
                  className="font-bold shadow-md shadow-primary/25"
                >
                  Save Schedule Settings
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB 3: SUSPENDED MEMBERS */}
      {activeTab === "suspended" && (
        <div className="space-y-4">
          <Card shadow="sm" className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="px-6 pt-6 pb-2 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserX size={18} className="text-rose-500" />
                  Suspended Community Members ({modData?.banned_users?.length ?? 0})
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Members blocked from publishing posts or comments due to inappropriate conduct
                </p>
              </div>
            </CardHeader>

            <CardBody className="px-6 pb-6 pt-3">
              {(modData?.banned_users?.length ?? 0) === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <ShieldCheck size={36} className="mx-auto text-emerald-500 opacity-80" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    No suspended members.
                  </p>
                  <p className="text-xs text-slate-400">
                    All nursery parents have normal access to community discussions.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 text-start">Member</th>
                        <th className="py-3 text-start">Reason for Suspension</th>
                        <th className="py-3 text-start">Suspended Date</th>
                        <th className="py-3 text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {modData?.banned_users.map((b) => (
                        <tr key={b.user_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3">
                            <div>
                              <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                                {b.user_name || `User #${b.user_id}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {b.user_email || `ID: ${b.user_id}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 font-semibold text-rose-600 dark:text-rose-400 max-w-xs">
                            {b.reason || "Inappropriate language or behavior"}
                          </td>
                          <td className="py-3 text-slate-500 font-medium">
                            {b.banned_at ? new Date(b.banned_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>
                          <td className="py-3 text-end">
                            <Button
                              size="sm"
                              variant="flat"
                              color="success"
                              startContent={<Unlock size={13} />}
                              isLoading={unbanMutation.isPending}
                              onPress={() => unbanMutation.mutate(b.user_id)}
                              className="font-bold text-xs"
                            >
                              Restore Access
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete this ${deleting?.label}?`}
        busy={removeMutation.isPending}
        onConfirm={() => deleting && removeMutation.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />

      {/* Suspend Member Modal */}
      {banUserTarget && (
        <Modal
          open={!!banUserTarget}
          title="Suspend Member from Community"
          onClose={() => setBanUserTarget(null)}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-xs text-rose-800 dark:text-rose-300">
              <p className="font-bold">
                You are about to block {banUserTarget.name} ({banUserTarget.email}).
              </p>
              <p className="mt-1 text-[11px] opacity-90">
                This will prevent them from publishing new posts or adding comments in the parent community hub.
              </p>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                Reason for Suspension
              </label>
              <textarea
                rows={3}
                className="input w-full p-2.5 text-xs font-medium"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Explain the violation (e.g. bad language, aggressive behavior, spam)..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="flat"
                onPress={() => setBanUserTarget(null)}
                className="font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                color="danger"
                isLoading={banMutation.isPending}
                onPress={() =>
                  banMutation.mutate({
                    userId: banUserTarget.id,
                    reason: banReason.trim(),
                  })
                }
                className="font-bold text-xs"
              >
                Suspend Member
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
