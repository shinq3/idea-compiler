import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  customerName: text("customer_name"),
  status: text("status").notNull().default("discovery"),
  owner: text("owner"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  releaseDateTarget: text("release_date_target"),
  budgetConfidence: integer("budget_confidence").notNull().default(0),
  timelineConfidence: integer("timeline_confidence").notNull().default(0),
  requirementConfidence: integer("requirement_confidence").notNull().default(0),
  meetingCount: integer("meeting_count").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const inputs = pgTable("inputs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  source: text("source").notNull(),
  rawText: text("raw_text").notNull(),
  filePath: text("file_path"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const structuredItems = pgTable("structured_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  inputId: integer("input_id").references(() => inputs.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  valueJson: jsonb("value_json").notNull(),
  confidence: real("confidence").default(0.5),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  summaryJson: jsonb("summary_json").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  contentMd: text("content_md").notNull(),
  contentJson: jsonb("content_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  meetingCount: true,
  budgetConfidence: true,
  timelineConfidence: true,
  requirementConfidence: true,
});

export const insertInputSchema = createInsertSchema(inputs).omit({
  id: true,
  createdAt: true,
});

export const insertStructuredItemSchema = createInsertSchema(structuredItems).omit({
  id: true,
  createdAt: true,
});

export const insertSummarySchema = createInsertSchema(summaries).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Input = typeof inputs.$inferSelect;
export type InsertInput = z.infer<typeof insertInputSchema>;
export type StructuredItem = typeof structuredItems.$inferSelect;
export type InsertStructuredItem = z.infer<typeof insertStructuredItemSchema>;
export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Lang = "ja" | "en" | "vi";

export interface SummaryContent {
  overview: string;
  challenges: string;
  objectives: string;
  scope: string;
  featureCandidates: string[];
  budget: string;
  timeline: string;
  risks: string[];
  uncertainItems: string[];
  nextActions: string[];
}

export type MultiLangSummary = Record<Lang, SummaryContent>;

export type SummaryJson = SummaryContent | MultiLangSummary;

export interface MultiLangText {
  ja: string;
  en: string;
  vi: string;
}

export function pickLang<T>(value: T | Record<Lang, T>, locale: string): T {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as any;
    if (obj.ja !== undefined || obj.en !== undefined || obj.vi !== undefined) {
      return obj[locale] ?? obj.en ?? obj.ja ?? obj.vi ?? value as T;
    }
  }
  return value as T;
}
