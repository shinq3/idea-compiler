import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pickLang } from "@shared/schema";
import type { StructuredItem } from "@shared/schema";

const categoryColors: Record<string, string> = {
  requirement: "default",
  issue: "destructive",
  decision: "default",
  constraint: "secondary",
  budget: "default",
  timeline: "default",
  risk: "destructive",
  term: "secondary",
  action: "default",
};

interface StructuredItemsPanelProps {
  projectId: number;
}

export function StructuredItemsPanel({ projectId }: StructuredItemsPanelProps) {
  const { t, locale } = useI18n();
  const { data: items, isLoading } = useQuery<StructuredItem[]>({
    queryKey: [`/api/projects/${projectId}/structured-items`],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground" data-testid="text-no-items">
          {t("structuredItems.noItems")}
        </p>
      </div>
    );
  }

  const grouped = items.reduce<Record<string, StructuredItem[]>>((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const pickStr = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val;
    return pickLang(val, locale);
  };

  return (
    <ScrollArea className="max-h-[600px]">
      <div className="space-y-6 pr-3">
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={categoryColors[category] as any || "secondary"}>
                {t(`structuredItems.categories.${category}`) || category}
              </Badge>
              <span className="text-xs text-muted-foreground">{catItems.length} {t("common.items")}</span>
            </div>
            <div className="space-y-2">
              {catItems.map((item) => {
                const val = item.valueJson as any;
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-md bg-muted/50 space-y-1"
                    data-testid={`card-structured-item-${item.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {pickStr(val?.title) || pickStr(val?.name) || "Item"}
                      </span>
                      {item.confidence !== null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Math.round((item.confidence || 0) * 100)}% {t("common.confidence")}
                        </span>
                      )}
                    </div>
                    {pickStr(val?.description) && (
                      <p className="text-sm text-muted-foreground">{pickStr(val.description)}</p>
                    )}
                    {val?.priority && (
                      <Badge variant="outline" className="text-xs">
                        {val.priority}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
