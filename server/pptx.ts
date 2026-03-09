import PptxGenJSModule from "pptxgenjs";

const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;

interface ParsedSlide {
  background?: string;
  elements: SlideElement[];
}

interface SlideElement {
  type: "heading" | "text" | "card" | "list-item" | "metric" | "emoji";
  level?: number;
  text: string;
  style?: Record<string, string>;
  color?: string;
  fontSize?: number;
}

function extractTextContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(strong|b)>/gi, "")
    .replace(/<\/?(em|i)>/gi, "")
    .replace(/<\/?(span|div|p|h[1-6]|li|ul|ol|a|section)[^>]*>/gi, "\n")
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

function parseGradientColor(gradient: string): string {
  const colorMatch = gradient.match(/#([0-9a-fA-F]{6})/);
  return colorMatch ? colorMatch[1] : "1a1a2e";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function isLightColor(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
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

function getBackgroundColor(sectionHtml: string): string | null {
  const bgMatch = sectionHtml.match(/data-background="([^"]+)"/);
  if (bgMatch) {
    return parseGradientColor(bgMatch[1]);
  }
  return null;
}

export async function generatePptxBuffer(slidesHtml: string, title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;

  pptx.defineSlideMaster({
    title: "DEFAULT",
    background: { color: "FFFFFF" },
  });

  const sections = parseSections(slidesHtml);

  if (sections.length === 0) {
    const slide = pptx.addSlide();
    slide.addText(title, {
      x: 0.5, y: 2.5, w: 12.33, h: 1.5,
      fontSize: 36, bold: true, align: "center", color: "1a1a2e",
    });
  }

  for (const sectionHtml of sections) {
    const slide = pptx.addSlide();
    const bgColor = getBackgroundColor(sectionHtml);

    if (bgColor) {
      slide.background = { color: bgColor };
    }

    const textColor = bgColor && !isLightColor(bgColor) ? "FFFFFF" : "2d3748";
    const subtextColor = bgColor && !isLightColor(bgColor) ? "CCCCCC" : "718096";

    const innerHtml = sectionHtml
      .replace(/^<section[^>]*>/i, "")
      .replace(/<\/section>$/i, "")
      .trim();

    const h1Match = innerHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h2Match = innerHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const h3Match = innerHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);

    const mainHeading = h1Match || h2Match;
    const subHeading = h1Match ? (h3Match || h2Match) : h3Match;

    let headingText = mainHeading ? extractTextContent(mainHeading[1]) : "";
    let subText = subHeading ? extractTextContent(subHeading[1]) : "";

    const emojiSpanMatch = innerHtml.match(/<span[^>]*style="font-size:\s*3em[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const bigEmoji = emojiSpanMatch ? extractTextContent(emojiSpanMatch[1]) : "";

    const gridMatch = innerHtml.match(/<div[^>]*style="[^"]*display:\s*grid[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    const flexMatch = innerHtml.match(/<div[^>]*style="[^"]*display:\s*flex[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?/i);

    const listItems: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(innerHtml)) !== null) {
      listItems.push(extractTextContent(liMatch[1]));
    }

    const cardDivs: string[] = [];
    const cardRegex = /<div[^>]*style="[^"]*(?:background|border-left|border-top)[^"]*(?:padding|border-radius)[^"]*"[^>]*>([\s\S]*?)(?:<\/div>\s*){1,2}/gi;
    let cardMatch;
    while ((cardMatch = cardRegex.exec(innerHtml)) !== null) {
      const cardText = extractTextContent(cardMatch[1]);
      if (cardText.length > 3) {
        cardDivs.push(cardText);
      }
    }

    let yPos = 0.4;

    if (bigEmoji) {
      slide.addText(bigEmoji, {
        x: 0.5, y: yPos, w: 12.33, h: 0.8,
        fontSize: 40, align: "center",
      });
      yPos += 0.9;
    }

    if (headingText) {
      const isTitle = !!h1Match;
      slide.addText(headingText, {
        x: 0.5, y: yPos, w: 12.33, h: isTitle ? 1.2 : 0.8,
        fontSize: isTitle ? 36 : 28,
        bold: true,
        align: "center",
        color: textColor,
      });
      yPos += isTitle ? 1.3 : 0.9;
    }

    if (subText) {
      slide.addText(subText, {
        x: 0.5, y: yPos, w: 12.33, h: 0.6,
        fontSize: 18,
        align: "center",
        color: subtextColor,
      });
      yPos += 0.7;
    }

    if (cardDivs.length > 0 && !listItems.length) {
      const cols = Math.min(cardDivs.length, 3);
      const cardWidth = (12.33 - 0.3 * (cols - 1)) / cols;
      const cardColors = ["667eea", "48bb78", "ed8936", "e53e3e", "764ba2", "38a169"];

      cardDivs.slice(0, 6).forEach((card, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.5 + col * (cardWidth + 0.3);
        const y = yPos + row * 1.8;
        const accent = cardColors[i % cardColors.length];

        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x, y, w: cardWidth, h: 1.6,
          fill: { color: "F7FAFC" },
          rectRadius: 0.1,
          line: { color: accent, width: 0, dashType: "solid" },
        });

        slide.addShape(pptx.shapes.RECTANGLE, {
          x, y, w: 0.06, h: 1.6,
          fill: { color: accent },
        });

        const lines = card.split("\n").filter(l => l.trim());
        const titleLine = lines[0] || "";
        const bodyLines = lines.slice(1).join("\n");

        slide.addText(titleLine, {
          x: x + 0.15, y: y + 0.1, w: cardWidth - 0.3, h: 0.4,
          fontSize: 13, bold: true, color: "2d3748", valign: "top",
        });

        if (bodyLines) {
          slide.addText(bodyLines, {
            x: x + 0.15, y: y + 0.5, w: cardWidth - 0.3, h: 1.0,
            fontSize: 10, color: "4a5568", valign: "top", wrap: true,
          });
        }
      });
    } else if (listItems.length > 0) {
      const bulletItems = listItems.slice(0, 8).map(item => ({
        text: item,
        options: {
          fontSize: 14,
          color: "2d3748" as string,
          bullet: { code: "2022" },
          spacing: { before: 6, after: 6 },
          paraSpaceBefore: 6,
          paraSpaceAfter: 6,
        },
      }));

      slide.addText(bulletItems, {
        x: 0.8, y: yPos, w: 11.73, h: 4.5 - yPos + 0.5,
        valign: "top",
      });
    } else {
      const remainingHtml = innerHtml
        .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "")
        .replace(/<span[^>]*style="font-size:\s*3em[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "");
      const remainingText = extractTextContent(remainingHtml);

      if (remainingText.length > 5) {
        slide.addText(remainingText, {
          x: 0.8, y: yPos, w: 11.73, h: 5.0 - yPos,
          fontSize: 14, color: textColor, valign: "top", wrap: true,
          lineSpacingMultiple: 1.4,
        });
      }
    }
  }

  const result = await pptx.write({ outputType: "nodebuffer" });
  if (Buffer.isBuffer(result)) {
    return result;
  }
  if (result instanceof ArrayBuffer) {
    return Buffer.from(result);
  }
  if (result instanceof Uint8Array) {
    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  }
  return Buffer.from(result as any);
}
