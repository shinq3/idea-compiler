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
${allInputTexts.map((t, i) => `--- Input ${i + 1} ---\n${t.substring(0, 8000)}`).join("\n\n")}

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
- Purpose and detailed description (include sub-features, data models, screen requirements where available)
- Target Users
- Evidence (RFP reference / meeting notes / memos / referenced URLs)
## Dependencies
## Acceptance Criteria
## Excluded Items
## Unresolved Items (Additional Investigation Needed)

IMPORTANT: When inputs contain referenced URL content, extract and incorporate ALL detailed information from those pages — feature descriptions, data models, user flows, technical specifications, screen requirements, etc. Do not just summarize at a high level; provide the same granularity as the source material.

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
${allInputTexts.map((t, i) => `--- Input ${i + 1} ---\n${t.substring(0, 8000)}`).join("\n\n")}

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
  const systemPrompt = `You are a world-class presentation architect specializing in executive-level business presentations. Your role is to deeply analyze the document's content, restructure the information for maximum clarity and impact, and produce visually stunning reveal.js HTML slides.

ANALYSIS APPROACH:
1. First, identify the document's core narrative arc (Problem → Solution → Plan → Action).
2. Extract key data points, metrics, and relationships between concepts.
3. Reorganize information into a compelling story flow — do NOT just mirror the document section by section.
4. Identify opportunities for diagrams: flowcharts, process flows, architecture diagrams, comparison matrices, hierarchy charts.

OUTPUT FORMAT:
- Output ONLY <section> elements (no full HTML page, no <html>/<head>/<body>/<script> tags).
- Each slide is a <section> element.
- Do NOT output markdown. Only valid HTML.
- Do NOT wrap output in code fences.

SLIDE TYPES & TEMPLATES:

1. TITLE SLIDE (first slide):
   <section data-background="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)">
     <div style="margin-bottom:24px">
       <span style="font-size:3em">🚀</span>
     </div>
     <h1 style="color:white;font-size:2.4em;text-shadow:2px 2px 8px rgba(0,0,0,0.5);letter-spacing:-0.02em;margin:0">Title</h1>
     <h3 style="color:rgba(255,255,255,0.7);font-weight:300;margin-top:16px">Subtitle</h3>
     <div style="margin-top:40px;display:flex;justify-content:center;gap:24px">
       <div style="background:rgba(255,255,255,0.1);padding:8px 20px;border-radius:20px;color:rgba(255,255,255,0.8);font-size:0.65em;backdrop-filter:blur(4px)">📅 Date</div>
       <div style="background:rgba(255,255,255,0.1);padding:8px 20px;border-radius:20px;color:rgba(255,255,255,0.8);font-size:0.65em;backdrop-filter:blur(4px)">👤 Presenter</div>
     </div>
   </section>

2. EXECUTIVE SUMMARY SLIDE (slide 2 — synthesize the ENTIRE document into one slide):
   <section>
     <h2>📌 エグゼクティブサマリー</h2>
     <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px">
       <div style="background:linear-gradient(180deg,#667eea20,#667eea08);padding:20px;border-radius:14px;border-top:4px solid #667eea;text-align:center">
         <div style="font-size:1.8em;margin-bottom:8px">🎯</div>
         <div style="font-weight:700;font-size:0.85em;margin-bottom:6px">Goal</div>
         <p style="font-size:0.65em;margin:0;color:#4a5568">Concise goal</p>
       </div>
       <!-- repeat for 2 more pillars -->
     </div>
   </section>

3. SECTION DIVIDER SLIDES:
   <section data-background="linear-gradient(135deg, #2d3748 0%, #4a5568 100%)">
     <h2 style="color:white;font-size:2.2em;letter-spacing:-0.01em">Section Title</h2>
     <p style="color:rgba(255,255,255,0.6);font-size:0.8em;max-width:600px;margin:12px auto 0">Brief description</p>
     <div style="width:60px;height:3px;background:#667eea;margin:24px auto 0;border-radius:2px"></div>
   </section>

4. PROCESS FLOW DIAGRAM (use for workflows, pipelines, data flows — horizontal arrow-connected boxes):
   <section>
     <h2>🔄 Process Flow Title</h2>
     <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:32px;flex-wrap:wrap">
       <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:14px 18px;border-radius:12px;text-align:center;min-width:110px">
         <div style="font-size:1.3em;margin-bottom:4px">📥</div>
         <div style="font-size:0.7em;font-weight:600">Step 1</div>
       </div>
       <div style="font-size:1.5em;color:#667eea">→</div>
       <div style="background:linear-gradient(135deg,#48bb78,#38a169);color:white;padding:14px 18px;border-radius:12px;text-align:center;min-width:110px">
         <div style="font-size:1.3em;margin-bottom:4px">⚙️</div>
         <div style="font-size:0.7em;font-weight:600">Step 2</div>
       </div>
       <div style="font-size:1.5em;color:#48bb78">→</div>
       <div style="background:linear-gradient(135deg,#ed8936,#dd6b20);color:white;padding:14px 18px;border-radius:12px;text-align:center;min-width:110px">
         <div style="font-size:1.3em;margin-bottom:4px">📊</div>
         <div style="font-size:0.7em;font-weight:600">Step 3</div>
       </div>
       <div style="font-size:1.5em;color:#ed8936">→</div>
       <div style="background:linear-gradient(135deg,#e53e3e,#c53030);color:white;padding:14px 18px;border-radius:12px;text-align:center;min-width:110px">
         <div style="font-size:1.3em;margin-bottom:4px">✅</div>
         <div style="font-size:0.7em;font-weight:600">Step 4</div>
       </div>
     </div>
     <p style="font-size:0.65em;color:#718096;margin-top:16px;text-align:center">Brief description of the flow</p>
   </section>

5. ARCHITECTURE / SYSTEM DIAGRAM (use for showing system components and their relationships):
   <section>
     <h2>🏗️ Architecture Title</h2>
     <div style="position:relative;margin-top:24px;min-height:320px">
       <!-- Top layer -->
       <div style="display:flex;justify-content:center;gap:12px;margin-bottom:8px">
         <div style="background:#edf2f7;padding:12px 20px;border-radius:10px;border:2px solid #a0aec0;font-size:0.7em;font-weight:600;text-align:center;min-width:120px">
           🖥️ Frontend
         </div>
       </div>
       <!-- Arrow down -->
       <div style="text-align:center;font-size:1.2em;color:#a0aec0;margin:4px 0">⬇️</div>
       <!-- Middle layer -->
       <div style="display:flex;justify-content:center;gap:12px;margin-bottom:8px">
         <div style="background:#ebf8ff;padding:12px 20px;border-radius:10px;border:2px solid #4299e1;font-size:0.7em;font-weight:600;text-align:center;min-width:120px">
           ⚙️ API Layer
         </div>
         <div style="background:#fefcbf;padding:12px 20px;border-radius:10px;border:2px solid #d69e2e;font-size:0.7em;font-weight:600;text-align:center;min-width:120px">
           🧠 AI Engine
         </div>
       </div>
       <!-- Arrow down -->
       <div style="text-align:center;font-size:1.2em;color:#a0aec0;margin:4px 0">⬇️</div>
       <!-- Bottom layer -->
       <div style="display:flex;justify-content:center;gap:12px">
         <div style="background:#f0fff4;padding:12px 20px;border-radius:10px;border:2px solid #48bb78;font-size:0.7em;font-weight:600;text-align:center;min-width:120px">
           💾 Database
         </div>
         <div style="background:#fff5f5;padding:12px 20px;border-radius:10px;border:2px solid #fc8181;font-size:0.7em;font-weight:600;text-align:center;min-width:120px">
           📁 Storage
         </div>
       </div>
     </div>
   </section>

6. COMPARISON MATRIX (use for Before/After, Option A vs B, pros/cons):
   <section>
     <h2>⚖️ Comparison Title</h2>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-top:24px;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
       <div style="background:linear-gradient(135deg,#fed7d7,#feb2b2);padding:24px;text-align:center">
         <h3 style="margin:0 0 12px 0;color:#c53030;font-size:0.9em">❌ Before / Problem</h3>
         <ul style="list-style:none;padding:0;margin:0;text-align:left;font-size:0.7em">
           <li style="margin:6px 0;padding:6px 0;border-bottom:1px solid rgba(197,48,48,0.15)">Problem point 1</li>
         </ul>
       </div>
       <div style="background:linear-gradient(135deg,#c6f6d5,#9ae6b4);padding:24px;text-align:center">
         <h3 style="margin:0 0 12px 0;color:#276749;font-size:0.9em">✅ After / Solution</h3>
         <ul style="list-style:none;padding:0;margin:0;text-align:left;font-size:0.7em">
           <li style="margin:6px 0;padding:6px 0;border-bottom:1px solid rgba(39,103,73,0.15)">Solution point 1</li>
         </ul>
       </div>
     </div>
   </section>

7. CONTENT CARDS (2-column or 3-column grid):
   <section>
     <h2>📋 Title</h2>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;text-align:left;margin-top:24px">
       <div style="background:linear-gradient(135deg,#f5f7fa,#c3cfe2);padding:20px;border-radius:14px;border-left:5px solid #667eea">
         <h4 style="margin:0 0 8px 0;font-size:0.85em">🎯 Point A</h4>
         <p style="font-size:0.68em;margin:0;color:#4a5568">Details</p>
       </div>
     </div>
   </section>

8. METRICS / KPI SLIDE (big numbers with progress-bar-like visuals):
   <section>
     <h2>📊 Key Metrics</h2>
     <div style="display:flex;justify-content:center;gap:32px;margin-top:32px;flex-wrap:wrap">
       <div style="text-align:center;min-width:140px">
         <div style="width:100px;height:100px;border-radius:50%;background:conic-gradient(#667eea 75%, #e2e8f0 0);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
           <div style="width:76px;height:76px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;font-size:1.4em;font-weight:700;color:#667eea">75%</div>
         </div>
         <div style="font-size:0.75em;font-weight:600">Label</div>
       </div>
     </div>
   </section>

9. TIMELINE / ROADMAP (horizontal connected phases):
   <section>
     <h2>📅 Roadmap</h2>
     <div style="display:flex;align-items:flex-start;justify-content:center;gap:0;margin-top:32px;position:relative">
       <div class="fragment" style="text-align:center;flex:1;position:relative">
         <div style="width:44px;height:44px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;margin:0 auto 10px;font-size:0.85em;box-shadow:0 2px 8px rgba(102,126,234,0.4)">1</div>
         <div style="font-size:0.72em;font-weight:600">Phase Name</div>
         <div style="font-size:0.6em;color:#718096;margin-top:4px">Duration</div>
         <div style="position:absolute;top:22px;left:calc(50% + 22px);width:calc(100% - 44px);height:3px;background:linear-gradient(90deg,#667eea,#48bb78)"></div>
       </div>
     </div>
   </section>

10. RISK MATRIX (severity-coded with impact indicators):
    <section>
      <h2>⚠️ Risk Assessment</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px">
        <div class="fragment" style="background:#fff5f5;padding:16px;border-radius:12px;border-left:5px solid #fc8181;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="color:#c53030;font-size:0.8em">Risk Name</strong>
            <span style="background:#fc8181;color:white;padding:2px 10px;border-radius:10px;font-size:0.6em;font-weight:600">HIGH</span>
          </div>
          <p style="font-size:0.65em;margin:0 0 8px 0;color:#4a5568">Description</p>
          <div style="background:rgba(72,187,120,0.1);padding:6px 10px;border-radius:6px;font-size:0.6em;color:#276749">💡 Mitigation: strategy</div>
        </div>
      </div>
    </section>

11. TEAM / STAKEHOLDER SLIDE (role cards):
    <section>
      <h2>👥 Team Structure</h2>
      <div style="display:flex;justify-content:center;gap:16px;margin-top:24px;flex-wrap:wrap">
        <div style="background:white;border:2px solid #e2e8f0;padding:16px;border-radius:14px;text-align:center;min-width:110px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <div style="font-size:2em;margin-bottom:6px">👨‍💼</div>
          <div style="font-size:0.72em;font-weight:700;color:#2d3748">Role Name</div>
          <div style="font-size:0.6em;color:#718096;margin-top:4px">Responsibility</div>
        </div>
      </div>
    </section>

12. CLOSING / NEXT STEPS SLIDE:
    <section data-background="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)">
      <h2 style="color:white;font-size:2em;margin-bottom:24px">🚀 Next Steps</h2>
      <div style="max-width:600px;margin:0 auto">
        <div class="fragment" style="background:rgba(255,255,255,0.08);backdrop-filter:blur(4px);padding:14px 24px;border-radius:12px;margin-bottom:10px;display:flex;align-items:center;gap:16px;border:1px solid rgba(255,255,255,0.1)">
          <div style="width:32px;height:32px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8em;flex-shrink:0">1</div>
          <span style="color:rgba(255,255,255,0.9);font-size:0.8em">Action item</span>
        </div>
      </div>
    </section>

GRAPHIC-FIRST DESIGN PHILOSOPHY:
You are creating a VISUAL presentation, NOT a text document on slides. Follow these principles:
- SHOW, don't tell. Replace text with graphics wherever possible.
- Every slide MUST have a dominant visual element (diagram, chart, icon composition, gauge, matrix, or illustration).
- Text is supporting — use it only for labels, short captions, and key numbers. NO paragraphs. NO bullet lists longer than 3 items.
- If a concept can be drawn as a diagram, it MUST be a diagram.

MANDATORY GRAPHIC ELEMENTS (use at least 5 of these across the presentation):

A. PROGRESS BARS / GAUGES:
   <div style="background:#e2e8f0;border-radius:8px;height:18px;width:100%;overflow:hidden;margin:6px 0">
     <div style="background:linear-gradient(90deg,#667eea,#764ba2);height:100%;width:75%;border-radius:8px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px">
       <span style="color:white;font-size:0.6em;font-weight:700">75%</span>
     </div>
   </div>

B. DONUT CHARTS (for metrics/scores):
   <div style="width:100px;height:100px;border-radius:50%;background:conic-gradient(#667eea 0% 75%, #e2e8f0 75% 100%);display:flex;align-items:center;justify-content:center;margin:0 auto">
     <div style="width:72px;height:72px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;font-size:1.3em;font-weight:700;color:#667eea">75%</div>
   </div>

C. ICON-CENTRIC CARDS (large emoji + minimal text):
   <div style="text-align:center;padding:20px">
     <div style="font-size:3em;margin-bottom:8px">🎯</div>
     <div style="font-weight:700;font-size:0.9em">Label</div>
     <div style="font-size:0.65em;color:#718096;margin-top:4px">One line description</div>
   </div>

D. CONNECTING ARROWS & FLOW LINES (use → ⬇️ ⟶ between elements to show relationships)

E. STACKED BAR / HORIZONTAL BAR CHARTS:
   <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
     <div style="width:80px;font-size:0.65em;text-align:right;font-weight:600">Label</div>
     <div style="flex:1;background:#e2e8f0;border-radius:6px;height:24px;overflow:hidden">
       <div style="background:#667eea;height:100%;width:65%;border-radius:6px"></div>
     </div>
     <div style="width:40px;font-size:0.65em;font-weight:700;color:#667eea">65%</div>
   </div>

F. CONCENTRIC / NESTED CIRCLES (for scope, layers, priorities):
   <div style="display:flex;align-items:center;justify-content:center;margin:20px auto">
     <div style="width:240px;height:240px;border-radius:50%;background:rgba(102,126,234,0.1);border:2px solid #667eea;display:flex;align-items:center;justify-content:center;position:relative">
       <div style="position:absolute;top:8px;font-size:0.6em;color:#667eea;font-weight:600">Outer Layer</div>
       <div style="width:160px;height:160px;border-radius:50%;background:rgba(102,126,234,0.15);border:2px solid #667eea;display:flex;align-items:center;justify-content:center">
         <div style="width:80px;height:80px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-size:0.7em;font-weight:700">Core</div>
       </div>
     </div>
   </div>

G. MATRIX / QUADRANT CHART (for priority, impact/effort, risk assessment):
   <div style="display:grid;grid-template-columns:40px 1fr 1fr;grid-template-rows:auto 1fr 1fr;gap:2px;margin-top:20px;max-width:500px;margin-left:auto;margin-right:auto">
     <div></div>
     <div style="text-align:center;font-size:0.65em;font-weight:600;padding:4px;color:#718096">Low Effort</div>
     <div style="text-align:center;font-size:0.65em;font-weight:600;padding:4px;color:#718096">High Effort</div>
     <div style="writing-mode:vertical-lr;transform:rotate(180deg);text-align:center;font-size:0.65em;font-weight:600;color:#718096">High Impact</div>
     <div style="background:#c6f6d5;padding:14px;border-radius:10px 0 0 0;text-align:center;font-size:0.7em">✅ Quick Wins</div>
     <div style="background:#fefcbf;padding:14px;border-radius:0 10px 0 0;text-align:center;font-size:0.7em">🎯 Strategic</div>
     <div style="writing-mode:vertical-lr;transform:rotate(180deg);text-align:center;font-size:0.65em;font-weight:600;color:#718096">Low Impact</div>
     <div style="background:#fed7d7;padding:14px;border-radius:0 0 0 10px;text-align:center;font-size:0.7em">⚡ Fill-ins</div>
     <div style="background:#e2e8f0;padding:14px;border-radius:0 0 10px 0;text-align:center;font-size:0.7em">❌ Avoid</div>
   </div>

H. TIMELINE WITH VISUAL MILESTONES (horizontal with connecting line):
   <div style="position:relative;margin-top:40px;padding:0 20px">
     <div style="position:absolute;top:20px;left:40px;right:40px;height:4px;background:linear-gradient(90deg,#667eea,#48bb78,#ed8936);border-radius:2px"></div>
     <div style="display:flex;justify-content:space-between;position:relative">
       <div style="text-align:center;z-index:1">
         <div style="width:44px;height:44px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;margin:0 auto;box-shadow:0 2px 8px rgba(102,126,234,0.4)">1</div>
         <div style="font-size:0.7em;font-weight:600;margin-top:10px">Phase 1</div>
         <div style="font-size:0.58em;color:#718096">4 weeks</div>
       </div>
     </div>
   </div>

INFORMATION DESIGN RULES:
- MINIMUM 5 diagram/graphic slides out of the total. Text-only slides are FORBIDDEN.
- Synthesize and restructure the information — do NOT just copy text from the document into slides.
- Extract hidden relationships, dependencies, and logical groupings from the document.
- Convert ALL lists into visual representations (flows, card grids, bar charts, matrices).
- When the document mentions a process or workflow → PROCESS FLOW DIAGRAM with arrows.
- When the document compares options or shows before/after → COMPARISON MATRIX or QUADRANT.
- When the document describes system components → ARCHITECTURE DIAGRAM with layers.
- When numbers, percentages, or scores appear → DONUT CHARTS, PROGRESS BARS, or BAR CHARTS.
- When priorities or categories exist → CONCENTRIC CIRCLES or QUADRANT MATRIX.
- When timelines or phases exist → HORIZONTAL TIMELINE with connected milestone nodes.
- When scope is defined (in/out) → NESTED CIRCLES showing included vs excluded.

GENERAL RULES:
- Target 12-18 slides total.
- Every slide must use a DIFFERENT layout from its neighbors. Maximum 2 consecutive slides of the same type.
- Use large emoji (2-3em) as visual anchors on every slide.
- Keep text concise — max 2-3 short lines per card. ZERO paragraphs.
- Use color palette: primary #667eea, secondary #764ba2, success #48bb78, warning #ed8936, danger #fc8181, dark #1a1a2e/#2d3748, accent #e53e3e.
- Always use inline styles (no external CSS classes).
- Write in the language of the input document.
- This is an executive presentation — every slide must be visually striking and immediately understandable without reading.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Convert this ${documentType === "kickoff" ? "Kickoff Document" : "Feature Proposal"} to rich visual reveal.js slides:\n\n${documentMarkdown}`,
      },
    ],
    max_completion_tokens: 16000,
  });

  const raw = response.choices[0]?.message?.content || "";
  return raw.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
}

