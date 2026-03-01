import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, MessageSquare, File, Clock } from "lucide-react";
import { pickLang, type Input } from "@shared/schema";

const typeIcons: Record<string, any> = {
  text: MessageSquare,
  meeting_note: MessageSquare,
  rfp_pdf: FileText,
  file: File,
};

interface InputsHistoryProps {
  projectId: number;
}

function getInputText(input: Input, locale: string): string {
  if (input.translatedJson) {
    const result = pickLang(input.translatedJson, locale);
    if (result && typeof result === "string") return result;
  }
  return input.rawText;
}

export function InputsHistory({ projectId }: InputsHistoryProps) {
  const { t, locale } = useI18n();
  const { data: inputs, isLoading } = useQuery<Input[]>({
    queryKey: [`/api/projects/${projectId}/inputs`],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!inputs || inputs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground" data-testid="text-no-inputs">
          {t("inputHistory.noInputs")}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[500px]">
      <div className="space-y-3 pr-3">
        {inputs.map((input) => {
          const Icon = typeIcons[input.type] || File;
          const displayText = getInputText(input, locale);
          return (
            <div
              key={input.id}
              className="p-3 rounded-md bg-muted/50 space-y-2"
              data-testid={`card-input-${input.id}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <Badge variant="outline" className="text-xs">
                    {t(`inputHistory.typeLabels.${input.type}`) || input.type}
                  </Badge>
                  {input.fileName && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {input.fileName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(input.createdAt).toLocaleString()}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {displayText.substring(0, 300)}
                {displayText.length > 300 && "..."}
              </p>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
