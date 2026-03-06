import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import { SummaryDisplay } from "@/components/summary-display";
import { InputPanel } from "@/components/input-panel";
import { StructuredItemsPanel } from "@/components/structured-items-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import { InputsHistory } from "@/components/inputs-history";
import { SummaryHistory } from "@/components/summary-history";
import { ProjectMembersPanel } from "@/components/project-members-panel";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, MessageSquare, FileText, Database, FolderOpen,
  History, Pencil, ChevronDown, ChevronRight, Building2, Users, Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import { pickLang, type Project, type Summary } from "@shared/schema";

interface OrgData {
  id: number;
  name: string;
  slug: string;
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = Number(params?.id);
  const queryClient = useQueryClient();
  const { t, locale } = useI18n();
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", customerName: "", owner: "",
    budgetMin: "", budgetMax: "", releaseDateTarget: "",
  });
  const [, navigate] = useLocation();

  const canManageProject = currentUser && ["system_admin", "org_admin", "pm"].includes(currentUser.role);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    refetchInterval: (query) => {
      const p = query.state.data as Project | undefined;
      if (!p) return 5000;
      const hasConfidence = (p.budgetConfidence ?? 0) > 0 || (p.timelineConfidence ?? 0) > 0 || (p.requirementConfidence ?? 0) > 0;
      return hasConfidence ? false : 5000;
    },
  });

  const { data: latestSummary } = useQuery<Summary | null>({
    queryKey: [`/api/projects/${projectId}/summary/latest`],
    refetchInterval: (query) => {
      return query.state.data ? false : 5000;
    },
  });

  const { data: orgs } = useQuery<OrgData[]>({
    queryKey: ["/api/organizations"],
  });

  const getOrgName = (orgId: number | null | undefined) => {
    if (!orgId || !orgs) return null;
    const org = orgs.find((o) => o.id === orgId);
    return org?.name || null;
  };

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

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t("projectDetail.deleted") });
      navigate("/");
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = () => {
    if (!project) return;
    setEditForm({
      title: project.title,
      customerName: project.customerName || "",
      owner: project.owner || "",
      budgetMin: project.budgetMin?.toString() || "",
      budgetMax: project.budgetMax?.toString() || "",
      releaseDateTarget: project.releaseDateTarget || "",
    });
    setShowEditDialog(true);
  };

  const editProjectMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t("createProject.projectUpdated") });
      setShowEditDialog(false);
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const handleEditSubmit = () => {
    const data: Record<string, any> = { title: editForm.title };
    data.customerName = editForm.customerName || null;
    data.owner = editForm.owner || null;
    data.budgetMin = editForm.budgetMin ? Number(editForm.budgetMin) : null;
    data.budgetMax = editForm.budgetMax ? Number(editForm.budgetMax) : null;
    data.releaseDateTarget = editForm.releaseDateTarget || null;
    editProjectMutation.mutate(data);
  };

  const updateOrgMutation = useMutation({
    mutationFn: async (organizationId: number) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, { organizationId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t("projectDetail.orgUpdated") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
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

  const orgName = getOrgName(project.organizationId);

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
              {pickLang(project.titleJson || project.title, locale) as string}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {orgName && (
                <div className="flex items-center gap-1" data-testid="text-project-org">
                  <Building2 className="w-3 h-3" />
                  <span>{orgName}</span>
                </div>
              )}
              {project.customerName && (
                <span data-testid="text-customer">{pickLang(project.customerNameJson || project.customerName, locale) as string}</span>
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
            {canManageProject ? (
              <>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openEditDialog}
                  data-testid="button-edit-project"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="button-delete-project"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Badge variant="secondary" data-testid="badge-status">
                {t(`status.${project.status}`)}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <ConfidenceGauge
              budget={project.budgetConfidence}
              timeline={project.timelineConfidence}
              requirement={project.requirementConfidence}
            />
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-sm">{t("projectDetail.projectDetails")}</h3>
            <DetailRow label={t("projectDetail.organization")}>
              {isAdmin && orgs && orgs.length > 0 ? (
                <Select
                  value={project.organizationId?.toString() || ""}
                  onValueChange={(val) => updateOrgMutation.mutate(Number(val))}
                >
                  <SelectTrigger className="w-[180px] h-8 text-sm" data-testid="select-project-org">
                    <SelectValue placeholder={t("createProject.selectOrg")} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  {orgName || t("common.notSet")}
                </div>
              )}
            </DetailRow>
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

        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center justify-between w-full p-5 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
                data-testid="button-toggle-summary"
              >
                <h3 className="font-semibold text-sm">{t("summary.title")}</h3>
                {summaryOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-5">
                <SummaryDisplay projectId={projectId} />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Tabs defaultValue="input" className="w-full">
          <TabsList className="w-full grid grid-cols-6">
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
            <TabsTrigger value="members" data-testid="tab-members">
              <Users className="w-3 h-3 mr-1" />
              {t("tabs.members")}
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

          <TabsContent value="members" className="mt-4">
            <Card className="p-5">
              <ProjectMembersPanel projectId={projectId} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("projectDetail.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectDetail.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-project">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProjectMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-project"
            >
              {deleteProjectMutation.isPending ? t("common.processing") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-edit-project">
          <DialogHeader>
            <DialogTitle>{t("createProject.editProject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("createProject.projectTitle")}</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                data-testid="input-edit-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("createProject.customer")}</Label>
                <Input
                  value={editForm.customerName}
                  onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
                  placeholder={t("createProject.customerPlaceholder")}
                  data-testid="input-edit-customer"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("createProject.owner")}</Label>
                <Input
                  value={editForm.owner}
                  onChange={(e) => setEditForm((f) => ({ ...f, owner: e.target.value }))}
                  placeholder={t("createProject.ownerPlaceholder")}
                  data-testid="input-edit-owner"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("createProject.budgetMin")}</Label>
                <Input
                  type="number"
                  value={editForm.budgetMin}
                  onChange={(e) => setEditForm((f) => ({ ...f, budgetMin: e.target.value }))}
                  data-testid="input-edit-budget-min"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("createProject.budgetMax")}</Label>
                <Input
                  type="number"
                  value={editForm.budgetMax}
                  onChange={(e) => setEditForm((f) => ({ ...f, budgetMax: e.target.value }))}
                  data-testid="input-edit-budget-max"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("createProject.targetReleaseDate")}</Label>
              <Input
                type="date"
                value={editForm.releaseDateTarget}
                onChange={(e) => setEditForm((f) => ({ ...f, releaseDateTarget: e.target.value }))}
                data-testid="input-edit-target-date"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit-project">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={!editForm.title.trim() || editProjectMutation.isPending}
                data-testid="button-save-edit-project"
              >
                {editProjectMutation.isPending ? t("common.processing") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
