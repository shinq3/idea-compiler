import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set. Please set it in environment variables.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const MODEL = "o4-mini";

console.log("[openai] Using OPENAI_API_KEY (model: o4-mini)");

function safeJsonParse(content: string, fallback: any): any {
  try {
    return JSON.parse(content);
  } catch (e) {
    const repaired = content.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      // no-op
    }

    const lastBrace = content.lastIndexOf("}");
    const lastBracket = content.lastIndexOf("]");
    const cutoff = Math.max(lastBrace, lastBracket);
    if (cutoff > 0) {
      let truncated = content.substring(0, cutoff + 1);
      let openBraces = (truncated.match(/{/g) || []).length;
      let closeBraces = (truncated.match(/}/g) || []).length;
      while (closeBraces < openBraces) {
        truncated += "}";
        closeBraces++;
      }
      let openBrackets = (truncated.match(/\[/g) || []).length;
      let closeBrackets = (truncated.match(/]/g) || []).length;
      while (closeBrackets < openBrackets) {
        truncated += "]";
        closeBrackets++;
      }
      try {
        return JSON.parse(truncated);
      } catch {
        // no-op
      }
    }

    console.error("Failed to parse JSON response, using fallback. First 200 chars:", content.substring(0, 200));
    return fallback;
  }
}

export async function transcribeAudio(filePath: string, fileName: string): Promise<string> {
  const fs = await import("fs");
  const file = fs.createReadStream(filePath);
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: file,
    language: undefined,
  });
  return response.text;
}

export async function translateInputText(text: string): Promise<{ ja: string; en: string; vi: string }> {
  const truncated = text.substring(0, 5000);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a professional translator. Translate the given text to Japanese, English, and Vietnamese. Return a JSON object with keys ja, en, vi. Keep the original text for the language it was written in. Translate naturally and preserve formatting.",
      },
      { role: "user", content: "Translate this text to all three languages (ja, en, vi) as JSON:\n\n" + truncated },
    ],
    response_format: { type: "json_object" },
    max_tokens: 8192,
  });
  const content = response.choices[0]?.message?.content || "{}";
  const result = safeJsonParse(content, {});
  return {
    ja: result.ja || text,
    en: result.en || text,
    vi: result.vi || text,
  };
}

const MULTILANG_INSTRUCTION = `
IMPORTANT: All text output (titles, descriptions, summaries, etc.) MUST be provided in three languages simultaneously.
Use this JSON structure for every text field:
{ "ja": "日本語テキスト", "en": "English text", "vi": "Tiếng Việt text" }

For array fields, each element must also be trilingual:
[{ "ja": "項目1", "en": "Item 1", "vi": "Mục 1" }]
`;

