import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { Layout } from "@/components/layout";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ConfidenceGaugeMini } from "@/components/confidence-gauge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FolderKanban, MessageSquare, Search, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { pickLang, type Project } from "@shared/schema";

const statusColors: Record<string, string> = {
  discovery: "secondary",
  proposal: "default",
  negotiation: "default",
  won: "default",
  lost: "destructive",
};

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { t, locale } = useI18n();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const filtered = (projects || []).filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const displayTitle = pickLang(p.titleJson || p.title, locale) as string;
      const displayCustomer = pickLang(p.customerNameJson || p.customerName || "", locale) as string;
      return (
        displayTitle.toLowerCase().includes(s) ||
        displayCustomer.toLowerCase().includes(s) ||
        (p.owner || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <Layout
      title={t("dashboard.title")}
      actions={<CreateProjectDialog />}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("dashboard.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder={t("dashboard.table.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("status.all")}</SelectItem>
              <SelectItem value="discovery">{t("status.discovery")}</SelectItem>
              <SelectItem value="proposal">{t("status.proposal")}</SelectItem>
              <SelectItem value="negotiation">{t("status.negotiation")}</SelectItem>
              <SelectItem value="won">{t("status.won")}</SelectItem>
              <SelectItem value="lost">{t("status.lost")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <FolderKanban className="w-9 h-9 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2" data-testid="text-no-projects">
              {search || statusFilter !== "all" ? t("dashboard.noMatchingProjects") : t("dashboard.noProjects")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              {search || statusFilter !== "all"
                ? t("dashboard.noMatchingDescription")
                : t("dashboard.noProjectsDescription")}
            </p>
            {!search && statusFilter === "all" && <CreateProjectDialog />}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">{t("dashboard.table.project")}</TableHead>
                  <TableHead>{t("dashboard.table.customer")}</TableHead>
                  <TableHead>{t("dashboard.table.status")}</TableHead>
                  <TableHead className="text-center">{t("dashboard.table.meetings")}</TableHead>
                  <TableHead className="text-center">{t("dashboard.table.confidence")}</TableHead>
                  <TableHead>{t("dashboard.table.budget")}</TableHead>
                  <TableHead>{t("dashboard.table.targetDate")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.table.updated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover-elevate"
                    data-testid={`row-project-${project.id}`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2" data-testid={`link-project-${project.id}`}>
                        <span className="font-medium text-sm">{pickLang(project.titleJson || project.title, locale) as string}</span>
                        <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {project.customerName ? pickLang(project.customerNameJson || project.customerName, locale) as string : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[project.status] as any || "secondary"}>
                        {t(`status.${project.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        {project.meetingCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ConfidenceGaugeMini
                        budget={project.budgetConfidence}
                        timeline={project.timelineConfidence}
                        requirement={project.requirementConfidence}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {project.budgetMin || project.budgetMax
                          ? `${project.budgetMin?.toLocaleString() || "?"} - ${project.budgetMax?.toLocaleString() || "?"}`
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {project.releaseDateTarget || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
