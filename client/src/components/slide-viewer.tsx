import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

interface SlideViewerProps {
  open: boolean;
  onClose: () => void;
  slidesHtml: string;
  title: string;
}

function buildFullHtml(slidesHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/white.min.css">
<style>
  .reveal h2 { font-size: 1.6em; color: #1a1a2e; margin-bottom: 0.5em; }
  .reveal h3 { font-size: 1.2em; color: #16213e; }
  .reveal ul { text-align: left; }
  .reveal li { margin-bottom: 0.4em; font-size: 0.85em; }
  .reveal section { padding: 20px; }
  .reveal strong { color: #0f3460; }
</style>
</head>
<body>
<div class="reveal">
  <div class="slides">
    ${slidesHtml}
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.js"><\/script>
<script>
  Reveal.initialize({
    hash: true,
    transition: 'slide',
    width: 960,
    height: 700,
    margin: 0.1
  });
<\/script>
</body>
</html>`;
}

export function SlideViewer({ open, onClose, slidesHtml, title }: SlideViewerProps) {
  const { t } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fullHtml = buildFullHtml(slidesHtml, title);

  useEffect(() => {
    if (open && iframeRef.current) {
      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [open, fullHtml]);

  const handleDownload = () => {
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-slides.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] p-0 gap-0" ref={containerRef}>
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                data-testid="button-slides-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                data-testid="button-slides-download"
              >
                <Download className="w-4 h-4 mr-1" />
                HTML
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="px-4 pb-4">
          <div className="rounded-md border bg-white overflow-hidden" style={{ aspectRatio: "960/700" }}>
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              data-testid="iframe-slides"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {t("documents.slidesNavHint")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
