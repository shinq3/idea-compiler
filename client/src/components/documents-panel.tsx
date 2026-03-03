import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Presentation, Loader2, Download, Trash2, Eye, MonitorPlay } from "lucide-react";
import { SlideViewer } from "@/components/slide-viewer";
import type { Document } from "@shared/schema";

interface DocumentsPanelProps {
  projectId: number;
  hasSummary: boolean;
}

function getDocContent(doc: Document, locale: string): string {
  const cj = doc.contentJson as any;
  if (cj && typeof cj === "object") {
    return cj[locale] || cj.en || cj.ja || cj.vi || doc.contentMd;
  }
  return doc.contentMd;
}

export function DocumentsPanel({ projectId, hasSummary }: DocumentsPanelProps) {
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [slidesData, setSlidesData] = useState<{ html: string; title: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, locale } = useI18n();

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: [`/api/projects/${projectId}/documents`],
  });

  const generateMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/documents/generate`, { type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      toast({ title: t("documents.documentGenerated") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      toast({ title: t("documents.documentDeleted") });
    },
  });

  const slidesMutation = useMutation({
    mutationFn: async (doc: Document) => {
      const res = await apiRequest("POST", `/api/documents/${doc.id}/slides`, { locale });
      const data = await res.json();
      const title = doc.type === "kickoff" ? t("documents.kickoffDocument") : t("documents.featureProposal");
      return { html: data.slidesHtml, title };
    },
    onSuccess: (data) => {
      setSlidesData(data);
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const handleDownload = (doc: Document) => {
    const content = getDocContent(doc, locale);
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.type === "kickoff" ? "kickoff-document" : "feature-proposal"}-${locale}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={() => generateMutation.mutate("kickoff")}
          disabled={!hasSummary || generateMutation.isPending}
          data-testid="button-generate-kickoff"
        >
          {generateMutation.isPending && generateMutation.variables === "kickoff" ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Presentation className="w-4 h-4 mr-1" />
          )}
          {t("documents.generateKickoff")}
        </Button>
        <Button
          onClick={() => generateMutation.mutate("feature_proposal")}
          disabled={!hasSummary || generateMutation.isPending}
          variant="outline"
          data-testid="button-generate-proposal"
        >
          {generateMutation.isPending && generateMutation.variables === "feature_proposal" ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-1" />
          )}
          {t("documents.generateProposal")}
        </Button>
      </div>

      {!hasSummary && (
        <p className="text-sm text-muted-foreground">
          {t("documents.addInputsFirst")}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4" data-testid={`card-document-${doc.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {doc.type === "kickoff" ? (
                    <Presentation className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {doc.type === "kickoff" ? t("documents.kickoffDocument") : t("documents.featureProposal")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewDoc(doc)}
                    data-testid={`button-view-doc-${doc.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {t("common.view")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => slidesMutation.mutate(doc)}
                    disabled={slidesMutation.isPending}
                    data-testid={`button-slides-doc-${doc.id}`}
                  >
                    {slidesMutation.isPending && slidesMutation.variables?.id === doc.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <MonitorPlay className="w-3 h-3 mr-1" />
                    )}
                    {t("documents.generateSlides")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    data-testid={`button-download-doc-${doc.id}`}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {t("common.download")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    data-testid={`button-delete-doc-${doc.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-documents">
          {t("documents.noDocuments")}
        </p>
      )}

      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {viewDoc?.type === "kickoff" ? t("documents.kickoffDocument") : t("documents.featureProposal")}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none pr-4" data-testid="text-document-content">
              <pre className="whitespace-pre-wrap text-sm font-sans">
                {viewDoc ? getDocContent(viewDoc, locale) : ""}
              </pre>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            {viewDoc && (
              <Button
                variant="outline"
                onClick={() => handleDownload(viewDoc)}
                data-testid="button-download-doc-modal"
              >
                <Download className="w-4 h-4 mr-1" />
                {t("common.downloadMd")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {slidesData && (
        <SlideViewer
          open={!!slidesData}
          onClose={() => setSlidesData(null)}
          slidesHtml={slidesData.html}
          title={slidesData.title}
        />
      )}
    </div>
  );
}
