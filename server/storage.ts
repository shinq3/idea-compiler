import { db } from "./db";
import {
  projects, inputs, structuredItems, summaries, documents,
  type Project, type InsertProject,
  type Input, type InsertInput,
  type StructuredItem, type InsertStructuredItem,
  type Summary, type InsertSummary,
  type Document, type InsertDocument,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getInputsByProject(projectId: number): Promise<Input[]>;
  getInput(id: number): Promise<Input | undefined>;
  createInput(data: InsertInput): Promise<Input>;
  updateInputTranslation(id: number, translatedJson: any): Promise<void>;

  getStructuredItemsByProject(projectId: number): Promise<StructuredItem[]>;
  createStructuredItem(data: InsertStructuredItem): Promise<StructuredItem>;
  deleteStructuredItemsByInput(inputId: number): Promise<void>;

  getSummariesByProject(projectId: number): Promise<Summary[]>;
  getLatestSummary(projectId: number): Promise<Summary | undefined>;
  createSummary(data: InsertSummary): Promise<Summary>;

  getDocumentsByProject(projectId: number): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  updateProjectConfidence(projectId: number): Promise<void>;
  incrementMeetingCount(projectId: number): Promise<void>;
  syncMeetingCount(projectId: number): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getInputsByProject(projectId: number): Promise<Input[]> {
    return db.select().from(inputs).where(eq(inputs.projectId, projectId)).orderBy(desc(inputs.createdAt));
  }

  async getInput(id: number): Promise<Input | undefined> {
    const [input] = await db.select().from(inputs).where(eq(inputs.id, id));
    return input;
  }

  async createInput(data: InsertInput): Promise<Input> {
    const [input] = await db.insert(inputs).values(data).returning();
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, data.projectId));
    return input;
  }

  async updateInputTranslation(id: number, translatedJson: any): Promise<void> {
    await db.update(inputs).set({ translatedJson }).where(eq(inputs.id, id));
  }

  async getStructuredItemsByProject(projectId: number): Promise<StructuredItem[]> {
    return db.select().from(structuredItems).where(eq(structuredItems.projectId, projectId)).orderBy(desc(structuredItems.createdAt));
  }

  async createStructuredItem(data: InsertStructuredItem): Promise<StructuredItem> {
    const [item] = await db.insert(structuredItems).values(data).returning();
    return item;
  }

  async deleteStructuredItemsByInput(inputId: number): Promise<void> {
    await db.delete(structuredItems).where(eq(structuredItems.inputId, inputId));
  }

  async getSummariesByProject(projectId: number): Promise<Summary[]> {
    return db.select().from(summaries).where(eq(summaries.projectId, projectId)).orderBy(desc(summaries.version));
  }

  async getLatestSummary(projectId: number): Promise<Summary | undefined> {
    const [summary] = await db
      .select()
      .from(summaries)
      .where(eq(summaries.projectId, projectId))
      .orderBy(desc(summaries.version))
      .limit(1);
    return summary;
  }

  async createSummary(data: InsertSummary): Promise<Summary> {
    const [summary] = await db.insert(summaries).values(data).returning();
    return summary;
  }

  async getDocumentsByProject(projectId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.createdAt));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async updateProjectConfidence(projectId: number): Promise<void> {
    const items = await this.getStructuredItemsByProject(projectId);

    let budgetConfidence = 0;
    let timelineConfidence = 0;
    let requirementConfidence = 0;

    for (const item of items) {
      switch (item.category) {
        case "budget":
          budgetConfidence = Math.min(100, budgetConfidence + 25);
          break;
        case "timeline":
          timelineConfidence = Math.min(100, timelineConfidence + 25);
          break;
        case "requirement":
        case "decision":
          requirementConfidence = Math.min(100, requirementConfidence + 10);
          break;
        case "constraint":
          requirementConfidence = Math.min(100, requirementConfidence + 5);
          break;
      }
    }

    await db
      .update(projects)
      .set({ budgetConfidence, timelineConfidence, requirementConfidence, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  async incrementMeetingCount(projectId: number): Promise<void> {
    await this.syncMeetingCount(projectId);
  }

  async syncMeetingCount(projectId: number): Promise<void> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inputs)
      .where(sql`${inputs.projectId} = ${projectId} AND ${inputs.type} = 'meeting_note'`);
    const count = result?.count || 0;
    await db
      .update(projects)
      .set({ meetingCount: count, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }
}

export const storage = new DatabaseStorage();
