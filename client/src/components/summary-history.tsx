import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, History } from "lucide-react";
import type { Summary, SummaryJson } from "@shared/schema";

interface SummaryHistoryProps {
  projectId: number;
}

export function SummaryHistory({ projectId }: SummaryHistoryProps) {
  const { t } = useI18n();
  const { data: summaries, isLoading } = useQuery<Summary[]>({
    queryKey: [`/api/projects/${projectId}/summaries`],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-summary-history">
        {t("summaryHistory.noHistory")}
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-3 pr-3">
        {summaries.map((summary) => {
          const s = summary.summaryJson as SummaryJson;
          return (
            <div
              key={summary.id}
              className="p-3 rounded-md bg-muted/50"
              data-testid={`card-summary-${summary.id}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <History className="w-3 h-3 mr-1" />
                  {t("common.version")} {summary.version}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(summary.createdAt).toLocaleString()}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {s?.overview || "Summary data"}
              </p>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
