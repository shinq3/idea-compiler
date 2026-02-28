import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set. Please set it in environment variables.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "o4-mini";

console.log("[openai] Using OPENAI_API_KEY (model: o4-mini)");

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
- "value": an object with "title" (short label) and "description" (detailed text)
- "confidence": number 0-1

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
    max_completion_tokens: 4096,
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
Generate a JSON object with these fields:
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

Use all available information. If the previous summary exists, update it with new information rather than replacing it entirely. Be specific and actionable.
Write in the same language as the input text. If the input is in Japanese, write in Japanese.`,
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
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateDocument(
  type: "kickoff" | "feature_proposal",
  summaryJson: any,
  allInputTexts: string[],
  structuredItems: Array<{ category: string; valueJson: any; inputId: number | null }>
): Promise<string> {
  const systemPrompt =
    type === "kickoff"
      ? `You are a senior consultant generating a kickoff document in Markdown.
Structure:
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

Always cite sources (input number, page reference if available). Be specific and professional.
Write in the same language as the input data.`
      : `You are a senior consultant generating a feature proposal document in Markdown.
Structure:
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

Always cite sources. Be specific and professional.
Write in the same language as the input data.`;

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
    max_completion_tokens: 8192,
  });

  return response.choices[0]?.message?.content || "Document generation failed.";
}
