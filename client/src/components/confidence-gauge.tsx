import { useI18n } from "@/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ConfidenceGaugeProps {
  budget: number;
  timeline: number;
  requirement: number;
}

export function ConfidenceGauge({ budget, timeline, requirement }: ConfidenceGaugeProps) {
  const { t } = useI18n();
  const overall = Math.round((budget + timeline + requirement) / 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{t("confidence.title")}</span>
        <span className="text-sm font-semibold tabular-nums" data-testid="text-overall-confidence">{overall}%</span>
      </div>
      <ConfidenceBar label={t("confidence.budget")} value={budget} testId="progress-budget" />
      <ConfidenceBar label={t("confidence.timeline")} value={timeline} testId="progress-timeline" />
      <ConfidenceBar label={t("confidence.requirements")} value={requirement} testId="progress-requirements" />
    </div>
  );
}

function ConfidenceBar({ label, value, testId }: { label: string; value: number; testId: string }) {
  const color =
    value >= 70 ? "bg-chart-2" : value >= 40 ? "bg-chart-4" : "bg-destructive";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(value, 2)}%` }}
          data-testid={testId}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export function ConfidenceGaugeMini({ budget, timeline, requirement }: ConfidenceGaugeProps) {
  const { t } = useI18n();
  const overall = Math.round((budget + timeline + requirement) / 3);
  const color =
    overall >= 70 ? "text-chart-2" : overall >= 40 ? "text-chart-4" : "text-destructive";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-sm font-semibold tabular-nums ${color}`} data-testid="text-confidence-mini">
          {overall}%
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <div>{t("confidence.budget")}: {budget}%</div>
          <div>{t("confidence.timeline")}: {timeline}%</div>
          <div>{t("confidence.requirements")}: {requirement}%</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
