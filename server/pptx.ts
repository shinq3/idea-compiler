import PptxGenJSModule from "pptxgenjs";

const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(strong|b)>/gi, "")
    .replace(/<\/?(em|i)>/gi, "")
    .replace(/<\/?(span|div|p|h[1-6]|li|ul|ol|a|section|table|tr|td|th|thead|tbody)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSections(html: string): string[] {
  const sections: string[] = [];
  const regex = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    sections.push(match[0]);
  }
  return sections;
}

function extractColor(gradient: string): string {
  const m = gradient.match(/#([0-9a-fA-F]{6})/);
  return m ? m[1] : "1a1a2e";
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

interface TextRun {
  text: string;
  options: Record<string, any>;
}

export async function generatePptxBuffer(slidesHtml: string, title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;

  const COLORS = {
    primary: "667eea",
    secondary: "764ba2",
    success: "48bb78",
    warning: "ed8936",
    danger: "e53e3e",
    dark: "1a1a2e",
    text: "2d3748",
    subtext: "718096",
    lightBg: "F7FAFC",
    cardBg: "EDF2F7",
    white: "FFFFFF",
  };
  const ACCENT_CYCLE = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.secondary, "38a169"];

  const sections = parseSections(slidesHtml);

  if (sections.length === 0) {
    const slide = pptx.addSlide();
    slide.addText(title, { x: 0.5, y: 2.5, w: 12.33, h: 1.5, fontSize: 36, bold: true, align: "center", color: COLORS.dark });
  }

  for (let si = 0; si < sections.length; si++) {
    const sectionHtml = sections[si];
    const slide = pptx.addSlide();

    const bgMatch = sectionHtml.match(/data-background="([^"]+)"/);
    const bgColor = bgMatch ? extractColor(bgMatch[1]) : null;
    if (bgColor) slide.background = { color: bgColor };

    const isDark = bgColor ? !isLightColor(bgColor) : false;
    const txtColor = isDark ? COLORS.white : COLORS.text;
    const subColor = isDark ? "CCCCCC" : COLORS.subtext;

    const inner = sectionHtml.replace(/^<section[^>]*>/i, "").replace(/<\/section>$/i, "").trim();

    const h1 = inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h2 = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const h3 = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const h4 = inner.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);

    let yPos = 0.3;

    const emojiMatch = inner.match(/<(?:span|div)[^>]*style="[^"]*font-size:\s*[23](?:\.\d+)?em[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i);
    if (emojiMatch) {
      const emoji = stripHtml(emojiMatch[1]).trim();
      if (emoji.length <= 4) {
        slide.addText(emoji, { x: 0.5, y: yPos, w: 12.33, h: 0.7, fontSize: 36, align: "center" });
        yPos += 0.7;
      }
    }

    if (h1) {
      slide.addText(stripHtml(h1[1]), {
        x: 0.5, y: yPos, w: 12.33, h: 1.0,
        fontSize: 32, bold: true, align: "center", color: txtColor,
      });
      yPos += 1.0;
    }
    if (h2) {
      const txt = stripHtml(h2[1]);
      if (!h1 || txt !== stripHtml(h1[1])) {
        slide.addText(txt, {
          x: 0.5, y: yPos, w: 12.33, h: 0.7,
          fontSize: h1 ? 20 : 28, bold: !h1, align: "center", color: h1 ? subColor : txtColor,
        });
        yPos += 0.7;
      }
    }
    if (h3 && !h1) {
      slide.addText(stripHtml(h3[1]), {
        x: 0.5, y: yPos, w: 12.33, h: 0.5,
        fontSize: 16, align: "center", color: subColor,
      });
      yPos += 0.5;
    }

    yPos += 0.15;

    const listItems: string[] = [];
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let lm;
    while ((lm = liRe.exec(inner)) !== null) {
      const t = stripHtml(lm[1]);
      if (t.length > 1) listItems.push(t);
    }

    const cardDivs: { title: string; body: string }[] = [];
    const cardRe = /<div[^>]*style="[^"]*(?:background|border-left|border-top)[^"]*(?:padding|border-radius)[^"]*"[^>]*>([\s\S]*?)(?:<\/div>){1,3}/gi;
    let cm;
    while ((cm = cardRe.exec(inner)) !== null) {
      const full = stripHtml(cm[1]);
      const lines = full.split("\n").filter(l => l.trim());
      if (lines.length > 0 && full.length > 5) {
        cardDivs.push({ title: lines[0], body: lines.slice(1).join("\n") });
      }
    }

    const progressBars: { label: string; pct: number; color: string }[] = [];
    const barRe = /<div[^>]*style="[^"]*background:\s*#e2e8f0[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*(?:background|background:linear-gradient)[^"]*width:\s*(\d+)%[^"]*"[^>]*>/gi;
    let bm;
    while ((bm = barRe.exec(inner)) !== null) {
      const pct = parseInt(bm[1]);
      const labelBefore = inner.substring(Math.max(0, bm.index - 200), bm.index);
      const labelMatch = labelBefore.match(/(?:font-weight:\s*600|font-weight:\s*700|font-weight:bold)[^>]*>([^<]+)<\/(?:div|span)>/i)
        || labelBefore.match(/>([^<]{2,40})<\/(?:div|span)>\s*$/i);
      const label = labelMatch ? stripHtml(labelMatch[1]) : `Item`;
      const colorM = bm[0].match(/#([0-9a-fA-F]{6})/);
      progressBars.push({ label, pct, color: colorM ? colorM[1] : COLORS.primary });
    }

    const donutCharts: { value: string; color: string }[] = [];
    const donutRe = /conic-gradient\(\s*#([0-9a-fA-F]{6})\s+\d+%\s+\d+%/gi;
    let dm;
    while ((dm = donutRe.exec(inner)) !== null) {
      const around = inner.substring(dm.index, dm.index + 400);
      const valM = around.match(/>(\d+%?\+?)<\/div>/i) || around.match(/font-weight:\s*700[^>]*>([^<]+)</i);
      donutCharts.push({ value: valM ? stripHtml(valM[1]) : "—", color: dm[1] });
    }

    const metricBoxes: { emoji: string; value: string; label: string }[] = [];
    const metricRe = /<div[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*font-size:\s*[23](?:\.\d+)?em[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*style="[^"]*font-weight:\s*700[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/gi;
    let mm;
    while ((mm = metricRe.exec(inner)) !== null) {
      metricBoxes.push({
        emoji: stripHtml(mm[1]).substring(0, 4),
        value: stripHtml(mm[2]),
        label: stripHtml(mm[3]),
      });
    }

    const tableRows: string[][] = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trm;
    while ((trm = trRe.exec(inner)) !== null) {
      const cells: string[] = [];
      const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let tdm;
      while ((tdm = tdRe.exec(trm[1])) !== null) {
        cells.push(stripHtml(tdm[1]));
      }
      if (cells.length > 0) tableRows.push(cells);
    }

    let contentPlaced = false;

    if (tableRows.length >= 2) {
      contentPlaced = true;
      const cols = tableRows[0].length || 1;
      const colW = 11.33 / cols;
      const rows: any[][] = tableRows.slice(0, 10).map((row, ri) =>
        row.map(cell => ({
          text: cell,
          options: {
            fontSize: 9,
            color: ri === 0 ? COLORS.white : COLORS.text,
            bold: ri === 0,
            fill: { color: ri === 0 ? COLORS.primary : (ri % 2 === 0 ? COLORS.lightBg : COLORS.white) },
            border: [{ pt: 0.5, color: "CBD5E0" }, { pt: 0.5, color: "CBD5E0" }, { pt: 0.5, color: "CBD5E0" }, { pt: 0.5, color: "CBD5E0" }],
            valign: "middle" as const,
          },
        }))
      );

      slide.addTable(rows, {
        x: 0.8, y: yPos, w: 11.73,
        colW: Array(cols).fill(colW),
        rowH: 0.35,
        border: { pt: 0.5, color: "CBD5E0" },
      });
    }

    if (!contentPlaced && metricBoxes.length >= 2) {
      contentPlaced = true;
      const cnt = Math.min(metricBoxes.length, 4);
      const bw = 11.33 / cnt;
      metricBoxes.slice(0, cnt).forEach((m, i) => {
        const x = 0.8 + i * bw;
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: x + 0.1, y: yPos, w: bw - 0.2, h: 2.2,
          fill: { color: COLORS.lightBg }, rectRadius: 0.15,
        });
        slide.addText(m.emoji, { x: x + 0.1, y: yPos + 0.1, w: bw - 0.2, h: 0.6, fontSize: 28, align: "center" });
        slide.addText(m.value, { x: x + 0.1, y: yPos + 0.7, w: bw - 0.2, h: 0.6, fontSize: 22, bold: true, align: "center", color: COLORS.primary });
        slide.addText(m.label, { x: x + 0.1, y: yPos + 1.35, w: bw - 0.2, h: 0.7, fontSize: 10, align: "center", color: COLORS.subtext, wrap: true });
      });
    }

    if (!contentPlaced && donutCharts.length > 0) {
      contentPlaced = true;
      const cnt = Math.min(donutCharts.length, 4);
      const bw = 11.33 / cnt;
      donutCharts.slice(0, cnt).forEach((d, i) => {
        const x = 0.8 + i * bw + bw / 2 - 0.5;
        slide.addShape(pptx.shapes.OVAL, {
          x, y: yPos, w: 1.0, h: 1.0,
          fill: { color: d.color },
        });
        slide.addShape(pptx.shapes.OVAL, {
          x: x + 0.2, y: yPos + 0.2, w: 0.6, h: 0.6,
          fill: { color: bgColor || COLORS.white },
        });
        slide.addText(d.value, {
          x: x - 0.2, y: yPos + 1.1, w: 1.4, h: 0.4,
          fontSize: 14, bold: true, align: "center", color: d.color,
        });
      });
    }

    if (!contentPlaced && progressBars.length > 0) {
      contentPlaced = true;
      progressBars.slice(0, 6).forEach((bar, i) => {
        const y = yPos + i * 0.65;
        slide.addText(bar.label, {
          x: 0.8, y, w: 2.5, h: 0.4,
          fontSize: 10, bold: true, color: txtColor, align: "right", valign: "middle",
        });
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: 3.5, y: y + 0.05, w: 7.5, h: 0.3,
          fill: { color: "E2E8F0" }, rectRadius: 0.05,
        });
        const barW = 7.5 * (bar.pct / 100);
        if (barW > 0) {
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: 3.5, y: y + 0.05, w: barW, h: 0.3,
            fill: { color: bar.color }, rectRadius: 0.05,
          });
        }
        slide.addText(`${bar.pct}%`, {
          x: 11.2, y, w: 1.0, h: 0.4,
          fontSize: 10, bold: true, color: bar.color, align: "left", valign: "middle",
        });
      });
    }

    if (!contentPlaced && cardDivs.length > 0 && cardDivs.length <= 9) {
      contentPlaced = true;
      const cnt = cardDivs.length;
      const cols = cnt <= 3 ? cnt : Math.min(cnt, 3);
      const cardW = (11.33 - 0.25 * (cols - 1)) / cols;
      const maxRows = Math.ceil(cnt / cols);
      const cardH = Math.min(1.8, (5.0 - yPos) / maxRows - 0.15);

      cardDivs.slice(0, 9).forEach((card, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.8 + col * (cardW + 0.25);
        const y = yPos + row * (cardH + 0.15);
        const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];

        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x, y, w: cardW, h: cardH,
          fill: { color: COLORS.lightBg }, rectRadius: 0.08,
          shadow: { type: "outer", blur: 3, offset: 1, opacity: 0.15, color: "000000" },
        });

        slide.addShape(pptx.shapes.RECTANGLE, {
          x, y, w: 0.05, h: cardH,
          fill: { color: accent },
        });

        slide.addText(card.title, {
          x: x + 0.15, y: y + 0.08, w: cardW - 0.25, h: 0.35,
          fontSize: 11, bold: true, color: COLORS.text, valign: "top",
        });

        if (card.body) {
          slide.addText(card.body.substring(0, 200), {
            x: x + 0.15, y: y + 0.42, w: cardW - 0.25, h: cardH - 0.52,
            fontSize: 8, color: COLORS.subtext, valign: "top", wrap: true,
          });
        }
      });
    }

    if (!contentPlaced && listItems.length > 0) {
      contentPlaced = true;
      const items = listItems.slice(0, 10).map(item => ({
        text: item,
        options: {
          fontSize: 12,
          color: txtColor,
          bullet: { code: "2022", color: COLORS.primary },
          paraSpaceBefore: 4,
          paraSpaceAfter: 4,
        },
      }));
      slide.addText(items, {
        x: 0.8, y: yPos, w: 11.73, h: 5.0 - yPos,
        valign: "top",
      });
    }

    if (!contentPlaced) {
      let remaining = inner
        .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "")
        .replace(/<(?:span|div)[^>]*style="[^"]*font-size:\s*[23](?:\.\d+)?em[^"]*"[^>]*>[\s\S]*?<\/(?:span|div)>/gi, "");
      const text = stripHtml(remaining);
      if (text.length > 5) {
        slide.addText(text.substring(0, 600), {
          x: 0.8, y: yPos, w: 11.73, h: 5.0 - yPos,
          fontSize: 12, color: txtColor, valign: "top", wrap: true,
          lineSpacingMultiple: 1.3,
        });
      }
    }
  }

  const result = await pptx.write({ outputType: "nodebuffer" });
  if (Buffer.isBuffer(result)) return result;
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  if (result instanceof Uint8Array) return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  return Buffer.from(result as any);
}
