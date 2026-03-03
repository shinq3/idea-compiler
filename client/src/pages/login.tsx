import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) return;
    setLoading(true);
    try {
      await login(loginId, password);
      setLocation("/");
    } catch (err: any) {
      toast({ title: t("auth.loginFailed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
              <FolderKanban className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight">CaseNurture</span>
          </div>
          <CardTitle className="text-lg" data-testid="text-login-title">{t("auth.loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">{t("auth.loginId")}</Label>
              <Input
                id="login"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder={t("auth.loginIdPlaceholder")}
                autoComplete="username"
                data-testid="input-login-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                autoComplete="current-password"
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("auth.login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
