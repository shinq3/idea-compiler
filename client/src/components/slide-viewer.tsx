import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Maximize2, Minimize2, FileDown, Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";

interface SlideViewerProps {
  open: boolean;
  onClose: () => void;
  slidesHtml: string;
  title: string;
  documentId?: number;
}

function buildPreviewHtml(slidesHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; font-family: 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', 'Noto Sans', sans-serif; background: #f0f0f0; }
  #deck { position: relative; width: 100%; height: 100%; }
  section {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    flex-direction: column; padding: 40px 60px; background: #fff; text-align: center;
    overflow-y: auto;
  }
  section.active { display: flex; }
  section h1 { font-size: 2em; margin-bottom: 0.3em; }
  section h2 { font-size: 1.5em; margin-bottom: 0.4em; color: #1a1a2e; }
  section h3 { font-size: 1.1em; margin-bottom: 0.3em; color: #16213e; }
  section h4 { font-size: 0.95em; }
  section ul { text-align: left; width: 100%; max-width: 800px; padding-left: 0; list-style: none; }
  section li { margin-bottom: 0.4em; font-size: 0.8em; line-height: 1.5; }
  section p { font-size: 0.8em; line-height: 1.6; margin-bottom: 0.5em; }
  .fragment { opacity: 1; }
  #controls {
    position: fixed; bottom: 12px; right: 16px; display: flex; gap: 8px; z-index: 100;
  }
  #controls button {
    width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(0,0,0,0.15);
    color: #333; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px); transition: background 0.2s;
  }
  #controls button:hover { background: rgba(0,0,0,0.3); color: #fff; }
  #slide-number {
    position: fixed; bottom: 16px; left: 16px; font-size: 13px; color: #999; z-index: 100;
  }
  #progress {
    position: fixed; top: 0; left: 0; height: 3px; background: #667eea; z-index: 100; transition: width 0.3s;
  }
</style>
</head>
<body>
<div id="progress"></div>
<div id="deck">${slidesHtml}</div>
<div id="slide-number"></div>
<div id="controls">
  <button id="prev" aria-label="Previous">&#8592;</button>
  <button id="next" aria-label="Next">&#8594;</button>
</div>
<script>
  (function(){
    var slides = document.querySelectorAll('#deck > section');
    var current = 0;
    function show(i) {
      if (i < 0 || i >= slides.length) return;
      slides[current].classList.remove('active');
      current = i;
      slides[current].classList.add('active');
      document.getElementById('slide-number').textContent = (current+1) + ' / ' + slides.length;
      document.getElementById('progress').style.width = ((current+1)/slides.length*100) + '%';
      var bg = slides[current].getAttribute('data-background') || '';
      if (bg) { slides[current].style.background = bg; }
    }
    if (slides.length > 0) show(0);
    document.getElementById('prev').onclick = function(){ show(current - 1); };
    document.getElementById('next').onclick = function(){ show(current + 1); };
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
    });
    var startX = 0;
    document.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; });
    document.addEventListener('touchend', function(e){
      var diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 50) { diff > 0 ? show(current - 1) : show(current + 1); }
    });
  })();
<\/script>
</body>
</html>`;
}

function buildDownloadHtml(slidesHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/white.min.css">
<style>
  body { margin: 0; }
  .reveal { font-family: 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif; }
  .reveal h1, .reveal h2, .reveal h3, .reveal h4 { font-family: inherit; }
  .reveal section { padding: 20px 40px; }
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
    hash: true, transition: 'slide', width: 960, height: 700, margin: 0.04,
    slideNumber: true, controls: true, progress: true, center: true
  });
<\/script>
</body>
</html>`;
}

export function SlideViewer({ open, onClose, slidesHtml, title, documentId }: SlideViewerProps) {
  const { t } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pptxLoading, setPptxLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const previewHtml = buildPreviewHtml(slidesHtml, title);
  const downloadHtml = buildDownloadHtml(slidesHtml, title);

  const handleDownloadHtml = () => {
    const blob = new Blob([downloadHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-slides.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPptx = async () => {
    if (!documentId) return;
    setPptxLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/documents/${documentId}/pptx`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("PPTX generation failed");
      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-slides.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("PPTX download error:", e);
    } finally {
      setPptxLoading(false);
    }
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
                onClick={handleDownloadHtml}
                data-testid="button-slides-download-html"
              >
                <Download className="w-4 h-4 mr-1" />
                HTML
              </Button>
              {documentId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadPptx}
                  disabled={pptxLoading}
                  data-testid="button-slides-download-pptx"
                >
                  {pptxLoading ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-1" />
                  )}
                  PPTX
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="px-4 pb-4">
          <div className="rounded-md border bg-white dark:bg-white overflow-hidden" style={{ aspectRatio: "960/700" }}>
            <iframe
              ref={iframeRef}
              srcDoc={open ? previewHtml : ""}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
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
