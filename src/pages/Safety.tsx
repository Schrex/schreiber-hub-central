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
const SessionsTab = ({ userId, foremanName, isAdmin }: { userId: string; foremanName: string; isAdmin: boolean }) => {
  const [talks, setTalks] = useState<ToolboxTalk[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);

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

  const startSession = async (talkId: string) => {
    const { data, error } = await supabase.from("toolbox_talk_sessions").insert({
      talk_id: talkId, foreman_id: userId, foreman_name: foremanName, status: "in_progress",
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setActiveSession(data as SessionRow);
    load();
  };

  if (activeSession) {
    return <ActiveSessionView session={activeSession} talk={talks.find(t => t.id === activeSession.talk_id) ?? null} onExit={() => { setActiveSession(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2">Start a talk</h2>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="space-y-2">
          {talks.map((t) => (
            <button
              key={t.id}
              onClick={() => startSession(t.id)}
              className="w-full text-left rounded-xl border border-border bg-surface p-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  {t.category && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.category}</p>}
                  <p className="font-display text-sm uppercase tracking-wide">{t.title}</p>
                </div>
                <Play className="h-4 w-4 text-primary" />
              </div>
            </button>
          ))}
          {!loading && talks.length === 0 && <p className="text-sm text-muted-foreground">No talks in library yet.</p>}
        </div>
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

/* -------------------- Active session -------------------- */
const ActiveSessionView = ({ session, talk, onExit }: { session: SessionRow; talk: ToolboxTalk | null; onExit: () => void; }) => {
  const [recording, setRecording] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [pickUserId, setPickUserId] = useState<string>("");
  const [signFor, setSignFor] = useState<Attendee | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [quizFor, setQuizFor] = useState<Attendee | null>(null);
  const [transcript, setTranscript] = useState<string | null>(session.transcript);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const loadAttendees = async () => {
    const { data } = await supabase.from("toolbox_talk_attendees").select("*").eq("session_id", session.id).order("created_at");
    setAttendees((data as Attendee[]) ?? []);
  };
  useEffect(() => { loadAttendees(); }, [session.id]);

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

  const completeSession = async () => {
    await supabase.from("toolbox_talk_sessions").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", session.id);
    toast.success("Session complete");
    onExit();
  };

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{talk?.category ?? ""}</p>
        <h2 className="font-display text-lg uppercase tracking-wide">{talk?.title ?? "Toolbox talk"}</h2>
        <details className="mt-2"><summary className="cursor-pointer text-xs text-primary">Show talk content</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">{talk?.content}</p>
        </details>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground"><Mic className="inline h-3 w-3 mr-1" />Recording</h3>
          {recording && <span className="text-xs text-destructive animate-pulse">● REC</span>}
        </div>
        {!recording ? (
          <Button className="w-full" onClick={startRec} disabled={recBusy || !!session.audio_path}>
            <Play className="mr-2 h-4 w-4" />{session.audio_path ? "Already recorded" : "Start safety talk"}
          </Button>
        ) : (
          <Button className="w-full" variant="destructive" onClick={stopRec} disabled={recBusy}>
            <Square className="mr-2 h-4 w-4" />Stop safety talk
          </Button>
        )}
        {transcript && (
          <details open className="rounded-lg border border-border p-2">
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Transcript</span>
              <button
                type="button"
                className="text-primary text-[10px] hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(transcript);
                  toast.success("Transcript copied");
                }}
              >Copy</button>
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{transcript}</p>
          </details>
        )}
        {!transcript && session.audio_path && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Transcript not available yet.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={recBusy}
              onClick={async () => {
                try {
                  setRecBusy(true);
                  toast.message("Transcribing…");
                  const { data, error } = await supabase.functions.invoke("transcribe-toolbox-talk", {
                    body: { sessionId: session.id, audioPath: session.audio_path },
                  });
                  if (error) throw error;
                  if (data?.transcript) {
                    setTranscript(data.transcript);
                    toast.success("Transcript ready");
                  } else {
                    toast.error(data?.message ?? "Transcription unavailable");
                  }
                } catch (e: any) {
                  toast.error(e.message ?? "Retry failed");
                } finally {
                  setRecBusy(false);
                }
              }}
            >
              Retry transcription
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h3 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />Attendees</h3>
        <div className="flex gap-2">
          <Select value={pickUserId} onValueChange={setPickUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select employee…" />
            </SelectTrigger>
            <SelectContent>
              {employees
                .filter((e) => !attendees.some((a) => a.user_id === e.user_id))
                .map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.display_name ?? "—"}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button onClick={addAttendee} disabled={!pickUserId}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-2">
          {attendees.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{a.attendee_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {a.signed_at ? <><CheckCircle2 className="inline h-3 w-3 text-primary" /> signed</> : "unsigned"}
                  {a.quiz_score !== null && a.quiz_total !== null && ` · quiz ${a.quiz_score}/${a.quiz_total}`}
                </p>
              </div>
              <div className="flex gap-1">
                {!a.signed_at && <Button size="sm" variant="outline" onClick={() => { setSignFor(a); setSignature(null); }}>Sign</Button>}
                {talk && Array.isArray(talk.quiz_questions) && talk.quiz_questions.length > 0 && a.quiz_completed_at == null && (
                  <Button size="sm" variant="outline" onClick={() => setQuizFor(a)}>Quiz</Button>
                )}
              </div>
            </div>
          ))}
          {attendees.length === 0 && <p className="text-xs text-muted-foreground">No attendees yet.</p>}
        </div>
      </div>

      <Button className="w-full" onClick={completeSession}>Complete session</Button>

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("app_settings").select("value").eq("key", "york_safety_email").maybeSingle().then(({ data }) => {
      const v = data?.value as any;
      if (typeof v === "string") setEmail(v);
      else if (v?.email) setEmail(v.email);
    });
  }, [open]);

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key: "york_safety_email", value: email });
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
          <div className="space-y-2">
            <Label>York Safety Solutions email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@yorksafetysolutions.com" />
            <p className="text-[10px] text-muted-foreground">Inspection requests are sent here.</p>
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
