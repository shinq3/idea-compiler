import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Users, UserPlus } from "lucide-react";

interface MemberData {
  id: number;
  projectId: number;
  userId: number;
  role: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    email: string;
    displayName: string;
    role: string;
    organizationId: number | null;
  };
}

interface UserData {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
  organizationId: number | null;
}

const ROLE_COLORS: Record<string, string> = {
  system_admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  org_admin: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  pm: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function ProjectMembersPanel({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [memberRole, setMemberRole] = useState<string>("viewer");
  const [showAdd, setShowAdd] = useState(false);

  const canManageMembers = currentUser && ["system_admin", "org_admin", "pm"].includes(currentUser.role);

  const { data: members, isLoading } = useQuery<MemberData[]>({
    queryKey: [`/api/projects/${projectId}/members`],
  });

  const { data: orgUsers } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    enabled: canManageMembers && showAdd,
  });

  const existingUserIds = new Set((members || []).map((m) => m.userId));
  const availableUsers = (orgUsers || []).filter((u) => !existingUserIds.has(u.id));

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) return;
      await apiRequest("POST", `/api/projects/${projectId}/members`, {
        userId: Number(selectedUserId),
        role: memberRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
      toast({ title: t("members.added") });
      setSelectedUserId("");
      setMemberRole("viewer");
      setShowAdd(false);
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
      toast({ title: t("members.removed") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{t("members.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("members.addDescription")}</p>
        </div>
        {canManageMembers && !showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-show-add-member">
            <UserPlus className="w-3 h-3 mr-1" />
            {t("members.addMember")}
          </Button>
        )}
      </div>

      {showAdd && canManageMembers && (
        <div className="flex items-end gap-2 p-3 rounded-md bg-muted/50 border flex-wrap">
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs text-muted-foreground">{t("members.selectUser")}</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9" data-testid="select-add-member-user">
                <SelectValue placeholder={t("members.selectUser")} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.displayName} ({u.username})
                  </SelectItem>
                ))}
                {availableUsers.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">-</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[120px] space-y-1">
            <label className="text-xs text-muted-foreground">{t("members.role")}</label>
            <Select value={memberRole} onValueChange={setMemberRole}>
              <SelectTrigger className="h-9" data-testid="select-add-member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">{t("members.viewer")}</SelectItem>
                <SelectItem value="editor">{t("members.editor")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="h-9"
            disabled={!selectedUserId || addMutation.isPending}
            onClick={() => addMutation.mutate()}
            data-testid="button-add-member"
          >
            {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
            {t("members.addMember")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={() => { setShowAdd(false); setSelectedUserId(""); }}
            data-testid="button-cancel-add-member"
          >
            {t("common.cancel")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : members && members.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.displayName")}</TableHead>
              <TableHead>{t("users.username")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead>{t("members.role")}</TableHead>
              {canManageMembers && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} data-testid={`row-member-${m.userId}`}>
                <TableCell className="font-medium text-sm">
                  {m.user?.displayName || "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.user?.username || "-"}
                </TableCell>
                <TableCell>
                  {m.user?.role && (
                    <Badge variant="secondary" className={`text-[10px] ${ROLE_COLORS[m.user.role] || ""}`}>
                      {t(`roles.${m.user.role}`)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {t(`members.${m.role}`)}
                  </Badge>
                </TableCell>
                {canManageMembers && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (confirm(t("members.confirmRemove"))) {
                          removeMutation.mutate(m.userId);
                        }
                      }}
                      data-testid={`button-remove-member-${m.userId}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("members.noMembers")}</p>
        </div>
      )}
    </div>
  );
}
