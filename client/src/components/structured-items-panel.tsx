import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Loader2 } from "lucide-react";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canManage = user && ["system_admin", "org_admin", "pm"].includes(user.role);

  const { data: items, isLoading } = useQuery<StructuredItem[]>({
    queryKey: [`/api/projects/${projectId}/structured-items`],
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/reprocess`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.reprocessed > 0) {
        toast({ title: t("structuredItems.reprocessing"), description: `${data.reprocessed} input(s)` });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/structured-items`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary/latest`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summaries`] });
        }, 15000);
      } else {
        toast({ title: t("structuredItems.noUnprocessed") });
      }
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
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
        <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-items">
          {t("structuredItems.noItems")}
        </p>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
            data-testid="button-reprocess"
          >
            {reprocessMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            {t("structuredItems.reprocess")}
          </Button>
        )}
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
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
            data-testid="button-reprocess"
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
    </div>
  );
}
