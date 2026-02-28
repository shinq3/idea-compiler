import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Upload, FileText, X, Loader2 } from "lucide-react";

interface InputPanelProps {
  projectId: number;
}

export function InputPanel({ projectId }: InputPanelProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState("text");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summaries`] });
      setText("");
      setFile(null);
      toast({ title: t("input.inputAdded"), description: t("input.aiAnalyzing") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!text.trim() && !file) return;
    mutation.mutate();
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
    </div>
  );
}
