import { Link } from "wouter";
import { FolderKanban } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function Layout({ children, title, actions }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 h-14">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                <FolderKanban className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm tracking-tight">CaseNurture</span>
            </div>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {actions}
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