export async function extractStructuredData(text: string): Promise<{
  items: Array<{ category: string; value: any; confidence: number }>;
}> {
  const truncated = text.substring(0, 8000);
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a business analyst. Extract structured information from the provided text.
Return a JSON object with an "items" array. Each item has:
- "category": one of "requirement", "issue", "decision", "constraint", "budget", "timeline", "risk", "term", "action"
- "value": an object with:
  - "title": { "ja": "...", "en": "...", "vi": "..." }
  - "description": { "ja": "...", "en": "...", "vi": "..." }
  - "priority" (optional, for requirements): "must" or "nice_to_have"
  - "type" (optional, for actions): "question"
- "confidence": number 0-1

${MULTILANG_INSTRUCTION}

For RFP/requirements documents, also extract:
- must_requirements as category "requirement" with value.priority = "must"
- nice_to_have as category "requirement" with value.priority = "nice_to_have"
- constraints (technical/operational/contractual/security) as category "constraint"
- budget hints as category "budget"
- timeline hints as category "timeline"
- questions to confirm as category "action" with value.type = "question"

Be thorough but precise. Only extract clearly stated information.`,
      },
      { role: "user", content: truncated },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 16384,
  });

  const content = response.choices[0]?.message?.content || '{"items":[]}';
  const parsed = safeJsonParse(content, { items: [] });
  if (!parsed.items || !Array.isArray(parsed.items)) {
    parsed.items = [];
  }
  return parsed;
}

export async function generateSummary(
  existingSummary: any | null,
  allInputTexts: string[],
  structuredItems: Array<{ category: string; valueJson: any }>
): Promise<any> {
  const itemsByCategory: Record<string, any[]> = {};
  for (const item of structuredItems) {
    if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
    itemsByCategory[item.category].push(item.valueJson);
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a business analyst creating a comprehensive project summary.
Generate a JSON object with this structure:
{
  "ja": { ... summary fields in Japanese ... },
  "en": { ... summary fields in English ... },
  "vi": { ... summary fields in Vietnamese ... }
}

Each language object must contain these fields:
- "overview": string - project overview including customer challenges and objectives
- "challenges": string - current challenges identified
- "objectives": string - project goals
- "scope": string - scope description (in/out)
- "featureCandidates": string[] - list of feature candidates
- "budget": string - budget information
- "timeline": string - timeline/delivery information
- "risks": string[] - identified risks
- "uncertainItems": string[] - items needing confirmation (questions list)
- "nextActions": string[] - recommended next actions

The content should be the same information expressed naturally in each language.
If the previous summary exists, update it with new information rather than replacing it entirely.
Be specific and actionable.`,
      },
      {
        role: "user",
        content: `Previous summary: ${existingSummary ? JSON.stringify(existingSummary) : "None"}

All inputs:
${allInputTexts.map((t, i) => `--- Input ${i + 1} ---\n${t.substring(0, 3000)}`).join("\n\n")}

Structured data by category:
${JSON.stringify(itemsByCategory, null, 2)}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 16384,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return safeJsonParse(content, {});
}

export async function generateDocument(
  type: "kickoff" | "feature_proposal",
  summaryJson: any,
  allInputTexts: string[],
  structuredItems: Array<{ category: string; valueJson: any; inputId: number | null }>
): Promise<{ ja: string; en: string; vi: string }> {
  const systemPrompt =
    type === "kickoff"
      ? `You are a senior consultant generating a kickoff document.
Return a JSON object with three keys: "ja", "en", "vi".
Each value is a full Markdown document in that language.

Structure for each document:
# Kickoff Document

## Background / Objectives
## Current Challenges (with evidence)
## Goals / Deliverables
## Scope (In / Out)
## Team Structure (Roles)
## Milestone Plan
## Key Risks and Mitigations
## Unresolved Items (Questions List)
## Next Actions

Always cite sources (input number, page reference if available). Be specific and professional.`
      : `You are a senior consultant generating a feature proposal document.
Return a JSON object with three keys: "ja", "en", "vi".
Each value is a full Markdown document in that language.

Structure for each document:
# Feature Proposal

## Feature List (Must / Should / Could)
For each feature:
- Purpose
- Target Users
- Evidence (RFP reference / meeting notes / memos)
## Dependencies
## Acceptance Criteria
## Excluded Items
## Unresolved Items (Additional Investigation Needed)

Always cite sources. Be specific and professional.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Project Summary:
${JSON.stringify(summaryJson, null, 2)}

All Inputs:
${allInputTexts.map((t, i) => `--- Input ${i + 1} ---\n${t.substring(0, 3000)}`).join("\n\n")}

Structured Items:
${structuredItems.map((item) => `[${item.category}] (Input #${item.inputId}): ${JSON.stringify(item.valueJson)}`).join("\n")}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 16384,
  });

  const content = response.choices[0]?.message?.content || '{"ja":"","en":"","vi":""}';
  return safeJsonParse(content, { ja: "", en: "", vi: "" });
}

