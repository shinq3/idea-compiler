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
import type { Summary, SummaryContent, pickLang } from "@shared/schema";
import { pickLang as pick } from "@shared/schema";

interface SummaryDisplayProps {
  projectId: number;
}

function getSummaryContent(summaryJson: any, locale: string): SummaryContent | null {
  if (!summaryJson) return null;
  if (summaryJson.ja || summaryJson.en || summaryJson.vi) {
    return (summaryJson[locale] || summaryJson.en || summaryJson.ja || summaryJson.vi) as SummaryContent;
  }
  return summaryJson as SummaryContent;
}

export function SummaryDisplay({ projectId }: SummaryDisplayProps) {
  const { t, locale } = useI18n();
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

  const s = getSummaryContent(summary.summaryJson, locale);
  if (!s) return null;

  const pickStr = (val: any) => {
    if (!val) return "";
    if (typeof val === "string") return val;
    return pick(val, locale);
  };

  const pickArr = (val: any): string[] => {
    if (!val || !Array.isArray(val)) return [];
    return val.map((item: any) => {
      if (typeof item === "string") return item;
      return pick(item, locale);
    });
  };

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
          {pickStr(s.overview) && (
            <SummarySection icon={Target} label={t("summary.overview")} content={pickStr(s.overview)} testId="text-summary-overview" />
          )}
          {pickStr(s.challenges) && (
            <SummarySection icon={AlertTriangle} label={t("summary.challenges")} content={pickStr(s.challenges)} testId="text-summary-challenges" />
          )}
          {pickStr(s.objectives) && (
            <SummarySection icon={Lightbulb} label={t("summary.objectives")} content={pickStr(s.objectives)} testId="text-summary-objectives" />
          )}
          {pickStr(s.scope) && (
            <SummarySection icon={ClipboardList} label={t("summary.scope")} content={pickStr(s.scope)} testId="text-summary-scope" />
          )}
          {pickArr(s.featureCandidates).length > 0 && (
            <SummaryListSection icon={Lightbulb} label={t("summary.featureCandidates")} items={pickArr(s.featureCandidates)} testId="list-features" />
          )}
          {pickStr(s.budget) && (
            <SummarySection icon={DollarSign} label={t("summary.budget")} content={pickStr(s.budget)} testId="text-summary-budget" />
          )}
          {pickStr(s.timeline) && (
            <SummarySection icon={Calendar} label={t("summary.timeline")} content={pickStr(s.timeline)} testId="text-summary-timeline" />
          )}
          {pickArr(s.risks).length > 0 && (
            <SummaryListSection icon={AlertTriangle} label={t("summary.risks")} items={pickArr(s.risks)} testId="list-risks" />
          )}
          {pickArr(s.uncertainItems).length > 0 && (
            <SummaryListSection icon={HelpCircle} label={t("summary.unresolvedItems")} items={pickArr(s.uncertainItems)} testId="list-uncertain" />
          )}
          {pickArr(s.nextActions).length > 0 && (
            <SummaryListSection icon={ArrowRight} label={t("summary.nextActions")} items={pickArr(s.nextActions)} testId="list-actions" />
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
