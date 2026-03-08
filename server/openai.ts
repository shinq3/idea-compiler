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

INFORMATION DESIGN RULES:
- ALWAYS include at least 2 diagram slides (process flow, architecture, comparison matrix, or similar). This is mandatory.
- Synthesize and restructure the information — do NOT just copy text from the document into slides.
- Extract hidden relationships, dependencies, and logical groupings from the document.
- Convert lists into visual diagrams wherever possible (flows, hierarchies, matrices).
- When the document mentions a process or workflow, create a PROCESS FLOW DIAGRAM.
- When the document compares options or shows before/after, create a COMPARISON MATRIX.
- When the document describes system components, create an ARCHITECTURE DIAGRAM.
- When numbers or percentages are mentioned, create circular/donut METRIC visualizations.

GENERAL RULES:
- Target 12-18 slides total.
- Every slide must use a DIFFERENT layout from its neighbors. Maximum 2 consecutive slides of the same type.
- Use appropriate emoji as visual icons.
- Keep text concise — max 3-4 lines per card. No walls of text.
- Use color palette: primary #667eea, secondary #764ba2, success #48bb78, warning #ed8936, danger #fc8181, dark #1a1a2e/#2d3748, accent #e53e3e.
- Always use inline styles (no external CSS classes).
- Write in the language of the input document.
- Make each slide visually distinct and impactful — this is an executive presentation, not a document dump.`;

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
