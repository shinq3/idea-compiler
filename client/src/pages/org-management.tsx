import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Building2 } from "lucide-react";

interface OrgData {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
}

export default function OrgManagement() {
  const { t } = useI18n();
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOrg, setEditOrg] = useState<OrgData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: orgs, isLoading } = useQuery<OrgData[]>({ queryKey: ["/api/organizations"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/organizations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: t("orgs.deleted") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <Layout title={t("orgs.title")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("orgs.description")}</p>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-org">
              <Plus className="w-4 h-4 mr-1" />
              {t("orgs.create")}
            </Button>
          )}
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orgs.name")}</TableHead>
                <TableHead>{t("orgs.slug")}</TableHead>
                <TableHead>{t("orgs.createdAt")}</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : orgs && orgs.length > 0 ? (
                orgs.map((o) => (
                  <TableRow key={o.id} data-testid={`row-org-${o.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {o.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.slug}</TableCell>
                    <TableCell className="text-sm">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(isAdmin || (currentUser?.role === "org_admin" && currentUser.organizationId === o.id)) && (
                          <Button variant="ghost" size="icon" onClick={() => setEditOrg(o)} data-testid={`button-edit-org-${o.id}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(t("orgs.confirmDelete"))) deleteMutation.mutate(o.id);
                            }}
                            data-testid={`button-delete-org-${o.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {t("orgs.noOrgs")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <OrgFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {editOrg && (
        <OrgFormDialog
          open={!!editOrg}
          onClose={() => setEditOrg(null)}
          org={editOrg}
        />
      )}
    </Layout>
  );
}

function OrgFormDialog({ open, onClose, org }: { open: boolean; onClose: () => void; org?: OrgData }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!org;
  const [name, setName] = useState(org?.name || "");

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/organizations/${org.id}`, { name });
      } else {
        await apiRequest("POST", "/api/organizations", { name });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: isEdit ? t("orgs.updated") : t("orgs.created") });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("orgs.editOrg") : t("orgs.createOrg")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("orgs.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="input-org-name"
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-org">
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? t("common.save") : t("orgs.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
