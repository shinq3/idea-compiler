import { db } from "./db";
import { projects, inputs } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { translateInputText } from "./openai";

export async function migrateTranslations() {
  console.log("[migrate] Checking for untranslated data...");

  const untranslatedProjects = await db
    .select()
    .from(projects)
    .where(isNull(projects.titleJson));

  if (untranslatedProjects.length > 0) {
    console.log(`[migrate] Found ${untranslatedProjects.length} projects to translate`);
    for (const p of untranslatedProjects) {
      try {
        const titleJson = await translateInputText(p.title);
        let customerNameJson = null;
        if (p.customerName) {
          customerNameJson = await translateInputText(p.customerName);
        }
        await db
          .update(projects)
          .set({ titleJson, customerNameJson })
          .where(eq(projects.id, p.id));
        console.log(`[migrate] Project ${p.id} "${p.title}" translated`);
      } catch (err) {
        console.error(`[migrate] Failed to translate project ${p.id}:`, err);
      }
    }
  }

  const untranslatedInputs = await db
    .select()
    .from(inputs)
    .where(isNull(inputs.translatedJson));

  if (untranslatedInputs.length > 0) {
    console.log(`[migrate] Found ${untranslatedInputs.length} inputs to translate`);
    for (const input of untranslatedInputs) {
      try {
        const translated = await translateInputText(input.rawText);
        await db
          .update(inputs)
          .set({ translatedJson: translated })
          .where(eq(inputs.id, input.id));
        console.log(`[migrate] Input ${input.id} translated`);
      } catch (err) {
        console.error(`[migrate] Failed to translate input ${input.id}:`, err);
      }
    }
  }

  if (untranslatedProjects.length === 0 && untranslatedInputs.length === 0) {
    console.log("[migrate] All data already translated");
  } else {
    console.log("[migrate] Translation migration complete");
  }
}
