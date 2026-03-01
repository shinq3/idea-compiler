import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set. Please set it in environment variables.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "o4-mini";

console.log("[openai] Using OPENAI_API_KEY (model: o4-mini)");

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
  const result = JSON.parse(content);
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
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content || '{"items":[]}';
  return JSON.parse(content);
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
    max_completion_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
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
  return JSON.parse(content);
}
