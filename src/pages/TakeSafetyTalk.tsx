import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/safety/SignaturePad";
import { toast } from "sonner";

interface QuizQ { question: string; options: string[]; correct_index: number; }

interface Attendee {
  id: string; session_id: string; user_id: string | null;
  attendee_name: string; signature_data: string | null; signed_at: string | null;
  quiz_score: number | null; quiz_total: number | null; quiz_completed_at: string | null;
  initial_quiz_score: number | null; initial_quiz_total: number | null; quiz_attempts: number;
  access_token: string;
}
interface Session {
  id: string; talk_id: string; foreman_name: string | null; status: string; started_at: string;
}
interface Talk {
  id: string; title: string; category: string | null; content: string;
  voice_script: string | null; image_url: string | null; video_url: string | null;
  quiz_questions: QuizQ[];
}

const TakeSafetyTalk = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // quiz state
  const [step, setStep] = useState<"talk" | "quiz" | "sign" | "done">("talk");
  const [answers, setAnswers] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [allCorrect, setAllCorrect] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate(`/auth?redirect=${encodeURIComponent(`/safety/take/${token}`)}`); return; }
    if (!token) { setErr("Invalid link"); setLoading(false); return; }
    (async () => {
      const { data: attRows, error: attErr } = await supabase
        .rpc("get_attendee_by_token", { _token: token });
      const att = Array.isArray(attRows) ? attRows[0] : (attRows as any);
      if (attErr || !att) { setErr("This link is invalid or expired."); setLoading(false); return; }
      if (att.user_id && att.user_id !== user.id) {
        setErr("This link belongs to another team member. Please log in as them.");
        setLoading(false); return;
      }
      setAttendee(att as Attendee);

      const [{ data: sess }, _] = await Promise.all([
        supabase.from("toolbox_talk_sessions").select("id, talk_id, foreman_name, status, started_at").eq("id", att.session_id).maybeSingle(),
        Promise.resolve(null),
      ]);
      if (sess) {
        setSession(sess as Session);
        const { data: t } = await supabase.from("toolbox_talks").select("*").eq("id", sess.talk_id).maybeSingle();
        if (t) {
          const tt = t as any;
          tt.quiz_questions = Array.isArray(tt.quiz_questions) ? tt.quiz_questions : [];
          setTalk(tt as Talk);
          setAnswers((tt.quiz_questions as QuizQ[]).map(() => -1));
          setRevealed((tt.quiz_questions as QuizQ[]).map(() => false));
        }
      }

      if (att.signed_at) setStep("done");
      setLoading(false);
    })();
  }, [token, user, authLoading, navigate]);

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background grid place-items-center"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  }
  if (err) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-4">
        <div className="rounded-xl border border-border bg-surface p-6 max-w-sm text-center">
          <XCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm">{err}</p>
          <Link to="/" className="mt-4 inline-block text-xs text-primary hover:underline">Go home</Link>
        </div>
      </div>
    );
  }
  if (!attendee || !session || !talk) {
    return <div className="min-h-screen bg-background grid place-items-center"><p className="text-sm text-muted-foreground">Talk not found.</p></div>;
  }

  const questions = talk.quiz_questions ?? [];
  const hasQuiz = questions.length > 0;

  const checkAnswers = async () => {
    const correctness = answers.map((a, i) => a === questions[i].correct_index);
    setRevealed(correctness.map(() => true));
    const score = correctness.filter(Boolean).length;
    const all = score === questions.length;
    setAllCorrect(all);

    setBusy(true);
    try {
      const isFirstAttempt = (attendee.quiz_attempts ?? 0) === 0;
      const payload: any = {
        quiz_attempts: (attendee.quiz_attempts ?? 0) + 1,
        quiz_answers: answers,
        quiz_score: score,
        quiz_total: questions.length,
      };
      if (isFirstAttempt) {
        payload.initial_quiz_score = score;
        payload.initial_quiz_total = questions.length;
      }
      if (all) {
        payload.quiz_completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("toolbox_talk_attendees").update(payload).eq("id", attendee.id);
      if (error) throw error;
      setAttendee({ ...attendee, ...payload });
      if (all) toast.success("All correct! Sign to complete.");
      else toast.message(`${score}/${questions.length} correct — review the wrong ones and retry.`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setBusy(false); }
  };

  const retry = () => {
    setRevealed(questions.map(() => false));
    setAllCorrect(false);
  };

  const submitSignature = async () => {
    if (!signature) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("toolbox_talk_attendees").update({
        signature_data: signature, signed_at: new Date().toISOString(),
      }).eq("id", attendee.id);
      if (error) throw error;
      setStep("done");
      toast.success("Signed! You're all set.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save signature");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Safety talk · from {session.foreman_name ?? "your foreman"}</p>
          <h1 className="font-display text-2xl uppercase tracking-wide">{talk.title}</h1>
          {talk.category && <p className="text-xs text-muted-foreground mt-1">{talk.category}</p>}
        </div>

        {step === "done" || attendee.signed_at ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center space-y-2">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="font-display text-lg">You're signed off</p>
            <p className="text-xs text-muted-foreground">
              Initial quiz: {attendee.initial_quiz_score ?? 0}/{attendee.initial_quiz_total ?? questions.length}
              {(attendee.quiz_attempts ?? 1) > 1 && ` · final after ${attendee.quiz_attempts} attempts`}
            </p>
            <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">Back to home</Link>
          </div>
        ) : (
          <>
            {/* Talk content */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              {talk.image_url && <img src={talk.image_url} alt={talk.title} className="w-full rounded-lg border border-border object-cover max-h-72" loading="lazy" />}
              {talk.video_url && <video src={talk.video_url} controls className="w-full rounded-lg border border-border" />}
              <div className="whitespace-pre-wrap text-sm text-foreground/90">{talk.content}</div>
            </div>

            {hasQuiz ? (
              <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">Quiz</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {attendee.quiz_attempts > 0 ? `Attempt ${attendee.quiz_attempts + (allCorrect ? 0 : 1)}` : "First attempt"}
                  </p>
                </div>

                {questions.map((q, qi) => {
                  const sel = answers[qi];
                  const wasRevealed = revealed[qi];
                  const isCorrect = sel === q.correct_index;
                  return (
                    <div key={qi} className="space-y-2">
                      <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
                      <div className="space-y-1">
                        {q.options.map((opt, oi) => {
                          const isSel = sel === oi;
                          const isAns = oi === q.correct_index;
                          let cls = "border-border";
                          if (wasRevealed) {
                            if (isAns) cls = "border-emerald-500 bg-emerald-500/10";
                            else if (isSel && !isAns) cls = "border-destructive bg-destructive/10";
                          } else if (isSel) cls = "border-primary bg-primary/10";
                          return (
                            <label key={oi} className={`block rounded border p-2 text-sm cursor-pointer ${cls}`}>
                              <input
                                type="radio"
                                className="mr-2"
                                name={`q-${qi}`}
                                checked={isSel}
                                disabled={wasRevealed && allCorrect}
                                onChange={() => {
                                  if (wasRevealed && !allCorrect) return; // need to retry first
                                  const next = [...answers]; next[qi] = oi; setAnswers(next);
                                }}
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                      {wasRevealed && !isCorrect && (
                        <p className="text-[11px] text-destructive">Wrong — review the correct answer above.</p>
                      )}
                    </div>
                  );
                })}

                {!allCorrect ? (
                  revealed.some(Boolean) ? (
                    <Button className="w-full" onClick={retry} disabled={busy}>Retry quiz</Button>
                  ) : (
                    <Button className="w-full" onClick={checkAnswers} disabled={busy || answers.some(a => a < 0)}>
                      {busy ? "Checking…" : "Submit answers"}
                    </Button>
                  )
                ) : (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    All correct — sign below to complete.
                  </div>
                )}
              </div>
            ) : null}

            {(allCorrect || !hasQuiz) && (
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">Sign off</h2>
                <p className="text-xs text-muted-foreground">By signing, I confirm I attended this safety talk and understand the content.</p>
                <SignaturePad onChange={setSignature} />
                <Button className="w-full" onClick={submitSignature} disabled={!signature || busy}>
                  {busy ? "Saving…" : "Submit signature"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TakeSafetyTalk;
