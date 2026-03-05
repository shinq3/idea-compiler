import { db } from "./db";
import { projects, inputs, users, organizations } from "@shared/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { translateInputText } from "./openai";
import { storage } from "./storage";
import { hashPassword } from "./auth";

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
        const fallback = { ja: input.rawText, en: input.rawText, vi: input.rawText };
        await db
          .update(inputs)
          .set({ translatedJson: fallback })
          .where(eq(inputs.id, input.id));
        console.log(`[migrate] Input ${input.id} saved with fallback (original text)`);
      }
    }
  }

  if (untranslatedProjects.length === 0 && untranslatedInputs.length === 0) {
    console.log("[migrate] All data already translated");
  } else {
    console.log("[migrate] Translation migration complete");
  }

  const allProjects = await db.select().from(projects);
  for (const p of allProjects) {
    await storage.syncMeetingCount(p.id);
  }
  console.log("[migrate] Meeting counts synced");

  await seedDefaultAdmin();
}

async function seedDefaultAdmin() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return;

  console.log("[migrate] Creating default organization and admin user...");

  let [defaultOrg] = await db.select().from(organizations).limit(1);
  if (!defaultOrg) {
    [defaultOrg] = await db.insert(organizations).values({
      name: "Default Organization",
      slug: "default",
    }).returning();
  }

  const passwordHash = await hashPassword("admin123");
  await db.insert(users).values({
    username: "admin",
    email: "admin@casenurture.local",
    passwordHash,
    displayName: "System Admin",
    role: "system_admin",
    organizationId: defaultOrg.id,
  });

  await db.update(projects).set({ organizationId: defaultOrg.id });

  console.log("[migrate] Default admin created (admin / admin123)");
}
