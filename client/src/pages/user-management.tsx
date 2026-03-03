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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  system_admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  org_admin: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  pm: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface UserData {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
  organizationId: number | null;
  createdAt: string;
}

interface OrgData {
  id: number;
  name: string;
  slug: string;
}

export default function UserManagement() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: users, isLoading } = useQuery<UserData[]>({ queryKey: ["/api/users"] });
  const { data: orgs } = useQuery<OrgData[]>({ queryKey: ["/api/organizations"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t("users.deleted") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const availableRoles = (() => {
    if (!currentUser) return [];
    if (currentUser.role === "system_admin") return ["system_admin", "org_admin", "pm", "member"];
    if (currentUser.role === "org_admin") return ["pm", "member"];
    if (currentUser.role === "pm") return ["member"];
    return [];
  })();

  const getOrgName = (orgId: number | null) => {
    if (!orgId || !orgs) return "-";
    const org = orgs.find((o) => o.id === orgId);
    return org?.name || "-";
  };

  return (
    <Layout title={t("users.title")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("users.description")}</p>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-user">
            <Plus className="w-4 h-4 mr-1" />
            {t("users.create")}
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.username")}</TableHead>
                <TableHead>{t("users.displayName")}</TableHead>
                <TableHead>{t("users.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.organization")}</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : users && users.length > 0 ? (
                users.map((u) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{u.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={ROLE_COLORS[u.role] || ""}>
                        {t(`roles.${u.role}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getOrgName(u.organizationId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(currentUser?.role === "system_admin" || currentUser?.role === "org_admin") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditUser(u)}
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {u.id !== currentUser?.id && (currentUser?.role === "system_admin" || currentUser?.role === "org_admin") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(t("users.confirmDelete"))) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                            data-testid={`button-delete-user-${u.id}`}
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("users.noUsers")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <UserFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        availableRoles={availableRoles}
        orgs={orgs || []}
        currentUser={currentUser}
      />

      {editUser && (
        <UserFormDialog
          open={!!editUser}
          onClose={() => setEditUser(null)}
          user={editUser}
          availableRoles={availableRoles}
          orgs={orgs || []}
          currentUser={currentUser}
        />
      )}
    </Layout>
  );
}

function UserFormDialog({
  open,
  onClose,
  user,
  availableRoles,
  orgs,
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  user?: UserData;
  availableRoles: string[];
  orgs: OrgData[];
  currentUser: any;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!user;

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || (availableRoles[availableRoles.length - 1] || "member"));
  const [organizationId, setOrganizationId] = useState<string>(
    user?.organizationId?.toString() || currentUser?.organizationId?.toString() || ""
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = { displayName, email, role };
      if (currentUser?.role === "system_admin") {
        body.organizationId = organizationId ? Number(organizationId) : null;
      }
      if (isEdit) {
        if (password) body.password = password;
        await apiRequest("PATCH", `/api/users/${user.id}`, body);
      } else {
        body.username = username;
        body.password = password;
        await apiRequest("POST", "/api/users", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: isEdit ? t("users.updated") : t("users.created") });
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
          <DialogTitle>{isEdit ? t("users.editUser") : t("users.createUser")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4"
        >
          {!isEdit && (
            <div className="space-y-2">
              <Label>{t("users.username")}</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-user-username"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("users.email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-user-email"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("users.displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              data-testid="input-user-displayname"
            />
          </div>
          <div className="space-y-2">
            <Label>{isEdit ? t("users.newPassword") : t("users.password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isEdit}
              placeholder={isEdit ? t("users.leaveEmpty") : ""}
              data-testid="input-user-password"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("users.role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {currentUser?.role === "system_admin" && (
            <div className="space-y-2">
              <Label>{t("users.organization")}</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger data-testid="select-user-org">
                  <SelectValue placeholder={t("users.selectOrg")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-user">
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? t("common.save") : t("users.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
