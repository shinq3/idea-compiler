import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Lock, Save, Loader2 } from "lucide-react";

const profileSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
});

const passwordSchema = z.object({
  password: z.string().min(4),
  confirmPassword: z.string().min(4),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: { displayName: string; email: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/me", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refreshUser();
      toast({ title: t("profile.updated") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/me", { password: data.password });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("profile.passwordChanged") });
      passwordForm.reset();
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <Layout title={t("profile.title")}>
      <div className="max-w-xl mx-auto space-y-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold" data-testid="text-profile-name">{user.displayName}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span data-testid="text-profile-username">@{user.username}</span>
                <Badge variant="outline" className="text-[10px]" data-testid="badge-profile-role">
                  {t(`roles.${user.role}`)}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-sm mb-4">{t("profile.basicInfo")}</h3>
          <form
            onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("users.displayName")}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  className="pl-9"
                  {...profileForm.register("displayName")}
                  data-testid="input-profile-displayname"
                />
              </div>
              {profileForm.formState.errors.displayName && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("users.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  {...profileForm.register("email")}
                  data-testid="input-profile-email"
                />
              </div>
              {profileForm.formState.errors.email && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("users.username")}</Label>
              <Input value={user.username} disabled className="bg-muted" data-testid="input-profile-username" />
              <p className="text-xs text-muted-foreground">{t("profile.usernameReadonly")}</p>
            </div>

            <Button
              type="submit"
              disabled={profileMutation.isPending}
              data-testid="button-save-profile"
            >
              {profileMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-sm mb-4">{t("profile.changePassword")}</h3>
          <form
            onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="password">{t("profile.newPassword")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9"
                  {...passwordForm.register("password")}
                  data-testid="input-profile-password"
                />
              </div>
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("profile.confirmPassword")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  className="pl-9"
                  {...passwordForm.register("confirmPassword")}
                  data-testid="input-profile-confirm-password"
                />
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{t("profile.passwordMismatch")}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={passwordMutation.isPending}
              data-testid="button-change-password"
            >
              {passwordMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-1" />
              )}
              {t("profile.changePassword")}
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
