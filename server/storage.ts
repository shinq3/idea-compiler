import { db } from "./db";
import {
  projects, inputs, structuredItems, summaries, documents,
  organizations, users, projectMembers,
  type Project, type InsertProject,
  type Input, type InsertInput,
  type StructuredItem, type InsertStructuredItem,
  type Summary, type InsertSummary,
  type Document, type InsertDocument,
  type Organization, type InsertOrganization,
  type User, type InsertUser,
  type ProjectMember, type InsertProjectMember,
} from "@shared/schema";
import { eq, desc, sql, and, or, inArray } from "drizzle-orm";

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProjectsByOrg(orgId: number): Promise<Project[]>;
  getProjectsForUser(userId: number, role: string, orgId: number | null): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getInputsByProject(projectId: number): Promise<Input[]>;
  getInput(id: number): Promise<Input | undefined>;
  createInput(data: InsertInput): Promise<Input>;
  updateInput(id: number, data: Partial<{ rawText: string; translatedJson: any }>): Promise<void>;
  updateInputTranslation(id: number, translatedJson: any): Promise<void>;

  getStructuredItemsByProject(projectId: number): Promise<StructuredItem[]>;
  createStructuredItem(data: InsertStructuredItem): Promise<StructuredItem>;
  deleteStructuredItemsByInput(inputId: number): Promise<void>;

  getSummariesByProject(projectId: number): Promise<Summary[]>;
  getLatestSummary(projectId: number): Promise<Summary | undefined>;
  createSummary(data: InsertSummary): Promise<Summary>;

  getDocumentsByProject(projectId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(data: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  updateProjectConfidence(projectId: number): Promise<void>;
  incrementMeetingCount(projectId: number): Promise<void>;
  syncMeetingCount(projectId: number): Promise<void>;

  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(data: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, data: Partial<InsertOrganization>): Promise<Organization>;
  deleteOrganization(id: number): Promise<void>;

  getUsers(): Promise<User[]>;
  getUsersByOrg(orgId: number): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  getProjectMembers(projectId: number): Promise<(ProjectMember & { user?: User })[]>;
  addProjectMember(data: InsertProjectMember): Promise<ProjectMember>;
  removeProjectMember(projectId: number, userId: number): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProjectsByOrg(orgId: number): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.organizationId, orgId)).orderBy(desc(projects.updatedAt));
  }

  async getProjectsForUser(userId: number, role: string, orgId: number | null): Promise<Project[]> {
    if (role === "system_admin") {
      return this.getProjects();
    }
    if ((role === "org_admin" || role === "pm") && orgId) {
      return this.getProjectsByOrg(orgId);
    }
    if (role === "member") {
      const memberships = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
      if (memberships.length === 0) return [];
      const projectIds = memberships.map((m) => m.projectId);
      return db.select().from(projects).where(inArray(projects.id, projectIds)).orderBy(desc(projects.updatedAt));
    }
    return [];
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
    return db.select().from(inputs).where(eq(inputs.projectId, projectId)).orderBy(inputs.createdAt);
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

  async updateInput(id: number, data: Partial<{ rawText: string; translatedJson: any }>): Promise<void> {
    await db.update(inputs).set(data).where(eq(inputs.id, id));
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

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
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

  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(organizations.name);
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org;
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async updateOrganization(id: number, data: Partial<InsertOrganization>): Promise<Organization> {
    const [org] = await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
    return org;
  }

  async deleteOrganization(id: number): Promise<void> {
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.displayName);
  }

  async getUsersByOrg(orgId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.organizationId, orgId)).orderBy(users.displayName);
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getProjectMembers(projectId: number): Promise<(ProjectMember & { user?: User })[]> {
    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
    const enriched = await Promise.all(
      members.map(async (m) => {
        const user = await this.getUserById(m.userId);
        return { ...m, user };
      })
    );
    return enriched;
  }

  async addProjectMember(data: InsertProjectMember): Promise<ProjectMember> {
    const existing = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, data.projectId), eq(projectMembers.userId, data.userId)));
    if (existing.length > 0) {
      return existing[0];
    }
    const [member] = await db.insert(projectMembers).values(data).returning();
    return member;
  }

  async removeProjectMember(projectId: number, userId: number): Promise<void> {
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