export interface PptxSlideData {
  bgColor?: string;
  title?: string;
  subtitle?: string;
  elements: PptxElement[];
}

export type PptxElement =
  | { type: "text"; text: string; x: number; y: number; w: number; h: number; fontSize: number; bold?: boolean; color?: string; align?: "left" | "center" | "right"; valign?: "top" | "middle" | "bottom"; wrap?: boolean }
  | { type: "shape"; shape: "rect" | "roundRect" | "oval"; x: number; y: number; w: number; h: number; fill: string; borderColor?: string; borderWidth?: number; radius?: number; shadow?: boolean }
  | { type: "bullets"; items: string[]; x: number; y: number; w: number; h: number; fontSize: number; color?: string; bulletColor?: string }
  | { type: "progressBar"; x: number; y: number; w: number; h: number; percent: number; barColor: string; bgColor?: string; label?: string; labelColor?: string }
  | { type: "table"; rows: string[][]; x: number; y: number; w: number; headerColor?: string; headerTextColor?: string; rowColors?: string[] };

export async function generatePptxData(documentMarkdown: string, documentType: string, lang: string): Promise<PptxSlideData[]> {
  const systemPrompt = `You are a presentation designer that outputs structured JSON for PowerPoint generation via pptxgenjs.
Given a document, create 12-18 slides as a JSON array. Each slide is an object with:
- bgColor: hex color without # (e.g. "1a1a2e"), optional (default white)
- title: slide title text, optional
- subtitle: smaller text below title, optional
- elements: array of visual elements

Element types:
1. "text": { type:"text", text, x, y, w, h, fontSize, bold?, color?, align?, valign?, wrap? }
2. "shape": { type:"shape", shape:"rect"|"roundRect"|"oval", x, y, w, h, fill (hex no #), borderColor?, borderWidth?, radius?, shadow? }
3. "bullets": { type:"bullets", items:string[], x, y, w, h, fontSize, color?, bulletColor? }
4. "progressBar": { type:"progressBar", x, y, w, h, percent (0-100), barColor (hex no #), bgColor?, label?, labelColor? }
5. "table": { type:"table", rows:string[][] (first row=headers), x, y, w, headerColor?, headerTextColor?, rowColors? }

COORDINATE SYSTEM: Wide layout 13.33" x 7.5". x/y in inches from top-left. Keep content within 0.5-12.83 horizontal, 0.3-7.0 vertical.

COLOR PALETTE (hex without #):
- Primary: 667eea, Secondary: 764ba2, Success: 48bb78, Warning: ed8936, Danger: e53e3e
- Dark backgrounds: 1a1a2e, 16213e, 0f3460
- Text: 2d3748 (dark), 718096 (muted), FFFFFF (on dark bg)
- Light fills: F7FAFC, EDF2F7, E2E8F0

DESIGN RULES:
1. First slide: dark bg (1a1a2e), large centered title, subtitle
2. Last slide: dark bg, "Next Steps" or closing with numbered action items
3. Use shapes as backgrounds for cards — roundRect with shadow=true
4. For metrics: large bold number text + label below, optionally with a colored circle shape behind
5. For progress/KPIs: use progressBar elements with labels
6. For comparisons: side-by-side card groups using shapes + text overlays
7. For timelines: horizontal row of oval shapes connected conceptually, with text labels
8. For lists: use bullets element (max 6 items)
9. Tables for structured data (max 8 rows)
10. Every slide should have visual variety — alternate layouts
11. Use large emoji in text elements as visual anchors (font size 28-36)
12. Keep text SHORT — max 2 lines per text element. No paragraphs.
13. Card layouts: shape (roundRect, fill F7FAFC, shadow true) + text overlay on top
14. Accent bars: thin rect shapes (w:0.06) on left side of cards with accent colors
15. Write in ${lang === "ja" ? "Japanese" : lang === "vi" ? "Vietnamese" : "English"}

SLIDE LAYOUT PATTERNS (use these as templates):

TITLE SLIDE:
{ bgColor:"1a1a2e", title:"Presentation Title", subtitle:"Subtitle text",
  elements:[{type:"text",text:"🚀",x:5.5,y:1.0,w:2,h:1,fontSize:48,align:"center"}] }

METRIC CARDS (3-column):
{ elements:[
  {type:"shape",shape:"roundRect",x:0.5,y:1.8,w:3.8,h:2.5,fill:"F7FAFC",shadow:true,radius:0.12},
  {type:"shape",shape:"rect",x:0.5,y:1.8,w:0.06,h:2.5,fill:"667eea"},
  {type:"text",text:"📊",x:0.7,y:1.9,w:3.4,h:0.6,fontSize:28,align:"center"},
  {type:"text",text:"85%",x:0.7,y:2.5,w:3.4,h:0.6,fontSize:28,bold:true,color:"667eea",align:"center"},
  {type:"text",text:"Metric Label",x:0.7,y:3.1,w:3.4,h:0.5,fontSize:12,color:"718096",align:"center"}
]}

PROGRESS BARS:
{ elements:[
  {type:"progressBar",x:3.5,y:2.0,w:8.0,h:0.3,percent:75,barColor:"667eea",label:"Feature A",labelColor:"2d3748"},
  {type:"progressBar",x:3.5,y:2.8,w:8.0,h:0.3,percent:60,barColor:"48bb78",label:"Feature B",labelColor:"2d3748"}
]}

TABLE:
{ elements:[
  {type:"table",rows:[["Header1","Header2","Header3"],["A","B","C"],["D","E","F"]],x:0.8,y:1.8,w:11.5,headerColor:"667eea",headerTextColor:"FFFFFF"}
]}

Output ONLY valid JSON array. No markdown, no code fences, no explanation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Create PowerPoint slides JSON for this ${documentType === "kickoff" ? "Kickoff Document" : "Feature Proposal"}:\n\n${documentMarkdown}` },
    ],
    max_completion_tokens: 16000,
  });

  const raw = response.choices[0]?.message?.content || "[]";
  const cleaned = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
  const slides = safeJsonParse(cleaned, []);

  if (!Array.isArray(slides) || slides.length === 0) {
    return [{ bgColor: "1a1a2e", title: documentType === "kickoff" ? "Kickoff Document" : "Feature Proposal", subtitle: "Generated presentation", elements: [] }];
  }

  return slides as PptxSlideData[];
}
