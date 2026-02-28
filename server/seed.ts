import { db } from "./db";
import { projects, inputs, structuredItems, summaries } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(projects).limit(1);
  if (existing.length > 0) return;

  const [project1] = await db.insert(projects).values({
    title: "EC Platform Renewal",
    customerName: "Retail Corp",
    status: "proposal",
    owner: "Tanaka",
    budgetMin: 5000000,
    budgetMax: 10000000,
    releaseDateTarget: "2026-09-01",
    budgetConfidence: 50,
    timelineConfidence: 75,
    requirementConfidence: 60,
    meetingCount: 3,
  }).returning();

  const [project2] = await db.insert(projects).values({
    title: "Internal HR System",
    customerName: "Global Finance Inc.",
    status: "discovery",
    owner: "Suzuki",
    budgetMin: 2000000,
    budgetMax: 4000000,
    releaseDateTarget: "2026-12-01",
    budgetConfidence: 25,
    timelineConfidence: 50,
    requirementConfidence: 30,
    meetingCount: 1,
  }).returning();

  const [project3] = await db.insert(projects).values({
    title: "Mobile App MVP",
    customerName: "StartupXYZ",
    status: "negotiation",
    owner: "Yamada",
    budgetMin: 1000000,
    budgetMax: 2000000,
    releaseDateTarget: "2026-06-15",
    budgetConfidence: 75,
    timelineConfidence: 50,
    requirementConfidence: 80,
    meetingCount: 5,
  }).returning();

  await db.insert(inputs).values([
    {
      projectId: project1.id,
      type: "meeting_note",
      source: "manual",
      rawText: "First meeting with Retail Corp. They want to modernize their e-commerce platform. Current system is outdated and slow. Need mobile responsiveness, better search, and improved checkout flow. Budget around 5-10M yen. Timeline: launch by September 2026.",
    },
    {
      projectId: project1.id,
      type: "text",
      source: "manual",
      rawText: "Additional requirements from stakeholder: Need integration with existing inventory management system. Must support multiple payment methods including QR code payments. SEO optimization is critical for the business.",
    },
  ]);

  await db.insert(structuredItems).values([
    { projectId: project1.id, category: "requirement", valueJson: { title: "Mobile responsive design", description: "Platform must be fully responsive across all devices", priority: "must" }, confidence: 0.9 },
    { projectId: project1.id, category: "requirement", valueJson: { title: "Improved search functionality", description: "Advanced search with filters and auto-suggest", priority: "must" }, confidence: 0.85 },
    { projectId: project1.id, category: "requirement", valueJson: { title: "Checkout flow optimization", description: "Streamlined checkout with fewer steps", priority: "must" }, confidence: 0.9 },
    { projectId: project1.id, category: "budget", valueJson: { title: "Project budget", description: "5-10 million yen range" }, confidence: 0.7 },
    { projectId: project1.id, category: "timeline", valueJson: { title: "Launch date", description: "Target launch by September 2026" }, confidence: 0.8 },
    { projectId: project1.id, category: "constraint", valueJson: { title: "Legacy system integration", description: "Must integrate with existing inventory management system" }, confidence: 0.8 },
    { projectId: project1.id, category: "risk", valueJson: { title: "Legacy system complexity", description: "Integration with legacy inventory system may be complex" }, confidence: 0.6 },
  ]);

  await db.insert(summaries).values({
    projectId: project1.id,
    version: 1,
    summaryJson: {
      overview: "Retail Corp seeks to modernize their e-commerce platform to improve user experience and business performance. The current system suffers from slow performance and lacks mobile responsiveness.",
      challenges: "Legacy e-commerce platform with poor mobile experience, slow search, and complex checkout process. Integration with existing inventory management is a key technical challenge.",
      objectives: "Launch a modern, fast, mobile-responsive e-commerce platform with improved search, streamlined checkout, and seamless inventory integration.",
      scope: "In-scope: Frontend redesign, search enhancement, checkout optimization, payment integration (including QR codes), inventory system integration, SEO optimization. Out-of-scope: Warehouse management, logistics system changes.",
      featureCandidates: [
        "Responsive web design",
        "Advanced search with auto-suggest",
        "Streamlined checkout flow",
        "QR code payment support",
        "Inventory management integration",
        "SEO optimization toolkit",
      ],
      budget: "5-10 million yen range (tentative)",
      timeline: "Target launch: September 2026",
      risks: [
        "Legacy inventory system integration complexity",
        "Tight timeline given scope of requirements",
      ],
      uncertainItems: [
        "Specific payment providers to support",
        "Data migration strategy from old platform",
        "Performance benchmarks and SLAs",
      ],
      nextActions: [
        "Schedule technical deep-dive on inventory system",
        "Define payment provider requirements",
        "Create detailed project timeline with milestones",
      ],
    },
  });

  await db.insert(inputs).values({
    projectId: project2.id,
    type: "text",
    source: "manual",
    rawText: "Global Finance Inc. needs a new internal HR system. Current system is Excel-based. Need employee management, attendance tracking, leave management, and basic payroll integration. They want to start with core features and expand gradually.",
  });

  await db.insert(structuredItems).values([
    { projectId: project2.id, category: "requirement", valueJson: { title: "Employee management", description: "Basic employee data management and profiles", priority: "must" }, confidence: 0.85 },
    { projectId: project2.id, category: "requirement", valueJson: { title: "Attendance tracking", description: "Daily attendance recording and reporting", priority: "must" }, confidence: 0.8 },
    { projectId: project2.id, category: "constraint", valueJson: { title: "Gradual rollout", description: "Must support phased deployment" }, confidence: 0.7 },
  ]);

  await db.insert(summaries).values({
    projectId: project2.id,
    version: 1,
    summaryJson: {
      overview: "Global Finance Inc. wants to replace their Excel-based HR processes with a modern web application. The initial phase focuses on core HR functions.",
      challenges: "All HR processes currently managed via Excel spreadsheets, leading to data inconsistencies and manual effort.",
      objectives: "Implement a centralized HR system starting with employee management and attendance tracking.",
      scope: "Phase 1: Employee management, attendance, leave management. Phase 2: Payroll integration, reporting.",
      featureCandidates: ["Employee profiles", "Attendance tracking", "Leave management", "Payroll integration (Phase 2)"],
      budget: "2-4 million yen range",
      timeline: "Target completion: December 2026",
      risks: ["Data migration from Excel", "User adoption resistance"],
      uncertainItems: ["Payroll system details", "Number of employees", "Compliance requirements"],
      nextActions: ["Gather detailed requirements for attendance workflow", "Assess Excel data quality for migration"],
    },
  });

  console.log("Seed data inserted successfully");
}
