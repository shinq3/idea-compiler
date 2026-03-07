import { Link, useLocation } from "wouter";
import { FolderKanban, Users, Building2, LogOut, UserCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function Layout({ children, title, actions }: LayoutProps) {
  const { user, logout, canManageUsers, canManageOrgs } = useAuth();
  const { t } = useI18n();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-6 h-14 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink">
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer shrink-0" data-testid="link-home">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                  <FolderKanban className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-sm tracking-tight hidden sm:inline">IdeaCompiler</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 min-w-0">
              <Link href="/dashboard">
                <Button
                  variant={location === "/dashboard" ? "secondary" : "ghost"}
                  size="sm"
                  className="text-xs whitespace-nowrap"
                  data-testid="nav-dashboard"
                >
                  {t("nav.dashboard")}
                </Button>
              </Link>
              {canManageUsers && (
                <Link href="/users">
                  <Button
                    variant={location === "/users" ? "secondary" : "ghost"}
                    size="sm"
                    className="text-xs whitespace-nowrap"
                    data-testid="nav-users"
                  >
                    <Users className="w-3 h-3 mr-1 shrink-0" />
                    {t("nav.users")}
                  </Button>
                </Link>
              )}
              {canManageOrgs && (
                <Link href="/organizations">
                  <Button
                    variant={location === "/organizations" ? "secondary" : "ghost"}
                    size="sm"
                    className="text-xs whitespace-nowrap"
                    data-testid="nav-organizations"
                  >
                    <Building2 className="w-3 h-3 mr-1 shrink-0" />
                    {t("nav.organizations")}
                  </Button>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            {user && (
              <div className="flex items-center gap-1.5">
                <Link href="/profile">
                  <button className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-[200px]" data-testid="link-profile">
                    <UserCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate" data-testid="text-current-user">{user.displayName}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 whitespace-nowrap" data-testid="badge-user-role">
                      {t(`roles.${user.role}`)}
                    </Badge>
                  </button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-8 w-8"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        {title && (
          <h1 className="text-2xl font-semibold tracking-tight mb-6" data-testid="text-page-title">{title}</h1>
        )}
        {children}
      </main>
    </div>
  );
}
