import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FolderKanban, Users, Building2, LogOut, UserCircle, Menu, X } from "lucide-react";
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
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: FolderKanban, show: true },
    { href: "/users", label: t("nav.users"), icon: Users, show: canManageUsers },
    { href: "/organizations", label: t("nav.organizations"), icon: Building2, show: canManageOrgs },
  ].filter((item) => item.show);

  const navigateTo = (href: string) => {
    setLocation(href);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 shrink-0"
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="button-menu-toggle"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer shrink-0" data-testid="link-home">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                  <FolderKanban className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-sm tracking-tight hidden sm:inline">IdeaCompiler</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 min-w-0">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={location === item.href ? "secondary" : "ghost"}
                    size="sm"
                    className="text-xs whitespace-nowrap"
                    data-testid={`nav-${item.href.slice(1)}`}
                  >
                    <item.icon className="w-3 h-3 mr-1 shrink-0" />
                    {item.label}
                  </Button>
                </Link>
              ))}
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

        {menuOpen && (
          <div className="md:hidden border-t bg-background animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {user && (
                <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-muted/50">
                  <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{user.displayName}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 whitespace-nowrap">
                    {t(`roles.${user.role}`)}
                  </Badge>
                </div>
              )}
              {navItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigateTo(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    location === item.href
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                  data-testid={`mobile-nav-${item.href.slice(1)}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              ))}
              {user && (
                <>
                  <button
                    onClick={() => navigateTo("/profile")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      location === "/profile"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    }`}
                    data-testid="mobile-nav-profile"
                  >
                    <UserCircle className="w-4 h-4 shrink-0" />
                    {t("profile.title")}
                  </button>
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid="mobile-nav-logout"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {t("auth.logout")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {title && (
          <h1 className="text-2xl font-semibold tracking-tight mb-6" data-testid="text-page-title">{title}</h1>
        )}
        {children}
      </main>
    </div>
  );
}
