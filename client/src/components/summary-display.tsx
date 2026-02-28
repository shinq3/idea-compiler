import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target, AlertTriangle, Lightbulb, DollarSign, Calendar,
  HelpCircle, ArrowRight, ClipboardList, History
} from "lucide-react";
import type { Summary, SummaryJson } from "@shared/schema";

interface SummaryDisplayProps {
  projectId: number;
}

export function SummaryDisplay({ projectId }: SummaryDisplayProps) {
  const { t } = useI18n();
  const { data: summary, isLoading } = useQuery<Summary | null>({
    queryKey: [`/api/projects/${projectId}/summary/latest`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ClipboardList className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1" data-testid="text-no-summary">{t("summary.noSummary")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("summary.noSummaryDescription")}
        </p>
      </div>
    );
  }

  const s = summary.summaryJson as SummaryJson;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-sm" data-testid="text-summary-title">{t("summary.title")}</h3>
        <Badge variant="secondary" className="text-xs">
          <History className="w-3 h-3 mr-1" />
          v{summary.version}
        </Badge>
      </div>

      <ScrollArea className="max-h-[600px]">
        <div className="space-y-3 pr-3">
          {s.overview && (
            <SummarySection icon={Target} label={t("summary.overview")} content={s.overview} testId="text-summary-overview" />
          )}
          {s.challenges && (
            <SummarySection icon={AlertTriangle} label={t("summary.challenges")} content={s.challenges} testId="text-summary-challenges" />
          )}
          {s.objectives && (
            <SummarySection icon={Lightbulb} label={t("summary.objectives")} content={s.objectives} testId="text-summary-objectives" />
          )}
          {s.scope && (
            <SummarySection icon={ClipboardList} label={t("summary.scope")} content={s.scope} testId="text-summary-scope" />
          )}
          {s.featureCandidates && s.featureCandidates.length > 0 && (
            <SummaryListSection icon={Lightbulb} label={t("summary.featureCandidates")} items={s.featureCandidates} testId="list-features" />
          )}
          {s.budget && (
            <SummarySection icon={DollarSign} label={t("summary.budget")} content={s.budget} testId="text-summary-budget" />
          )}
          {s.timeline && (
            <SummarySection icon={Calendar} label={t("summary.timeline")} content={s.timeline} testId="text-summary-timeline" />
          )}
          {s.risks && s.risks.length > 0 && (
            <SummaryListSection icon={AlertTriangle} label={t("summary.risks")} items={s.risks} testId="list-risks" />
          )}
          {s.uncertainItems && s.uncertainItems.length > 0 && (
            <SummaryListSection icon={HelpCircle} label={t("summary.unresolvedItems")} items={s.uncertainItems} testId="list-uncertain" />
          )}
          {s.nextActions && s.nextActions.length > 0 && (
            <SummaryListSection icon={ArrowRight} label={t("summary.nextActions")} items={s.nextActions} testId="list-actions" />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SummarySection({ icon: Icon, label, content, testId }: {
  icon: any; label: string; content: string; testId: string;
}) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm leading-relaxed" data-testid={testId}>{content}</p>
    </div>
  );
}

function SummaryListSection({ icon: Icon, label, items, testId }: {
  icon: any; label: string; items: string[]; testId: string;
}) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <ul className="space-y-1" data-testid={testId}>
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
