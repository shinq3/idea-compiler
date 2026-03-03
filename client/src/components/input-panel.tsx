import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Send, Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, Mic, Square, Music } from "lucide-react";
import { getToken } from "@/lib/auth";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

interface InputPanelProps {
  projectId: number;
}

type ProcessingState = "idle" | "submitting" | "processing" | "done" | "error";
type VoiceState = "idle" | "recording" | "transcribing";

export function InputPanel({ projectId }: InputPanelProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState("text");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const taskKeyRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summaries`] });
  }, [queryClient, projectId]);

  const startPolling = useCallback((taskKey: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/processing-status/${taskKey}`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === "done") {
          stopPolling();
          setProcessingState("done");
          invalidateAll();
        } else if (data.status === "error") {
          stopPolling();
          setProcessingState("error");
          setErrorMessage(data.message || "");
        }
      } catch {
      }
    }, 2000);
  }, [stopPolling, invalidateAll]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (durationRef.current) clearInterval(durationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stopPolling]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({ title: t("common.error"), description: t("input.voiceNotSupported"), variant: "destructive" });
      return;
    }

    try {
      setFile(null);
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
          setVoiceState("idle");
          setRecordingDuration(0);
          return;
        }

        setVoiceState("transcribing");
        try {
          const ext = mimeType.includes("webm") ? ".webm" : ".mp4";
          const formData = new FormData();
          formData.append("audio", blob, `recording${ext}`);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: authHeaders(),
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Transcription failed");
          }

          const data = await res.json();
          if (data.text) {
            setText((prev) => prev ? prev + "\n" + data.text : data.text);
          }
        } catch (err: any) {
          toast({ title: t("input.transcriptionFailed"), description: err.message, variant: "destructive" });
        } finally {
          setVoiceState("idle");
          setRecordingDuration(0);
        }
      };

      recorder.start(1000);
      setVoiceState("recording");
      setRecordingDuration(0);
      durationRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast({ title: t("common.error"), description: t("input.voicePermissionDenied"), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), description: err.message, variant: "destructive" });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleAudioFileUpload = async (selectedFile: File) => {
    setAudioFile(selectedFile);
    setVoiceState("transcribing");
    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Transcription failed");
      }

      const data = await res.json();
      if (data.text) {
        setText((prev) => prev ? prev + "\n" + data.text : data.text);
      }
    } catch (err: any) {
      toast({ title: t("input.transcriptionFailed"), description: err.message, variant: "destructive" });
    } finally {
      setVoiceState("idle");
      setAudioFile(null);
      if (audioFileRef.current) audioFileRef.current.value = "";
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();

      if (file) {
        formData.append("file", file);
      } else {
        formData.append("rawText", text);
        formData.append("type", inputType);
      }

      const res = await fetch(`/api/projects/${projectId}/inputs`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setText("");
      setFile(null);
      setProcessingState("processing");
      setDialogOpen(true);
      setErrorMessage("");

      if (data.taskKey) {
        taskKeyRef.current = data.taskKey;
        startPolling(data.taskKey);
      } else {
        setProcessingState("done");
        invalidateAll();
      }
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!text.trim() && !file) return;
    setProcessingState("submitting");
    mutation.mutate();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    if (processingState === "done" || processingState === "error") {
      setProcessingState("idle");
      taskKeyRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Button
          variant={inputType === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => { setInputType("text"); setFile(null); }}
          data-testid="button-input-text"
        >
          {t("input.textMemo")}
        </Button>
        <Button
          variant={inputType === "meeting_note" ? "default" : "outline"}
          size="sm"
          onClick={() => { setInputType("meeting_note"); setFile(null); }}
          data-testid="button-input-meeting"
        >
          {t("input.meetingNotes")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          data-testid="button-input-file"
        >
          <Upload className="w-3 h-3 mr-1" />
          {t("input.uploadFile")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => audioFileRef.current?.click()}
          disabled={voiceState !== "idle"}
          data-testid="button-upload-audio"
        >
          <Music className="w-3 h-3 mr-1" />
          {t("input.uploadAudio")}
        </Button>
        {voiceState === "idle" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={startRecording}
            data-testid="button-voice-record"
          >
            <Mic className="w-3 h-3 mr-1" />
            {t("input.voiceRecord")}
          </Button>
        ) : voiceState === "recording" ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="animate-pulse"
            data-testid="button-voice-stop"
          >
            <Square className="w-3 h-3 mr-1 fill-current" />
            {formatDuration(recordingDuration)}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            data-testid="button-voice-transcribing"
          >
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t("input.transcribing")}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setText("");
          }}
          data-testid="input-file-upload"
        />
        <input
          ref={audioFileRef}
          type="file"
          accept=".mp3,.wav,.m4a,.webm,.mp4,.ogg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAudioFileUpload(f);
          }}
          data-testid="input-audio-upload"
        />
      </div>

      {voiceState === "recording" && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium">{t("input.recording")}</span>
            <span className="text-sm text-muted-foreground ml-auto font-mono">
              {formatDuration(recordingDuration)}
            </span>
          </div>
        </Card>
      )}

      {voiceState === "transcribing" && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div>
              <span className="text-sm">{t("input.transcribing")}</span>
              {audioFile && (
                <p className="text-xs text-muted-foreground mt-0.5">{audioFile.name}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {voiceState === "idle" && (
        <>
          {file ? (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  data-testid="button-remove-uploaded-file"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ) : (
            <Textarea
              placeholder={
                inputType === "meeting_note"
                  ? t("input.meetingPlaceholder")
                  : t("input.textPlaceholder")
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[140px] resize-y"
              data-testid="textarea-input"
            />
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={mutation.isPending || voiceState !== "idle" || (!text.trim() && !file)}
          data-testid="button-submit-input"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              {t("common.processing")}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" />
              {t("common.submit")}
            </>
          )}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-processing">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {processingState === "processing" && (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  {t("input.processingDialogTitle")}
                </>
              )}
              {processingState === "done" && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  {t("input.processingComplete")}
                </>
              )}
              {processingState === "error" && (
                <>
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  {t("input.processingError")}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {processingState === "processing" && t("input.processingDialogDescription")}
              {processingState === "done" && t("input.processingCompleteDescription")}
              {processingState === "error" && errorMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleDialogClose}
              data-testid="button-dialog-close"
            >
              {t("input.understood")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
