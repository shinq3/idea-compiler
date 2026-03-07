import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, Upload, Mic, MicOff, Send, Loader2, ChevronDown,
  Target, AlertTriangle, Lightbulb, DollarSign, Calendar,
  HelpCircle, ArrowRight, ClipboardList, Zap, FileText, BarChart3,
  Globe, Shield, Users, Square, Music
} from "lucide-react";
import type { SummaryContent } from "@shared/schema";
import heroBgImage from "@assets/Gemini_Generated_Image_6i2h2w6i2h2w6i2h_1772852193328.png";

function getSummaryContent(summaryJson: any, locale: string): SummaryContent | null {
  if (!summaryJson) return null;
  if (summaryJson.ja || summaryJson.en || summaryJson.vi) {
    return (summaryJson[locale] || summaryJson.en || summaryJson.ja || summaryJson.vi) as SummaryContent;
  }
  return summaryJson as SummaryContent;
}

export default function Landing() {
  const { t, locale } = useI18n();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleAnalyze = async () => {
    if (!text.trim() || text.trim().length < 10) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/demo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Analysis failed");
      }
      const data = await res.json();
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".txt") || ext.endsWith(".md")) {
      const content = await file.text();
      setText((prev) => (prev ? prev + "\n\n" + content : content));
    } else if (ext.endsWith(".pdf")) {
      setText((prev) => (prev ? prev + "\n\n[PDF: " + file.name + "]" : "[PDF: " + file.name + "]"));
    }
    e.target.value = "";
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch("/api/demo/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setText((prev) => (prev ? prev + "\n\n" + data.text : data.text));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTranscribing(false);
      e.target.value = "";
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (durationRef.current) {
          clearInterval(durationRef.current);
          durationRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 1000) {
          setRecordingSeconds(0);
          return;
        }
        setTranscribing(true);
        try {
          const ext = mimeType.includes("webm") ? ".webm" : ".mp4";
          const formData = new FormData();
          formData.append("audio", blob, `recording${ext}`);
          const res = await fetch("/api/demo/transcribe", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();
          setText((prev) => (prev ? prev + "\n\n" + data.text : data.text));
        } catch (err: any) {
          setError(err.message);
        } finally {
          setTranscribing(false);
          setRecordingSeconds(0);
        }
      };
      recorder.start(1000);
      setRecording(true);
      setRecordingSeconds(0);
      durationRef.current = setInterval(() => {
        setRecordingSeconds((d) => d + 1);
      }, 1000);
    } catch {
      setError("Microphone access denied");
    }
  };

  const { user } = useAuth();
  const s = result ? getSummaryContent(result.summary, locale) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <FolderKanban className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">IdeaCompiler</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {user ? (
              <Button
                size="sm"
                onClick={() => navigate("/dashboard")}
                data-testid="button-go-dashboard"
              >
                {t("nav.dashboard")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/login")}
                data-testid="button-login"
              >
                {t("auth.login")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBgImage})` }}
        />
        <div className="absolute inset-0 bg-black/15 dark:bg-black/25" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4 text-xs" data-testid="badge-tagline">
              {t("landing.tagline")}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white drop-shadow-lg [text-shadow:_0_2px_8px_rgba(0,0,0,0.5)]" data-testid="text-hero-title">
              {t("landing.heroTitle")}
            </h1>
            <p className="text-lg mb-8 leading-relaxed text-white/90 drop-shadow-md [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]" data-testid="text-hero-description">
              {t("landing.heroDescription")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => demoRef.current?.scrollIntoView({ behavior: "smooth" })}
                data-testid="button-try-demo"
              >
                <Zap className="w-4 h-4 mr-2" />
                {t("landing.tryDemo")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                data-testid="button-signup-hero"
              >
                {t("landing.freeSignup")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-10" data-testid="text-features-title">
            {t("landing.featuresTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={FileText}
              title={t("landing.feature1Title")}
              description={t("landing.feature1Desc")}
              testId="card-feature-1"
            />
            <FeatureCard
              icon={BarChart3}
              title={t("landing.feature2Title")}
              description={t("landing.feature2Desc")}
              testId="card-feature-2"
            />
            <FeatureCard
              icon={Globe}
              title={t("landing.feature3Title")}
              description={t("landing.feature3Desc")}
              testId="card-feature-3"
            />
            <FeatureCard
              icon={Mic}
              title={t("landing.feature4Title")}
              description={t("landing.feature4Desc")}
              testId="card-feature-4"
            />
            <FeatureCard
              icon={Shield}
              title={t("landing.feature5Title")}
              description={t("landing.feature5Desc")}
              testId="card-feature-5"
            />
            <FeatureCard
              icon={Users}
              title={t("landing.feature6Title")}
              description={t("landing.feature6Desc")}
              testId="card-feature-6"
            />
          </div>
        </div>
      </section>

      <section ref={demoRef} className="py-16 border-t" id="demo">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2" data-testid="text-demo-title">
              {t("landing.demoTitle")}
            </h2>
            <p className="text-muted-foreground" data-testid="text-demo-description">
              {t("landing.demoDescription")}
            </p>
          </div>

          <div className="space-y-1">
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="demo-file-upload"
            />
            <input
              type="file"
              accept=".webm,.mp4,.m4a,.wav,.mp3,.ogg"
              onChange={handleAudioUpload}
              className="hidden"
              id="demo-audio-upload"
            />

            {recording && (
              <Card className="p-4 border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-sm font-medium text-rose-700 dark:text-rose-300">{t("landing.recording")}</span>
                  <span className="text-sm text-rose-500 ml-auto font-mono font-semibold">
                    {formatDuration(recordingSeconds)}
                  </span>
                </div>
              </Card>
            )}

            {transcribing && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm">{t("landing.transcribing")}</span>
                </div>
              </Card>
            )}

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("landing.inputPlaceholder")}
              className="min-h-[25vh] max-h-[40vh] resize-y"
              data-testid="textarea-demo-input"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!recording ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={toggleRecording}
                    disabled={transcribing}
                    className="border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 gap-2"
                    data-testid="button-demo-record"
                  >
                    <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center">
                      <Mic className="w-4 h-4 text-white" />
                    </div>
                    {t("landing.startRecord")}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={toggleRecording}
                    className="animate-pulse gap-2"
                    data-testid="button-demo-stop"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    {formatDuration(recordingSeconds)} - {t("landing.stopRecord")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => document.getElementById("demo-file-upload")?.click()}
                  data-testid="button-demo-file"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  {t("landing.uploadFile")}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => document.getElementById("demo-audio-upload")?.click()}
                  disabled={transcribing}
                  data-testid="button-demo-audio"
                >
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                    <Music className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  {t("landing.uploadAudio")}
                </Button>
              </div>
              <Button
                onClick={handleAnalyze}
                size="lg"
                disabled={analyzing || transcribing || text.trim().length < 10}
                data-testid="button-demo-analyze"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    {t("landing.analyzing")}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    {t("landing.analyze")}
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-3" data-testid="text-demo-error">{error}</p>
            )}
          </div>

          {analyzing && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">{t("landing.analyzingDescription")}</p>
            </div>
          )}

          {result && s && (
            <div ref={resultRef} className="mt-8 space-y-6">
              <h3 className="text-xl font-bold" data-testid="text-result-title">{t("landing.resultTitle")}</h3>

              {result.extracted && (result.extracted.budgetMin || result.extracted.budgetMax || result.extracted.releaseDateTarget) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(result.extracted.budgetMin || result.extracted.budgetMax) && (
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">{t("landing.budgetRange")}</span>
                      </div>
                      <p className="text-lg font-bold" data-testid="text-extracted-budget">
                        {result.extracted.budgetMin?.toLocaleString() || "?"}
                        {result.extracted.budgetMax ? ` ~ ${result.extracted.budgetMax.toLocaleString()}` : ""}
                      </p>
                    </Card>
                  )}
                  {result.extracted.releaseDateTarget && (
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">{t("landing.targetRelease")}</span>
                      </div>
                      <p className="text-lg font-bold" data-testid="text-extracted-date">
                        {result.extracted.releaseDateTarget}
                      </p>
                    </Card>
                  )}
                </div>
              )}

              <Card className="p-5 space-y-3">
                {s.overview && (
                  <SummarySection icon={Target} label={t("summary.overview")} content={s.overview as string} />
                )}
                {s.challenges && (
                  <SummarySection icon={AlertTriangle} label={t("summary.challenges")} content={s.challenges as string} />
                )}
                {s.objectives && (
                  <SummarySection icon={Lightbulb} label={t("summary.objectives")} content={s.objectives as string} />
                )}
                {s.scope && (
                  <SummarySection icon={ClipboardList} label={t("summary.scope")} content={s.scope as string} />
                )}
                {Array.isArray(s.featureCandidates) && s.featureCandidates.length > 0 && (
                  <SummaryListSection icon={Lightbulb} label={t("summary.featureCandidates")} items={s.featureCandidates as string[]} />
                )}
                {s.budget && (
                  <SummarySection icon={DollarSign} label={t("summary.budget")} content={s.budget as string} />
                )}
                {s.timeline && (
                  <SummarySection icon={Calendar} label={t("summary.timeline")} content={s.timeline as string} />
                )}
                {Array.isArray(s.risks) && s.risks.length > 0 && (
                  <SummaryListSection icon={AlertTriangle} label={t("summary.risks")} items={s.risks as string[]} />
                )}
                {Array.isArray(s.uncertainItems) && s.uncertainItems.length > 0 && (
                  <SummaryListSection icon={HelpCircle} label={t("summary.unresolvedItems")} items={s.uncertainItems as string[]} />
                )}
                {Array.isArray(s.nextActions) && s.nextActions.length > 0 && (
                  <SummaryListSection icon={ArrowRight} label={t("summary.nextActions")} items={s.nextActions as string[]} />
                )}
              </Card>

              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">{t("landing.ctaMessage")}</p>
                <Button size="lg" onClick={() => navigate("/login")} data-testid="button-signup-cta">
                  {t("landing.freeSignup")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} IdeaCompiler. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, testId }: {
  icon: any; title: string; description: string; testId: string;
}) {
  return (
    <Card className="p-6" data-testid={testId}>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

function SummarySection({ icon: Icon, label, content }: {
  icon: any; label: string; content: string;
}) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}

function SummaryListSection({ icon: Icon, label, items }: {
  icon: any; label: string; items: string[];
}) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="text-muted-foreground mt-1 shrink-0">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
