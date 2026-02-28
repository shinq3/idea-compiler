import { useI18n, type Locale } from "@/i18n";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const localeLabels: Record<Locale, string> = {
  ja: "JA",
  en: "EN",
  vi: "VI",
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <Select value={locale} onValueChange={(val) => setLocale(val as Locale)}>
      <SelectTrigger className="w-[130px] h-9" data-testid="select-language">
        <Globe className="w-3.5 h-3.5 mr-1.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ja" data-testid="option-lang-ja">
          <span className="font-mono text-xs mr-1.5">{localeLabels.ja}</span> {t("language.ja")}
        </SelectItem>
        <SelectItem value="en" data-testid="option-lang-en">
          <span className="font-mono text-xs mr-1.5">{localeLabels.en}</span> {t("language.en")}
        </SelectItem>
        <SelectItem value="vi" data-testid="option-lang-vi">
          <span className="font-mono text-xs mr-1.5">{localeLabels.vi}</span> {t("language.vi")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
