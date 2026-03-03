import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth, getToken } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Upload, FileText, X } from "lucide-react";

const createProjectSchema = z.object({
  title: z.string().min(1, "Project title is required"),
  customerName: z.string().optional(),
  owner: z.string().optional(),
  budgetMin: z.string().optional(),
  budgetMax: z.string().optional(),
  releaseDateTarget: z.string().optional(),
});

type FormData = z.infer<typeof createProjectSchema>;

interface OrgData {
  id: number;
  name: string;
  slug: string;
}

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [organizationId, setOrganizationId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const { user, isAdmin } = useAuth();

  const { data: orgs } = useQuery<OrgData[]>({
    queryKey: ["/api/organizations"],
    enabled: isAdmin,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: "",
      customerName: "",
      owner: "",
      budgetMin: "",
      budgetMax: "",
      releaseDateTarget: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();
      formData.append("title", data.title);
      if (data.customerName) formData.append("customerName", data.customerName);
      if (data.owner) formData.append("owner", data.owner);
      if (data.budgetMin) formData.append("budgetMin", data.budgetMin);
      if (data.budgetMax) formData.append("budgetMax", data.budgetMax);
      if (data.releaseDateTarget) formData.append("releaseDateTarget", data.releaseDateTarget);
      if (isAdmin && organizationId) formData.append("organizationId", organizationId);
      if (file) formData.append("rfpFile", file);

      const headers: Record<string, string> = {};
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/projects", { method: "POST", body: formData, headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t("createProject.projectCreated"), description: file ? t("createProject.pdfAnalyzing") : undefined });
      setOpen(false);
      form.reset();
      setFile(null);
      setOrganizationId("");
      navigate(`/projects/${project.id}`);
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-project">
          <Plus className="w-4 h-4 mr-1" />
          {t("dashboard.newProject")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createProject.title")}</DialogTitle>
          <DialogDescription>
            {t("createProject.description")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">{t("createProject.projectTitle")} *</Label>
            <Input
              id="title"
              placeholder={t("createProject.projectTitlePlaceholder")}
              {...form.register("title")}
              data-testid="input-project-title"
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{t("createProject.projectTitleRequired")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customerName">{t("createProject.customer")}</Label>
              <Input
                id="customerName"
                placeholder={t("createProject.customerPlaceholder")}
                {...form.register("customerName")}
                data-testid="input-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">{t("createProject.owner")}</Label>
              <Input
                id="owner"
                placeholder={t("createProject.ownerPlaceholder")}
                {...form.register("owner")}
                data-testid="input-owner"
              />
            </div>
          </div>

          {isAdmin && orgs && orgs.length > 0 && (
            <div className="space-y-2">
              <Label>{t("createProject.organization")}</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger data-testid="select-project-org">
                  <SelectValue placeholder={t("createProject.selectOrg")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="budgetMin">{t("createProject.budgetMin")}</Label>
              <Input
                id="budgetMin"
                type="number"
                placeholder="0"
                {...form.register("budgetMin")}
                data-testid="input-budget-min"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetMax">{t("createProject.budgetMax")}</Label>
              <Input
                id="budgetMax"
                type="number"
                placeholder="0"
                {...form.register("budgetMax")}
                data-testid="input-budget-max"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseDateTarget">{t("createProject.targetReleaseDate")}</Label>
            <Input
              id="releaseDateTarget"
              type="date"
              {...form.register("releaseDateTarget")}
              data-testid="input-release-date"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("createProject.rfpDocument")}</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="input-rfp-file"
            />
            {file ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  data-testid="button-remove-file"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => fileRef.current?.click()}
                data-testid="button-upload-rfp"
              >
                <Upload className="w-4 h-4" />
                {t("createProject.uploadRfp")}
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-create"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-create">
              {mutation.isPending ? t("common.creating") : t("createProject.createProject")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