export async function generateSlides(
  documentMarkdown: string,
  documentType: string,
  locale: string
): Promise<string> {
  const systemPrompt = `You are a professional presentation designer. Convert the given document into rich, visually engaging reveal.js HTML slides.

OUTPUT FORMAT:
- Output ONLY <section> elements (no full HTML page, no <html>/<head>/<body>/<script> tags).
- Each slide is a <section> element.
- Do NOT output markdown. Only valid HTML.
- Do NOT wrap output in code fences.

SLIDE DESIGN RULES:

1. TITLE SLIDE (first slide):
   <section data-background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
     <h1 style="color:white;font-size:2.2em;text-shadow:2px 2px 4px rgba(0,0,0,0.3)">Title</h1>
     <h3 style="color:rgba(255,255,255,0.85);font-weight:300">Subtitle / Date</h3>
   </section>

2. SECTION DIVIDER SLIDES (use between major sections):
   <section data-background="linear-gradient(135deg, #2d3748 0%, #4a5568 100%)">
     <h2 style="color:white;font-size:2em">Section Title</h2>
     <p style="color:rgba(255,255,255,0.7)">Brief description</p>
   </section>

3. CONTENT SLIDES with icons (use emoji as visual icons):
   <section>
     <h2>📋 Slide Title</h2>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;text-align:left;margin-top:24px">
       <div style="background:linear-gradient(135deg,#f5f7fa,#c3cfe2);padding:20px;border-radius:12px">
         <h4 style="margin:0 0 8px 0">🎯 Point A</h4>
         <p style="font-size:0.7em;margin:0">Details here</p>
       </div>
       <div style="background:linear-gradient(135deg,#ffecd2,#fcb69f);padding:20px;border-radius:12px">
         <h4 style="margin:0 0 8px 0">💡 Point B</h4>
         <p style="font-size:0.7em;margin:0">Details here</p>
       </div>
     </div>
   </section>

4. BULLET SLIDES (max 5 items, use fragment for animation):
   <section>
     <h2>🔍 Title</h2>
     <ul style="list-style:none;padding:0;margin-top:20px">
       <li class="fragment" style="background:#f0f4ff;margin:8px 0;padding:12px 20px;border-radius:8px;border-left:4px solid #667eea">
         <strong>Key point</strong> — explanation
       </li>
     </ul>
   </section>

5. METRICS / KPI SLIDES (use large numbers):
   <section>
     <h2>📊 Key Metrics</h2>
     <div style="display:flex;justify-content:center;gap:40px;margin-top:32px">
       <div style="text-align:center">
         <div style="font-size:2.5em;font-weight:700;color:#667eea">¥5M</div>
         <div style="font-size:0.7em;color:#718096">Budget</div>
       </div>
       <div style="text-align:center">
         <div style="font-size:2.5em;font-weight:700;color:#48bb78">6 mo</div>
         <div style="font-size:0.7em;color:#718096">Timeline</div>
       </div>
     </div>
   </section>

6. TIMELINE / MILESTONE SLIDES:
   <section>
     <h2>📅 Milestones</h2>
     <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
       <div class="fragment" style="display:flex;align-items:center;gap:16px">
         <div style="width:48px;height:48px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">1</div>
         <div style="text-align:left;background:#f7fafc;padding:12px 20px;border-radius:8px;flex:1">
           <strong>Phase name</strong><br><span style="font-size:0.75em;color:#718096">Description and timeline</span>
         </div>
       </div>
     </div>
   </section>

7. RISK / WARNING SLIDES:
   <section>
     <h2>⚠️ Risks</h2>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px">
       <div class="fragment" style="background:#fff5f5;padding:16px;border-radius:10px;border-left:4px solid #fc8181;text-align:left">
         <strong style="color:#c53030">Risk</strong>
         <p style="font-size:0.7em;margin:6px 0 0 0">Description and mitigation</p>
       </div>
     </div>
   </section>

8. CLOSING SLIDE (last slide):
   <section data-background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
     <h2 style="color:white">Next Steps</h2>
     <div style="color:rgba(255,255,255,0.9);font-size:0.85em;margin-top:20px">
       <p>Action items listed here</p>
     </div>
   </section>

GENERAL RULES:
- Target 10-16 slides total.
- Mix different slide layouts for visual variety. Do NOT use the same layout for every slide.
- Use appropriate emoji as visual icons for headings.
- Keep text concise. No walls of text.
- Use color palette: primary #667eea, success #48bb78, warning #ed8936, danger #fc8181, dark #2d3748.
- Always use inline styles (no external CSS classes).
- Write in the language of the input document.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Convert this ${documentType === "kickoff" ? "Kickoff Document" : "Feature Proposal"} to rich visual reveal.js slides:\n\n${documentMarkdown}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
  return raw.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
}
