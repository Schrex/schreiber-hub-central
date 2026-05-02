import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert, BookOpen, Mic, Plus, Sparkles, Settings as SettingsIcon, Play, Square, Users, CheckCircle2, Volume2, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SignaturePad } from "@/components/safety/SignaturePad";
import { AccidentReportButton } from "@/components/safety/AccidentReportDialog";

interface SafetyRule { id: string; title: string; body: string; category: string | null; sort_order: number; is_active: boolean; }
interface ToolboxTalk { id: string; title: string; category: string | null; content: string; quiz_questions: any; created_with_ai: boolean; is_active: boolean; image_url?: string | null; video_url?: string | null; voice_script?: string | null; }
interface QuizQ { question: string; options: string[]; correct_index: number; }
interface SessionRow { id: string; talk_id: string; foreman_id: string; foreman_name: string | null; status: string; started_at: string; recording_started_at: string | null; recording_stopped_at: string | null; audio_path: string | null; transcript: string | null; }
interface Attendee { id: string; session_id: string; user_id: string | null; attendee_name: string; signature_data: string | null; signed_at: string | null; quiz_score: number | null; quiz_total: number | null; quiz_completed_at: string | null; }

const Safety = () => {
  const { role, user, displayName } = useAuth();
  const isAdmin = role === "admin";
  // Only foremen lead toolbox talks. Admins can also access for oversight.
  const isForeman = role === "foreman" || isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mt-4">
          <h1 className="font-display text-2xl uppercase tracking-wide">Safety</h1>
          <p className="text-sm text-muted-foreground">Rules, toolbox talks & sign-offs</p>
        </div>

        <div className="mt-4">
          <AccidentReportButton />
        </div>

        <Tabs defaultValue="rules" className="mt-5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rules"><ShieldAlert className="mr-1 h-3.5 w-3.5" />Rules</TabsTrigger>
            <TabsTrigger value="talks"><BookOpen className="mr-1 h-3.5 w-3.5" />Talks</TabsTrigger>
            {isForeman && <TabsTrigger value="sessions"><Mic className="mr-1 h-3.5 w-3.5" />Sessions</TabsTrigger>}
          </TabsList>

          <TabsContent value="rules" className="mt-4">
            <RulesTab isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="talks" className="mt-4">
            <TalksTab isAdmin={isAdmin} />
          </TabsContent>
          {isForeman && (
            <TabsContent value="sessions" className="mt-4">
              <SessionsTab userId={user?.id ?? ""} foremanName={displayName ?? "Foreman"} isAdmin={isAdmin} />
            </TabsContent>
          )}
        </Tabs>

        {isAdmin && <AdminSettings />}
      </div>
    </div>
  );
};

