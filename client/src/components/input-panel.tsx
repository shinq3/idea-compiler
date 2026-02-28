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
import { Send, Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface InputPanelProps {
  projectId: number;
}

type ProcessingState = "idle" | "submitting" | "processing" | "done" | "error";

export function InputPanel({ projectId }: InputPanelProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState("text");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const taskKeyRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
        const res = await fetch(`/api/processing-status/${taskKey}`);
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
        // ignore polling errors
      }
    }, 2000);
  }, [stopPolling, invalidateAll]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

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
      </div>

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

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={mutation.isPending || (!text.trim() && !file)}
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
