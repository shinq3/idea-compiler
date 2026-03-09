import PptxGenJSModule from "pptxgenjs";
import type { PptxSlideData, PptxElement } from "./openai";

const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;

function safeColor(c?: string): string {
  if (!c) return "2d3748";
  return c.replace(/^#/, "");
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export async function generatePptxFromData(slides: PptxSlideData[], title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;

  if (!slides || slides.length === 0) {
    const slide = pptx.addSlide();
    slide.background = { color: "1a1a2e" };
    slide.addText(title, { x: 0.5, y: 2.5, w: 12.33, h: 1.5, fontSize: 36, bold: true, align: "center", color: "FFFFFF" });
  }

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    const bgColor = safeColor(slideData.bgColor);
    if (slideData.bgColor) {
      slide.background = { color: bgColor };
    }

    const isDark = slideData.bgColor ? !isLightColor(bgColor) : false;
    const defaultTextColor = isDark ? "FFFFFF" : "2d3748";
    const defaultSubColor = isDark ? "CCCCCC" : "718096";

    let yPos = 0.3;

    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5, y: yPos, w: 12.33, h: 0.9,
        fontSize: 28, bold: true, align: "center", color: defaultTextColor,
      });
      yPos += 0.9;
    }

    if (slideData.subtitle) {
      slide.addText(slideData.subtitle, {
        x: 0.5, y: yPos, w: 12.33, h: 0.5,
        fontSize: 16, align: "center", color: defaultSubColor,
      });
      yPos += 0.6;
    }

    for (const el of (slideData.elements || [])) {
      try {
        renderElement(pptx, slide, el, defaultTextColor);
      } catch (e: any) {
        console.error("[pptx] Element render error:", e.message);
      }
    }
  }

  const result = await pptx.write({ outputType: "nodebuffer" });
  if (Buffer.isBuffer(result)) return result;
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  if (result instanceof Uint8Array) return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  return Buffer.from(result as any);
}

function renderElement(pptx: any, slide: any, el: PptxElement, defaultColor: string) {
  switch (el.type) {
    case "text": {
      slide.addText(el.text || "", {
        x: el.x ?? 0.5, y: el.y ?? 0.5, w: el.w ?? 12, h: el.h ?? 0.5,
        fontSize: el.fontSize ?? 14,
        bold: el.bold ?? false,
        color: safeColor(el.color) || defaultColor,
        align: el.align ?? "left",
        valign: el.valign ?? "top",
        wrap: el.wrap !== false,
      });
      break;
    }

    case "shape": {
      const shapeMap: Record<string, any> = {
        rect: pptx.shapes.RECTANGLE,
        roundRect: pptx.shapes.ROUNDED_RECTANGLE,
        oval: pptx.shapes.OVAL,
      };
      const shapeType = shapeMap[el.shape] || pptx.shapes.ROUNDED_RECTANGLE;
      const opts: any = {
        x: el.x ?? 0.5, y: el.y ?? 0.5, w: el.w ?? 2, h: el.h ?? 1,
        fill: { color: safeColor(el.fill) },
      };
      if (el.borderColor) {
        opts.line = { color: safeColor(el.borderColor), width: el.borderWidth ?? 1 };
      }
      if (el.shape === "roundRect" && el.radius) {
        opts.rectRadius = el.radius;
      }
      if (el.shadow) {
        opts.shadow = { type: "outer", blur: 4, offset: 2, opacity: 0.2, color: "000000" };
      }
      slide.addShape(shapeType, opts);
      break;
    }

    case "bullets": {
      const items = (el.items || []).slice(0, 10).map(item => ({
        text: item,
        options: {
          fontSize: el.fontSize ?? 12,
          color: safeColor(el.color) || defaultColor,
          bullet: { code: "2022", color: safeColor(el.bulletColor) || "667eea" },
          paraSpaceBefore: 4,
          paraSpaceAfter: 4,
        },
      }));
      if (items.length > 0) {
        slide.addText(items, {
          x: el.x ?? 0.8, y: el.y ?? 1.5, w: el.w ?? 11, h: el.h ?? 4,
          valign: "top",
        });
      }
      break;
    }

    case "progressBar": {
      const trackBg = safeColor(el.bgColor) || "E2E8F0";
      const barColor = safeColor(el.barColor);
      const pct = Math.max(0, Math.min(100, el.percent ?? 0));
      const barW = (el.w ?? 8) * (pct / 100);

      if (el.label) {
        slide.addText(el.label, {
          x: (el.x ?? 3.5) - 2.8, y: el.y ?? 2, w: 2.6, h: el.h ?? 0.3,
          fontSize: 10, bold: true, color: safeColor(el.labelColor) || defaultColor,
          align: "right", valign: "middle",
        });
      }

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: el.x ?? 3.5, y: el.y ?? 2, w: el.w ?? 8, h: el.h ?? 0.3,
        fill: { color: trackBg }, rectRadius: 0.05,
      });

      if (barW > 0) {
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: el.x ?? 3.5, y: el.y ?? 2, w: barW, h: el.h ?? 0.3,
          fill: { color: barColor }, rectRadius: 0.05,
        });
      }

      slide.addText(`${pct}%`, {
        x: (el.x ?? 3.5) + (el.w ?? 8) + 0.15, y: el.y ?? 2, w: 0.8, h: el.h ?? 0.3,
        fontSize: 10, bold: true, color: barColor, align: "left", valign: "middle",
      });
      break;
    }

    case "table": {
      if (!el.rows || el.rows.length === 0) break;
      const headerColor = safeColor(el.headerColor) || "667eea";
      const headerTextColor = safeColor(el.headerTextColor) || "FFFFFF";
      const cols = el.rows[0].length || 1;
      const colW = (el.w ?? 11.5) / cols;

      const tableRows = el.rows.slice(0, 12).map((row, ri) =>
        row.map(cell => ({
          text: cell || "",
          options: {
            fontSize: 9,
            color: ri === 0 ? headerTextColor : "2d3748",
            bold: ri === 0,
            fill: { color: ri === 0 ? headerColor : (ri % 2 === 0 ? "F7FAFC" : "FFFFFF") },
            border: [
              { pt: 0.5, color: "CBD5E0" },
              { pt: 0.5, color: "CBD5E0" },
              { pt: 0.5, color: "CBD5E0" },
              { pt: 0.5, color: "CBD5E0" },
            ],
            valign: "middle" as const,
          },
        }))
      );

      slide.addTable(tableRows, {
        x: el.x ?? 0.8, y: el.y ?? 1.8, w: el.w ?? 11.5,
        colW: Array(cols).fill(colW),
        rowH: 0.35,
      });
      break;
    }
  }
}

export async function generatePptxBuffer(slidesHtml: string, title: string): Promise<Buffer> {
  return generatePptxFromData([], title);
}