/* -------------------- Rules -------------------- */
const RulesTab = ({ isAdmin }: { isAdmin: boolean }) => {
  const [rules, setRules] = useState<SafetyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("safety_rules").select("*").eq("is_active", true).order("sort_order").order("title");
    setRules((data as SafetyRule[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    const { error } = await supabase.from("safety_rules").insert({
      title: form.title.trim(), body: form.body.trim(), category: form.category.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Rule added");
    setForm({ title: "", body: "", category: "" });
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New rule</Button>
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rules.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No safety rules posted yet.
        </div>
      )}
      {rules.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          {r.category && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</p>}
          <h3 className="font-display text-base uppercase tracking-wide">{r.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{r.body}</p>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New safety rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="PPE, Trenching..." /></div>
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Body *</Label><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* -------------------- Talks library -------------------- */
const TalksTab = ({ isAdmin }: { isAdmin: boolean }) => {
  const [talks, setTalks] = useState<ToolboxTalk[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", content: "", quiz_questions: [] as QuizQ[], image_url: "" as string | null | "", voice_script: "", video_url: "" as string | null | "" });
  const [aiTopic, setAiTopic] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("toolbox_talks").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setTalks((data as ToolboxTalk[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generateAI = async () => {
    if (!aiTopic.trim()) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-toolbox-talk", {
        body: { topic: aiTopic.trim(), category: form.category || undefined },
      });
      if (error) throw error;
      setForm({
        title: data.title || aiTopic,
        category: data.category || form.category,
        content: data.content || "",
        quiz_questions: Array.isArray(data.quiz_questions) ? data.quiz_questions : [],
        image_url: data.image_url ?? "",
        voice_script: data.voice_script ?? "",
        video_url: "",
      });
      toast.success("AI draft ready — review and save");
    } catch (e: any) {
      toast.error(e.message ?? "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const { error } = await supabase.from("toolbox_talks").insert({
      title: form.title.trim(),
      category: form.category.trim() || null,
      content: form.content,
      quiz_questions: form.quiz_questions as any,
      created_with_ai: true,
      image_url: form.image_url || null,
      voice_script: form.voice_script || null,
      video_url: form.video_url || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Talk saved to library");
    setForm({ title: "", category: "", content: "", quiz_questions: [], image_url: "", voice_script: "", video_url: "" });
    setAiTopic("");
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New talk</Button>
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && talks.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No toolbox talks yet.
        </div>
      )}
      {talks.map((t) => (
        <details key={t.id} className="rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {t.category && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.category}</p>}
                <h3 className="font-display text-base uppercase tracking-wide truncate">{t.title}</h3>
              </div>
              {t.created_with_ai && <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />}
            </div>
          </summary>
          {t.image_url && (
            <img src={t.image_url} alt={t.title} loading="lazy" className="mt-3 w-full rounded-lg border border-border object-cover max-h-64" />
          )}
          {t.video_url && (
            <video src={t.video_url} controls className="mt-3 w-full rounded-lg border border-border" />
          )}
          <div className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{t.content}</div>
          {(t.voice_script || t.content) && (
            <div className="mt-3"><ReadAloudButton text={t.voice_script || t.content} /></div>
          )}
          {Array.isArray(t.quiz_questions) && t.quiz_questions.length > 0 && (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Quiz: {t.quiz_questions.length} question{t.quiz_questions.length === 1 ? "" : "s"}
            </p>
          )}
        </details>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New toolbox talk</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-primary"><Sparkles className="inline h-3 w-3 mr-1" />AI assist</p>
              <div className="flex gap-2">
                <Input placeholder="Topic e.g. trench shoring" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
                <Button onClick={generateAI} disabled={aiBusy || !aiTopic.trim()}>{aiBusy ? "…" : "Generate"}</Button>
              </div>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Content *</Label><Textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <p className="text-[10px] text-muted-foreground">{form.quiz_questions.length} quiz questions attached</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save talk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* -------------------- Sessions (Foreman flow) -------------------- */
interface ScheduledCrew { user_id: string; display_name: string; role_on_job: string | null; }

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
};

const SessionsTab = ({ userId, foremanName, isAdmin }: { userId: string; foremanName: string; isAdmin: boolean }) => {
  const [talks, setTalks] = useState<ToolboxTalk[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);

  // start-flow state
  const [todaysJobs, setTodaysJobs] = useState<{ id: string; name: string }[]>([]);
  const [pickedJobId, setPickedJobId] = useState<string>("");
  const [crew, setCrew] = useState<ScheduledCrew[]>([]);
  const [includeIds, setIncludeIds] = useState<Set<string>>(new Set());
  const [selectedTalkId, setSelectedTalkId] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [talksRes, sessRes] = await Promise.all([
      supabase.from("toolbox_talks").select("*").eq("is_active", true).order("title"),
      supabase.from("toolbox_talk_sessions").select("*").order("started_at", { ascending: false }).limit(20),
    ]);
    setTalks((talksRes.data as ToolboxTalk[]) ?? []);
    setSessions((sessRes.data as SessionRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Load today's scheduled jobs for this foreman
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const today = todayIso();
      const { data } = await supabase
        .from("schedule_assignments")
        .select("job_id, jobs:jobs(id, name)")
        .eq("user_id", userId)
        .eq("assignment_date", today);
      const seen = new Set<string>();
      const list: { id: string; name: string }[] = [];
      (data ?? []).forEach((r: any) => {
        const j = r.jobs;
        if (j && !seen.has(j.id)) { seen.add(j.id); list.push({ id: j.id, name: j.name }); }
      });
      setTodaysJobs(list);
      if (list.length === 1) setPickedJobId(list[0].id);
    })();
  }, [userId]);

  // When job picked, load crew on schedule for that job today (excluding foreman themself)
  useEffect(() => {
    if (!pickedJobId) { setCrew([]); setIncludeIds(new Set()); return; }
    (async () => {
      const today = todayIso();
      const { data: rows } = await supabase
        .from("schedule_assignments")
        .select("user_id, role_on_job")
        .eq("job_id", pickedJobId)
        .eq("assignment_date", today);
      const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id))).filter((u) => u !== userId);
      if (userIds.length === 0) { setCrew([]); setIncludeIds(new Set()); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const nameMap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => nameMap.set(p.user_id, p.display_name ?? "Crew member"));
      const out: ScheduledCrew[] = (rows ?? [])
        .filter((r: any) => r.user_id !== userId)
        .reduce((acc: ScheduledCrew[], r: any) => {
          if (acc.find(a => a.user_id === r.user_id)) return acc;
          acc.push({ user_id: r.user_id, display_name: nameMap.get(r.user_id) ?? "Crew member", role_on_job: r.role_on_job });
          return acc;
        }, []);
      setCrew(out);
      setIncludeIds(new Set(out.map(o => o.user_id)));
    })();
  }, [pickedJobId, userId]);

  const suggestTopic = async () => {
    if (!pickedJobId) return;
    setAiBusy(true);
    setAiHint(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-safety-topic", {
        body: { jobId: pickedJobId, date: todayIso() },
      });
      if (error) throw error;
      if (data?.match_talk_id && talks.find(t => t.id === data.match_talk_id)) {
        setSelectedTalkId(data.match_talk_id);
        setAiHint(`AI matched: "${talks.find(t => t.id === data.match_talk_id)?.title}" — ${data.reasoning ?? ""}`);
      } else if (data?.suggested_topic) {
        setAiHint(`AI suggests: "${data.suggested_topic}" — ${data.reasoning ?? ""}. No close match in library — pick the closest or generate a new talk in the Talks tab.`);
      } else {
        setAiHint("No suggestion available.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Suggestion failed");
    } finally { setAiBusy(false); }
  };

  const startSession = async () => {
    if (!selectedTalkId || !pickedJobId) { toast.error("Pick a job and a talk first"); return; }
    setStarting(true);
    try {
      const { data: sess, error: sErr } = await supabase.from("toolbox_talk_sessions").insert({
        talk_id: selectedTalkId, foreman_id: userId, foreman_name: foremanName, status: "in_progress",
        job_id: pickedJobId, topic_source: "ai_schedule", delivery_mode: "remote",
      }).select("*").single();
      if (sErr) throw sErr;

      const includes = crew.filter(c => includeIds.has(c.user_id));
      if (includes.length > 0) {
        const rows = includes.map(c => ({
          session_id: sess.id, user_id: c.user_id, attendee_name: c.display_name, source: "schedule",
        }));
        const { error: aErr } = await supabase.from("toolbox_talk_attendees").insert(rows);
        if (aErr) throw aErr;
      }

      // Notify
      const { error: nErr } = await supabase.functions.invoke("notify-talk-attendees", {
        body: { sessionId: sess.id },
      });
      if (nErr) console.warn("notify failed", nErr);
      else toast.success(`Notified ${includes.length} crew member${includes.length === 1 ? "" : "s"}`);

      setActiveSession(sess as SessionRow);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not start session");
    } finally { setStarting(false); }
  };

  if (activeSession) {
    return <ActiveSessionView session={activeSession} talk={talks.find(t => t.id === activeSession.talk_id) ?? null} onExit={() => { setActiveSession(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">Start today's talk</h2>

        <div className="space-y-1">
          <Label className="text-xs">Job</Label>
          {todaysJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">You're not on the schedule today. Pick a talk manually below.</p>
          ) : (
            <Select value={pickedJobId} onValueChange={setPickedJobId}>
              <SelectTrigger><SelectValue placeholder="Today's job" /></SelectTrigger>
              <SelectContent>
                {todaysJobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {pickedJobId && (
          <div className="space-y-1">
            <Label className="text-xs">Crew on schedule today ({crew.length})</Label>
            {crew.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nobody else scheduled with you today.</p>
            ) : (
              <div className="space-y-1 rounded-lg border border-border p-2">
                {crew.map(c => (
                  <label key={c.user_id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeIds.has(c.user_id)}
                      onChange={(e) => {
                        const next = new Set(includeIds);
                        if (e.target.checked) next.add(c.user_id); else next.delete(c.user_id);
                        setIncludeIds(next);
                      }}
                    />
                    <span className="truncate">{c.display_name}{c.role_on_job ? <span className="text-muted-foreground"> · {c.role_on_job}</span> : null}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Talk</Label>
            <Button size="sm" variant="ghost" onClick={suggestTopic} disabled={!pickedJobId || aiBusy}>
              <Sparkles className="mr-1 h-3 w-3" />{aiBusy ? "Thinking…" : "Suggest from schedule"}
            </Button>
          </div>
          <Select value={selectedTalkId} onValueChange={setSelectedTalkId}>
            <SelectTrigger><SelectValue placeholder="Pick a talk" /></SelectTrigger>
            <SelectContent>
              {talks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
          {aiHint && <p className="text-[11px] text-muted-foreground">{aiHint}</p>}
        </div>

        <Button className="w-full" size="lg" onClick={startSession} disabled={!selectedTalkId || starting}>
          <Play className="mr-2 h-4 w-4" />{starting ? "Starting…" : `Confirm & start — notify ${includeIds.size} crew`}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">
          Crew gets a notification on their phones to join, take the quiz, and sign.
        </p>
      </div>

      <div>
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2">Recent sessions</h2>
        <div className="space-y-2">
          {sessions.map((s) => {
            const talk = talks.find(t => t.id === s.talk_id);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className="w-full text-left rounded-xl border border-border bg-surface p-3 hover:border-primary/40 transition-colors"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(s.started_at).toLocaleString()} · {s.status}
                </p>
                <p className="text-sm">{talk?.title ?? "Talk"}</p>
                {s.transcript && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.transcript}</p>}
              </button>
            );
          })}
          {sessions.length === 0 && <p className="text-sm text-muted-foreground">No prior sessions.</p>}
        </div>
      </div>
    </div>
  );
};

/* -------------------- Active session (Stepper) -------------------- */
type StepKey = "read" | "crew" | "complete";

const STEPS: { key: StepKey; label: string; short: string }[] = [
  { key: "read", label: "Read the talk", short: "Read" },
  { key: "crew", label: "Crew quiz & sign-off", short: "Crew" },
  { key: "complete", label: "Complete & email", short: "Send" },
];

const ActiveSessionView = ({ session, talk, onExit }: { session: SessionRow; talk: ToolboxTalk | null; onExit: () => void; }) => {
  const [step, setStep] = useState<StepKey>("read");
  const [recording, setRecording] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [pickUserId, setPickUserId] = useState<string>("");
  const [signFor, setSignFor] = useState<Attendee | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [quizFor, setQuizFor] = useState<Attendee | null>(null);
  const [transcript, setTranscript] = useState<string | null>(session.transcript);
  const [completing, setCompleting] = useState(false);
  const [extraEmails, setExtraEmails] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const loadAttendees = async () => {
    const { data } = await supabase.from("toolbox_talk_attendees").select("*").eq("session_id", session.id).order("created_at");
    setAttendees((data as Attendee[]) ?? []);
  };
  useEffect(() => { loadAttendees(); }, [session.id]);

  // Live updates so foreman sees crew sign-offs/quizzes from their own devices
  useEffect(() => {
    const channel = supabase
      .channel(`talk-attendees-${session.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "toolbox_talk_attendees",
        filter: `session_id=eq.${session.id}`,
      }, () => loadAttendees())
      .subscribe();
    const t = setInterval(loadAttendees, 15000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [session.id]);

  useEffect(() => {
    supabase.from("profiles").select("user_id, display_name").eq("is_active", true).order("display_name").then(({ data }) => {
      setEmployees((data as { user_id: string; display_name: string | null }[]) ?? []);
    });
  }, []);

  const addAttendee = async () => {
    if (!pickUserId) return;
    const emp = employees.find(e => e.user_id === pickUserId);
    if (!emp) return;
    const { error } = await supabase.from("toolbox_talk_attendees").insert({
      session_id: session.id,
      user_id: emp.user_id,
      attendee_name: emp.display_name ?? "Employee",
    });
    if (error) { toast.error(error.message); return; }
    setPickUserId("");
    loadAttendees();
    // Notify the newly added attendee
    supabase.functions.invoke("notify-talk-attendees", { body: { sessionId: session.id } }).catch(() => {});
  };

  const startRec = async () => {
    setRecBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      await supabase.from("toolbox_talk_sessions").update({ recording_started_at: new Date().toISOString() }).eq("id", session.id);
      toast.success("Recording…");
    } catch (e: any) {
      toast.error("Mic error: " + (e.message ?? "unknown"));
    } finally { setRecBusy(false); }
  };

  const stopRec = async () => {
    setRecBusy(true);
    try {
      const mr = mediaRecorderRef.current;
      if (!mr) { setRecording(false); return; }
      const stopped = new Promise<Blob>((resolve) => {
        mr.onstop = () => resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      });
      mr.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = await stopped;
      setRecording(false);

      const path = `${session.foreman_id}/${session.id}.webm`;
      const { error: upErr } = await supabase.storage.from("talk-audio").upload(path, blob, { upsert: true, contentType: "audio/webm" });
      if (upErr) throw upErr;
      await supabase.from("toolbox_talk_sessions").update({
        audio_path: path, recording_stopped_at: new Date().toISOString(),
      }).eq("id", session.id);
      toast.success("Uploaded — transcribing…");

      const { data, error } = await supabase.functions.invoke("transcribe-toolbox-talk", { body: { sessionId: session.id, audioPath: path } });
      if (error) throw error;
      if (data?.transcript) setTranscript(data.transcript);
      toast.success("Transcript ready");
    } catch (e: any) {
      toast.error(e.message ?? "Stop/upload failed");
    } finally { setRecBusy(false); }
  };

  const hasQuiz = !!talk && Array.isArray(talk.quiz_questions) && (talk.quiz_questions as any[]).length > 0;
  const totalAttendees = attendees.length;
  const signedCount = attendees.filter(a => !!a.signed_at).length;
  const quizDoneCount = attendees.filter(a => !!a.quiz_completed_at).length;
  const everyoneDone = totalAttendees > 0 && attendees.every(a => !!a.signed_at && (!hasQuiz || !!a.quiz_completed_at));

  const completeSession = async () => {
    setCompleting(true);
    try {
      const extras = extraEmails
        .split(/[\s,;]+/)
        .map(s => s.trim())
        .filter(s => s.includes("@"));
      const { data, error } = await supabase.functions.invoke("complete-safety-talk", {
        body: { sessionId: session.id, extraRecipients: extras },
      });
      if (error) {
        const ctx = (error as any)?.context;
        const body = ctx ? await ctx.json?.().catch(() => null) : null;
        if (body?.error === "incomplete_attendees") {
          toast.error(`Still waiting on: ${(body.missing ?? []).join(", ")}`);
          return;
        }
        throw error;
      }
      toast.success(`Talk completed — emailed ${data?.recipientCount ?? 0} recipient(s)`);
      onExit();
    } catch (e: any) {
      toast.error(e.message ?? "Could not complete talk");
    } finally { setCompleting(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="text-sm text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to sessions
      </button>

      {/* Talk header */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{talk?.category ?? "Toolbox talk"}</p>
        <h2 className="font-display text-base uppercase tracking-wide">{talk?.title ?? "Toolbox talk"}</h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex(x => x.key === step);
          const active = i === idx;
          const done = i < idx;
          return (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={`flex-1 rounded-lg border px-2 py-2 text-[11px] uppercase tracking-wider transition-colors ${
                active ? "border-primary bg-primary/10 text-foreground" :
                done ? "border-primary/40 bg-surface text-muted-foreground" :
                "border-border bg-surface text-muted-foreground"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  active ? "bg-primary text-primary-foreground" :
                  done ? "bg-primary/30 text-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>{done ? "✓" : i + 1}</span>
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.short}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step 1 — Read the talk */}
      {step === "read" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Step 1 · Read & discuss with the crew</p>
            {talk?.image_url && (
              <img src={talk.image_url} alt={talk.title} loading="lazy" className="w-full rounded-lg border border-border object-cover max-h-72" />
            )}
            {talk?.video_url && <video src={talk.video_url} controls className="w-full rounded-lg border border-border" />}
            {(talk?.voice_script || talk?.content) && (
              <ReadAloudButton text={talk?.voice_script || talk?.content || ""} label="Read to the crew" />
            )}
            <details><summary className="cursor-pointer text-xs text-primary">Show talk content</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{talk?.content}</p>
            </details>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Mic className="inline h-3 w-3 mr-1" />Optional recording
              </h3>
              {recording && <span className="text-xs text-destructive animate-pulse">● REC</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">Capture Q&amp;A for the record. You can skip this and move to the next step.</p>
            {!recording ? (
              <Button className="w-full" variant="outline" onClick={startRec} disabled={recBusy || !!session.audio_path}>
                <Play className="mr-2 h-4 w-4" />{session.audio_path ? "Already recorded" : "Start recording"}
              </Button>
            ) : (
              <Button className="w-full" variant="destructive" onClick={stopRec} disabled={recBusy}>
                <Square className="mr-2 h-4 w-4" />Stop recording
              </Button>
            )}
            {transcript && (
              <details className="rounded-lg border border-border p-2">
                <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">Transcript</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{transcript}</p>
              </details>
            )}
          </div>

          <Button className="w-full" size="lg" onClick={() => setStep("crew")}>
            Done reading — go to crew sign-off →
          </Button>
        </div>
      )}

      {/* Step 2 — Crew quiz & sign on their devices */}
      {step === "crew" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Step 2 · Crew completes quiz &amp; signs</p>
            <p className="text-sm">
              Each crew member got a notification. They open it on their phone, take the quiz, and sign.
              You'll see the live count below.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Attendees</p>
                <p className="font-display text-xl">{totalAttendees}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed</p>
                <p className={`font-display text-xl ${signedCount === totalAttendees && totalAttendees > 0 ? "text-primary" : ""}`}>{signedCount}/{totalAttendees}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{hasQuiz ? "Quiz" : "No quiz"}</p>
                <p className={`font-display text-xl ${hasQuiz && quizDoneCount === totalAttendees && totalAttendees > 0 ? "text-primary" : ""}`}>
                  {hasQuiz ? `${quizDoneCount}/${totalAttendees}` : "—"}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={async () => {
                const { error } = await supabase.functions.invoke("notify-talk-attendees", { body: { sessionId: session.id } });
                if (error) toast.error(error.message); else toast.success("Reminder sent");
              }}
            >
              Send reminder to anyone not done
            </Button>
          </div>

          {/* Add or sign on foreman's device for stragglers */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h3 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <Users className="inline h-3 w-3 mr-1" />Attendees
            </h3>
            <div className="flex gap-2">
              <Select value={pickUserId} onValueChange={setPickUserId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add someone…" /></SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => !attendees.some((a) => a.user_id === e.user_id))
                    .map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.display_name ?? "—"}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={addAttendee} disabled={!pickUserId}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              {attendees.map((a) => {
                const quizOk = !hasQuiz || !!a.quiz_completed_at;
                const allDone = !!a.signed_at && quizOk;
                return (
                  <div key={a.id} className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${allDone ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{a.attendee_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.signed_at ? <><CheckCircle2 className="inline h-3 w-3 text-primary" /> signed</> : "not signed"}
                        {hasQuiz && (a.quiz_score !== null && a.quiz_total !== null
                          ? ` · quiz ${a.quiz_score}/${a.quiz_total}`
                          : " · quiz pending")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!a.signed_at && <Button size="sm" variant="outline" onClick={() => { setSignFor(a); setSignature(null); }}>Sign</Button>}
                      {hasQuiz && a.quiz_completed_at == null && (
                        <Button size="sm" variant="outline" onClick={() => setQuizFor(a)}>Quiz</Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {attendees.length === 0 && <p className="text-xs text-muted-foreground">No attendees yet — add the crew above.</p>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: crew should sign on <strong>their own</strong> phones. The Sign / Quiz buttons here are only for backup if a phone isn't working.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => setStep("complete")}
            disabled={!everyoneDone}
          >
            {everyoneDone ? "Everyone's done — finish up →" : `Waiting on ${totalAttendees - Math.min(signedCount, hasQuiz ? quizDoneCount : signedCount)}…`}
          </Button>
        </div>
      )}

      {/* Step 3 — Complete & email */}
      {step === "complete" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Step 3 · Complete &amp; email</p>
            <p className="text-sm">
              When you complete the talk, a summary is emailed to the office team automatically.
              Add the customer or anyone else below if you want them on it too.
            </p>
            <div>
              <Label className="text-xs">Also email (optional)</Label>
              <Input
                value={extraEmails}
                onChange={(e) => setExtraEmails(e.target.value)}
                placeholder="customer@example.com, gc@example.com"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Comma-separated. Office staff are always included.</p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3 text-sm">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Summary</p>
              <p>{totalAttendees} attendee{totalAttendees === 1 ? "" : "s"}, {signedCount} signed{hasQuiz ? `, ${quizDoneCount} quizzed` : ""}.</p>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={completeSession}
            disabled={!everyoneDone || completing}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completing ? "Sending…" : "Complete talk & send email"}
          </Button>
          {!everyoneDone && (
            <p className="text-[11px] text-center text-muted-foreground">
              Go back to step 2 — every attendee must sign{hasQuiz ? " and finish the quiz" : ""} first.
            </p>
          )}
        </div>
      )}

      {/* Signature dialog */}
      <Dialog open={!!signFor} onOpenChange={(v) => { if (!v) setSignFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{signFor?.attendee_name} — sign off</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">By signing, I confirm I attended this safety talk and understand the content.</p>
          <SignaturePad onChange={setSignature} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignFor(null)}>Cancel</Button>
            <Button disabled={!signature} onClick={async () => {
              if (!signFor || !signature) return;
              const { error } = await supabase.from("toolbox_talk_attendees").update({
                signature_data: signature, signed_at: new Date().toISOString(),
              }).eq("id", signFor.id);
              if (error) { toast.error(error.message); return; }
              toast.success("Signed");
              setSignFor(null); setSignature(null); loadAttendees();
            }}>Save signature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz dialog */}
      {quizFor && talk && (
        <QuizDialog
          attendee={quizFor}
          questions={(talk.quiz_questions ?? []) as QuizQ[]}
          onClose={() => setQuizFor(null)}
          onSaved={() => { setQuizFor(null); loadAttendees(); }}
        />
      )}
    </div>
  );
};

const QuizDialog = ({ attendee, questions, onClose, onSaved }: { attendee: Attendee; questions: QuizQ[]; onClose: () => void; onSaved: () => void; }) => {
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const score = answers.reduce((acc, a, i) => acc + (a === questions[i].correct_index ? 1 : 0), 0);
      const { error } = await supabase.from("toolbox_talk_attendees").update({
        quiz_answers: answers as any, quiz_score: score, quiz_total: questions.length,
        quiz_completed_at: new Date().toISOString(),
      }).eq("id", attendee.id);
      if (error) throw error;
      toast.success(`Scored ${score}/${questions.length}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{attendee.attendee_name} — quiz</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="space-y-2">
              <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
              <div className="space-y-1">
                {q.options.map((opt, oi) => (
                  <label key={oi} className={`block rounded border p-2 text-sm cursor-pointer ${answers[qi] === oi ? "border-primary bg-primary/10" : "border-border"}`}>
                    <input type="radio" className="mr-2" name={`q-${qi}`} checked={answers[qi] === oi} onChange={() => {
                      const next = [...answers]; next[qi] = oi; setAnswers(next);
                    }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || answers.some(a => a < 0)}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------- Admin settings -------------------- */
const AdminSettings = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("app_settings").select("key,value").in("key", ["york_safety_email", "safety_talk_voice_id"]).then(({ data }) => {
      for (const row of data ?? []) {
        const v = (row as any).value;
        const str = typeof v === "string" ? v : (v?.email ?? v?.voice_id ?? "");
        if (row.key === "york_safety_email") setEmail(str);
        if (row.key === "safety_talk_voice_id") setVoiceId(str);
      }
    });
  }, [open]);

  const save = async () => {
    setBusy(true);
    try {
      const rows = [
        { key: "york_safety_email", value: email },
        { key: "safety_talk_voice_id", value: voiceId.trim() },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows);
      if (error) throw error;
      toast.success("Saved");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="mt-6 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><SettingsIcon className="mr-1 h-3.5 w-3.5" />Safety settings</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Safety settings</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>York Safety Solutions email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@yorksafetysolutions.com" />
              <p className="text-[10px] text-muted-foreground">Inspection requests are sent here.</p>
            </div>
            <div className="space-y-2">
              <Label>Safety talk voice (ElevenLabs Voice ID)</Label>
              <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="e.g. nPczCjzI2devNBz1zQrb" />
              <p className="text-[10px] text-muted-foreground">
                Paste your cloned Voice ID from ElevenLabs → Voices → your voice → ID. Leave blank to use the default Brian voice.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !email.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Safety;

/* -------------------- Read-aloud (foreman voice) -------------------- */
const ReadAloudButton = ({ text, label = "Read aloud" }: { text: string; label?: string }) => {
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const toggle = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    if (audioRef.current && urlRef.current) {
      try { await audioRef.current.play(); setPlaying(true); return; } catch {}
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/speak-toolbox-talk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
          body: JSON.stringify({ text }),
        }
      );
      if (!resp.ok) throw new Error(`Voice request failed (${resp.status})`);

      const ct = resp.headers.get("content-type") || "";
      const isFallbackJson = ct.includes("application/json");

      if (isFallbackJson) {
        const j = await resp.json().catch(() => ({}));
        if (!j.fallback) throw new Error(j.error || "Voice unavailable");
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 0.95;
          utter.pitch = 0.95;
          const voices = window.speechSynthesis.getVoices();
          const male = voices.find(v => /male|daniel|fred|alex|david/i.test(v.name)) || voices.find(v => v.lang.startsWith("en"));
          if (male) utter.voice = male;
          utter.onend = () => setPlaying(false);
          utter.onerror = () => setPlaying(false);
          window.speechSynthesis.speak(utter);
          setPlaying(true);
          toast.message("Using device voice (premium voice unavailable)");
        } else {
          toast.error("Voice playback not supported on this device");
        }
        return;
      }

      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      audioRef.current = audio;
      await audio.play();
      setPlaying(true);
    } catch (e: any) {
      toast.error(e.message ?? "Voice playback failed");
    } finally { setBusy(false); }
  };

  return (
    <Button type="button" variant="secondary" className="w-full" onClick={toggle} disabled={busy || !text}>
      {playing ? <Pause className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
      {busy ? "Loading voice…" : playing ? "Pause" : label}
    </Button>
  );
};
