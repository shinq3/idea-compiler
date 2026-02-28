import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { Layout } from "@/components/layout";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { SummaryDisplay } from "@/components/summary-display";
import { InputPanel } from "@/components/input-panel";
import { StructuredItemsPanel } from "@/components/structured-items-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import { InputsHistory } from "@/components/inputs-history";
import { SummaryHistory } from "@/components/summary-history";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, MessageSquare, FileText, Database, FolderOpen,
  History, Pencil,
} from "lucide-react";
import type { Project, Summary } from "@shared/schema";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = Number(params?.id);
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: latestSummary } = useQuery<Summary | null>({
    queryKey: [`/api/projects/${projectId}/summary/latest`],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-lg font-semibold mb-2">{t("projectDetail.projectNotFound")}</h2>
          <Link href="/">
            <Button variant="outline" data-testid="button-back-to-dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("nav.backToDashboard")}
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      actions={
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t("common.back")}
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-project-title">
              {project.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {project.customerName && (
                <span data-testid="text-customer">{project.customerName}</span>
              )}
              {project.owner && (
                <span data-testid="text-owner">{t("common.owner")}: {project.owner}</span>
              )}
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{t("projectDetail.meetingsCount", { count: project.meetingCount })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={project.status}
              onValueChange={(val) => updateStatusMutation.mutate(val)}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discovery">{t("status.discovery")}</SelectItem>
                <SelectItem value="proposal">{t("status.proposal")}</SelectItem>
                <SelectItem value="negotiation">{t("status.negotiation")}</SelectItem>
                <SelectItem value="won">{t("status.won")}</SelectItem>
                <SelectItem value="lost">{t("status.lost")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5">
              <SummaryDisplay projectId={projectId} />
            </Card>

            <Tabs defaultValue="input" className="w-full">
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="input" data-testid="tab-input">
                  <Pencil className="w-3 h-3 mr-1" />
                  {t("tabs.input")}
                </TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-history">
                  <History className="w-3 h-3 mr-1" />
                  {t("tabs.inputs")}
                </TabsTrigger>
                <TabsTrigger value="extracted" data-testid="tab-extracted">
                  <Database className="w-3 h-3 mr-1" />
                  {t("tabs.extracted")}
                </TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents">
                  <FileText className="w-3 h-3 mr-1" />
                  {t("tabs.documents")}
                </TabsTrigger>
                <TabsTrigger value="summaries" data-testid="tab-summaries">
                  <FolderOpen className="w-3 h-3 mr-1" />
                  {t("tabs.versions")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="mt-4">
                <Card className="p-5">
                  <InputPanel projectId={projectId} />
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <Card className="p-5">
                  <InputsHistory projectId={projectId} />
                </Card>
              </TabsContent>

              <TabsContent value="extracted" className="mt-4">
                <Card className="p-5">
                  <StructuredItemsPanel projectId={projectId} />
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card className="p-5">
                  <DocumentsPanel projectId={projectId} hasSummary={!!latestSummary} />
                </Card>
              </TabsContent>

              <TabsContent value="summaries" className="mt-4">
                <Card className="p-5">
                  <SummaryHistory projectId={projectId} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <ConfidenceGauge
                budget={project.budgetConfidence}
                timeline={project.timelineConfidence}
                requirement={project.requirementConfidence}
              />
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm">{t("projectDetail.projectDetails")}</h3>
              <DetailRow label={t("projectDetail.budgetRange")}>
                {project.budgetMin || project.budgetMax
                  ? `${project.budgetMin?.toLocaleString() || "?"} - ${project.budgetMax?.toLocaleString() || "?"}`
                  : t("common.notSet")}
              </DetailRow>
              <DetailRow label={t("projectDetail.targetRelease")}>
                {project.releaseDateTarget || t("common.notSet")}
              </DetailRow>
              <DetailRow label={t("projectDetail.created")}>
                {new Date(project.createdAt).toLocaleDateString()}
              </DetailRow>
              <DetailRow label={t("projectDetail.lastUpdated")}>
                {new Date(project.updatedAt).toLocaleDateString()}
              </DetailRow>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}
