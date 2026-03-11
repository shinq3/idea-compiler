import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, MessageSquare, File, Clock, Pencil, Trash2, Save, X, RefreshCw, Loader2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { pickLang, type Input } from "@shared/schema";

const typeIcons: Record<string, any> = {
  text: MessageSquare,
  meeting_note: MessageSquare,
  rfp_pdf: FileText,
  file: File,
};

interface InputsHistoryProps {
  projectId: number;
}

function getInputText(input: Input, locale: string): string {
  if (input.translatedJson) {
    const result = pickLang(input.translatedJson, locale);
    if (result && typeof result === "string") return result;
  }
  return input.rawText;
}

export function InputsHistory({ projectId }: InputsHistoryProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useState(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Input | null>(null);
  const [reuploadingId, setReuploadingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const fileInputRef = useState<Record<number, HTMLInputElement | null>>(() => ({}))[0];

  const canManage = user && ["system_admin", "org_admin", "pm"].includes(user.role);

  const { data: inputs, isLoading } = useQuery<Input[]>({
    queryKey: [`/api/projects/${projectId}/inputs`],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const hasFailedInputs = inputs?.some((i) => i.rawText?.startsWith("[")) ?? false;

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/reprocess`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.reprocessed > 0) {
        toast({ title: t("structuredItems.reprocessing"), description: `${data.reprocessed} input(s)` });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
        }, 15000);
      } else {
        toast({ title: t("structuredItems.noUnprocessed") });
      }
    },
    onError: async (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("missing") || msg.includes("re-upload")) {
        toast({ title: t("structuredItems.fileMissing"), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), description: msg, variant: "destructive" });
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ inputId, rawText }: { inputId: number; rawText: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/inputs/${inputId}`, { rawText });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setEditingId(null);
      toast({ title: t("inputHistory.updated") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const handleReupload = async (inputId: number, file: globalThis.File) => {
    setReuploadingId(inputId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("ideacompiler_token");
      const res = await fetch(`/api/projects/${projectId}/inputs/${inputId}/reupload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Re-upload failed");
      }
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: t("structuredItems.reuploadSuccess") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setReuploadingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (inputId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/inputs/${inputId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inputs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDeleteTarget(null);
      toast({ title: t("inputHistory.deleted") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const startEdit = (input: Input) => {
    setEditingId(input.id);
    setEditText(input.rawText);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      editMutation.mutate({ inputId: editingId, rawText: editText.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!inputs || inputs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground" data-testid="text-no-inputs">
          {t("inputHistory.noInputs")}
        </p>
      </div>
    );
  }

  return (
    <>
      {canManage && hasFailedInputs && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
            data-testid="button-reprocess-inputs"
          >
            {reprocessMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            {t("structuredItems.reprocess")}
          </Button>
        </div>
      )}
      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-3 pr-3">
          {inputs.map((input) => {
            const Icon = typeIcons[input.type] || File;
            const displayText = getInputText(input, locale);
            const isEditing = editingId === input.id;
            return (
              <div
                key={input.id}
                className="p-3 rounded-md bg-muted/50 space-y-2"
                data-testid={`card-input-${input.id}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <Badge variant="outline" className="text-xs">
                      {t(`inputHistory.typeLabels.${input.type}`) || input.type}
                    </Badge>
                    {input.fileName && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {input.fileName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(input.createdAt).toLocaleString()}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        {canManage && input.rawText?.startsWith("[") && (input.type === "rfp_pdf" || input.type === "file") && (
                          <>
                            <input
                              type="file"
                              accept=".pdf,.txt,.md"
                              className="hidden"
                              ref={(el) => { fileInputRef[input.id] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReupload(input.id, file);
                                e.target.value = "";
                              }}
                              data-testid={`file-reupload-input-${input.id}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef[input.id]?.click()}
                              disabled={reuploadingId === input.id}
                              data-testid={`button-reupload-input-${input.id}`}
                            >
                              {reuploadingId === input.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3 mr-1" />
                              )}
                              {reuploadingId === input.id ? t("structuredItems.reuploading") : t("structuredItems.reupload")}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => startEdit(input)}
                          data-testid={`button-edit-input-${input.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(input)}
                            data-testid={`button-delete-input-${input.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[120px] text-sm"
                      data-testid={`textarea-edit-input-${input.id}`}
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        data-testid={`button-cancel-edit-${input.id}`}
                      >
                        <X className="w-3 h-3 mr-1" />
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={editMutation.isPending || !editText.trim()}
                        data-testid={`button-save-input-${input.id}`}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        {editMutation.isPending ? t("common.processing") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${expandedIds.has(input.id) ? "" : "line-clamp-4"}`}>
                      {expandedIds.has(input.id) ? displayText : displayText.substring(0, 500)}
                      {!expandedIds.has(input.id) && displayText.length > 500 && "..."}
                    </p>
                    {displayText.length > 200 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 px-2 text-xs text-primary"
                        onClick={() => toggleExpand(input.id)}
                        data-testid={`button-toggle-input-${input.id}`}
                      >
                        {expandedIds.has(input.id) ? (
                          <><ChevronUp className="w-3 h-3 mr-1" />{t("common.collapse")}</>
                        ) : (
                          <><ChevronDown className="w-3 h-3 mr-1" />{t("common.expand")}</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("inputHistory.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("inputHistory.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-input">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-input"
            >
              {deleteMutation.isPending ? t("common.processing") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
