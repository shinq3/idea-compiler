import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { PDFParse, VerbosityLevel } from "pdf-parse";
import { storage } from "./storage";
import { db } from "./db";
import { documents as documentsTable } from "@shared/schema";
import { extractStructuredData, generateSummary, generateDocument, generateSlides, generatePptxData, transcribeAudio, translateInputText } from "./openai";
import { requireAuth, requireRole, requireProjectAccess, hashPassword, verifyPassword, generateToken } from "./auth";
import { generatePptxFromData } from "./pptx";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const docsOutputDir = path.resolve("documents");
if (!fs.existsSync(docsOutputDir)) {
  fs.mkdirSync(docsOutputDir, { recursive: true });
}

function buildRevealHtml(slidesHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/white.min.css">
<style>
  body { margin: 0; }
  .reveal { font-family: 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif; }
  .reveal h1, .reveal h2, .reveal h3, .reveal h4 { font-family: inherit; }
  .reveal section { padding: 20px 40px; }
</style>
</head>
<body>
<div class="reveal">
  <div class="slides">
    ${slidesHtml}
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.min.js"></script>
<script>
  Reveal.initialize({
    hash: true, transition: 'slide', width: 960, height: 700, margin: 0.04,
    slideNumber: true, controls: true, progress: true, center: true
  });
</script>
</body>
</html>`;
}

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];
const ALLOWED_AUDIO_EXTENSIONS = [".webm", ".mp4", ".m4a", ".wav", ".mp3", ".ogg"];
const VALID_STATUSES = ["discovery", "proposal", "negotiation", "won", "lost"];
const VALID_INPUT_TYPES = ["text", "meeting_note", "rfp_pdf", "file"];
const VALID_ROLES = ["system_admin", "org_admin", "pm", "member"];

const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  customerName: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  organizationId: z.coerce.number().int().nullable().optional(),
  budgetMin: z.coerce.number().int().nonnegative().nullable().optional(),
  budgetMax: z.coerce.number().int().nonnegative().nullable().optional(),
  releaseDateTarget: z.string().nullable().optional(),
  status: z.enum(["discovery", "proposal", "negotiation", "won", "lost"]).default("discovery"),
});

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  customerName: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  organizationId: z.coerce.number().int().nullable().optional(),
  budgetMin: z.coerce.number().int().nonnegative().nullable().optional(),
  budgetMax: z.coerce.number().int().nonnegative().nullable().optional(),
  releaseDateTarget: z.string().nullable().optional(),
  status: z.enum(["discovery", "proposal", "negotiation", "won", "lost"]).optional(),
});

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

const registerUserSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(4),
  displayName: z.string().min(1),
  role: z.enum(["system_admin", "org_admin", "pm", "member"]).default("member"),
  organizationId: z.coerce.number().int().nullable().optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(4).optional(),
  role: z.enum(["system_admin", "org_admin", "pm", "member"]).optional(),
  organizationId: z.coerce.number().int().nullable().optional(),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`));
    }
  },
});

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "audio-" + unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${ext}. Allowed: ${ALLOWED_AUDIO_EXTENSIONS.join(", ")}`));
    }
  },
});

function stripPassword(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  (async () => {
    try {
      const allDocs = await db.select().from(documentsTable);
      for (const doc of allDocs) {
        const fileBase = `doc-${doc.id}-${doc.type}`;
        const cj = doc.contentJson as any;
        if (cj && typeof cj === "object") {
          for (const lang of ["ja", "en", "vi"]) {
            const md = cj[lang];
            if (md) {
              const mdPath = path.join(docsOutputDir, `${fileBase}-${lang}.md`);
              if (!fs.existsSync(mdPath)) {
                fs.writeFileSync(mdPath, md, "utf-8");
              }
            }
          }
        }
        if (doc.slidesHtml) {
          const htmlPath = path.join(docsOutputDir, `${fileBase}.html`);
          if (!fs.existsSync(htmlPath)) {
            const title = doc.type === "kickoff" ? "Kickoff Document" : "Feature Proposal";
            fs.writeFileSync(htmlPath, buildRevealHtml(doc.slidesHtml, title), "utf-8");
          }
          
        }
      }
      const count = fs.readdirSync(docsOutputDir).length;
      if (count > 0) console.log(`[docs] Restored ${count} files to documents/ folder`);
    } catch (e: any) {
      console.error("[docs] File restoration error:", e.message);
    }
  })();

  // ===== DEMO / LANDING PAGE API (public, no auth) =====

  async function getOrCreateDemoOrg(): Promise<number> {
    let org = await storage.getOrganizationBySlug("demo-lp");
    if (!org) {
      org = await storage.createOrganization({ name: "LP Demo", slug: "demo-lp" });
    }
    return org.id;
  }

  async function getOrCreateDemoUser(orgId: number): Promise<number> {
    let user = await storage.getUserByUsername("demo_visitor");
    if (!user) {
      const hash = await hashPassword("demo_no_login");
      user = await storage.createUser({
        username: "demo_visitor",
        email: "demo@ideacompiler.local",
        passwordHash: hash,
        displayName: "LP Demo Visitor",
        role: "member",
        organizationId: orgId,
      });
    }
    return user.id;
  }

  app.post("/api/demo/analyze", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 10) {
        return res.status(400).json({ message: "Please provide at least 10 characters of text." });
      }
      const truncated = text.substring(0, 8000);
      const structured = await extractStructuredData(truncated);
      const summaryJson = await generateSummary(
        null,
        [truncated],
        structured.items.map((item) => ({ category: item.category, valueJson: item.value }))
      );
      let budgetMin: number | null = null;
      let budgetMax: number | null = null;
      let releaseDateTarget: string | null = null;
      for (const item of structured.items) {
        if (item.category === "budget" && item.value) {
          const desc = JSON.stringify(item.value);
          const nums = desc.match(/[\d,]+万|[\d,]+億|[\d,]+千万|[\d,]+百万|\d[\d,]*(?:\.\d+)?/g);
          if (nums) {
            const parsed = nums.map((n: string) => {
              let val = parseFloat(n.replace(/,/g, ""));
              if (n.includes("億")) val *= 100000000;
              else if (n.includes("千万")) val *= 10000000;
              else if (n.includes("百万")) val *= 1000000;
              else if (n.includes("万")) val *= 10000;
              return val;
            }).filter((v: number) => v > 0).sort((a: number, b: number) => a - b);
            if (parsed.length >= 2) {
              budgetMin = Math.round(parsed[0]);
              budgetMax = Math.round(parsed[parsed.length - 1]);
            } else if (parsed.length === 1) {
              budgetMin = Math.round(parsed[0]);
            }
          }
        }
        if (item.category === "timeline" && item.value) {
          const desc = JSON.stringify(item.value);
          const dateMatch = desc.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})?/);
          if (dateMatch) {
            releaseDateTarget = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${(dateMatch[3] || "01").padStart(2, "0")}`;
          }
        }
      }

      try {
        const demoOrgId = await getOrCreateDemoOrg();
        const demoUserId = await getOrCreateDemoUser(demoOrgId);
        const ts = new Date().toISOString().replace(/[T:]/g, "-").slice(0, 19);
        const project = await storage.createProject({
          title: `LP Demo ${ts}`,
          customerName: "LP Visitor",
          owner: "demo_visitor",
          organizationId: demoOrgId,
          status: "discovery",
          budgetMin,
          budgetMax,
          releaseDateTarget,
        });
        const input = await storage.createInput({
          projectId: project.id,
          type: "text",
          source: "lp_demo",
          rawText: truncated,
        });
        for (const item of structured.items) {
          await storage.createStructuredItem({
            projectId: project.id,
            inputId: input.id,
            category: item.category,
            valueJson: item.value,
            confidence: item.confidence ?? 0.5,
          });
        }
        const existingSummaries = await storage.getSummaries(project.id);
        await storage.createSummary({
          projectId: project.id,
          version: existingSummaries.length + 1,
          summaryJson,
        });
        console.log(`[demo] Saved LP demo as project #${project.id} (org: demo-lp)`);
      } catch (saveErr: any) {
        console.error("[demo] Failed to save demo log:", saveErr.message);
      }

      res.json({
        summary: summaryJson,
        structuredItems: structured.items.slice(0, 20),
        extracted: { budgetMin, budgetMax, releaseDateTarget },
      });
    } catch (error: any) {
      console.error("Demo analyze error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/demo/transcribe", audioUpload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      const text = await transcribeAudio(req.file.path, req.file.originalname);
      try { fs.unlinkSync(req.file.path); } catch {}
      res.json({ text });
    } catch (error: any) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      res.status(500).json({ message: error.message });
    }
  });

  // ===== AUTH ROUTES (public) =====

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Login and password are required" });
      }

      const { login, password } = parsed.data;
      let user = await storage.getUserByUsername(login);
      if (!user) {
        user = await storage.getUserByEmail(login);
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user);
      res.json({ token, user: stripPassword(user) });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(stripPassword(user));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const data: any = {};
      if (req.body.displayName) data.displayName = req.body.displayName;
      if (req.body.email) data.email = req.body.email;
      if (req.body.password) data.passwordHash = await hashPassword(req.body.password);
      const user = await storage.updateUser(req.user!.id, data);
      res.json(stripPassword(user));
    } catch (error: any) {
      if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
        return res.status(409).json({ message: "Email is already in use" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // ===== ORGANIZATION ROUTES =====

  app.get("/api/organizations", requireAuth, async (_req, res) => {
    try {
      const orgs = await storage.getOrganizations();
      res.json(orgs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/organizations", requireAuth, requireRole("system_admin"), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) {
        slug = "org-" + Date.now().toString(36);
      }
      const existingOrg = await storage.getOrganizationBySlug(slug);
      if (existingOrg) {
        slug = slug + "-" + Date.now().toString(36);
      }
      const org = await storage.createOrganization({ name, slug });
      res.status(201).json(org);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/organizations/:id", requireAuth, async (req, res) => {
    try {
      const orgId = Number(req.params.id);
      if (req.user!.role !== "system_admin" && !(req.user!.role === "org_admin" && req.user!.organizationId === orgId)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const org = await storage.updateOrganization(orgId, { name });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/organizations/:id", requireAuth, requireRole("system_admin"), async (req, res) => {
    try {
      await storage.deleteOrganization(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== USER MANAGEMENT ROUTES =====

  app.get("/api/users", requireAuth, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      let userList;
      if (req.user!.role === "system_admin") {
        userList = await storage.getUsers();
      } else {
        if (!req.user!.organizationId) return res.json([]);
        userList = await storage.getUsersByOrg(req.user!.organizationId);
      }
      res.json(userList.map(stripPassword));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", requireAuth, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      const parsed = registerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }

      const { username, email, password, displayName, role, organizationId } = parsed.data;

      if (req.user!.role === "org_admin") {
        if (role === "system_admin" || role === "org_admin") {
          return res.status(403).json({ message: "Cannot create users with this role" });
        }
      }
      if (req.user!.role === "pm") {
        if (role !== "member") {
          return res.status(403).json({ message: "PM can only create member users" });
        }
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists" });
      }

      const passwordHash = await hashPassword(password);
      const resolvedOrgId = req.user!.role === "system_admin"
        ? (organizationId ?? null)
        : req.user!.organizationId;

      const user = await storage.createUser({
        username,
        email,
        passwordHash,
        displayName,
        role,
        organizationId: resolvedOrgId,
      });

      res.status(201).json(stripPassword(user));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireRole("system_admin", "org_admin"), async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const targetUser = await storage.getUserById(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (req.user!.role === "org_admin") {
        if (targetUser.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ message: "Cannot edit users outside your organization" });
        }
        if (req.body.role === "system_admin" || req.body.role === "org_admin") {
          return res.status(403).json({ message: "Cannot assign this role" });
        }
      }

      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }

      const data: any = {};
      if (parsed.data.displayName) data.displayName = parsed.data.displayName;
      if (parsed.data.email) data.email = parsed.data.email;
      if (parsed.data.role) data.role = parsed.data.role;
      if (parsed.data.organizationId !== undefined) data.organizationId = parsed.data.organizationId;
      if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

      const user = await storage.updateUser(targetId, data);
      res.json(stripPassword(user));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireRole("system_admin", "org_admin"), async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (targetId === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }

      const targetUser = await storage.getUserById(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (req.user!.role === "org_admin") {
        if (targetUser.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ message: "Cannot delete users outside your organization" });
        }
        if (targetUser.role === "system_admin" || targetUser.role === "org_admin") {
          return res.status(403).json({ message: "Cannot delete users with this role" });
        }
      }

      await storage.deleteUser(targetId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== PROJECT ROUTES (protected) =====

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjectsForUser(
        req.user!.id,
        req.user!.role,
        req.user!.organizationId
      );
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ message: "Not found" });
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects", requireAuth, requireRole("system_admin", "org_admin", "pm"), upload.single("rfpFile"), async (req, res) => {
    try {
      const parsed = createProjectSchema.safeParse({
        title: req.body.title,
        customerName: req.body.customerName || null,
        owner: req.body.owner || null,
        organizationId: req.body.organizationId || null,
        budgetMin: req.body.budgetMin || null,
        budgetMax: req.body.budgetMax || null,
        releaseDateTarget: req.body.releaseDateTarget || null,
      });

      if (!parsed.success) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }

      const orgId = req.user!.role === "system_admin"
        ? (parsed.data.organizationId ?? req.user!.organizationId)
        : req.user!.organizationId;

      const project = await storage.createProject({ ...parsed.data, organizationId: orgId });

      translateProjectFields(project.id, parsed.data.title, parsed.data.customerName || null).catch((err) => {
        console.error("Error translating project fields:", err);
      });

      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        let rawText = "";
        let inputType = "file";

        if (ext === ".pdf") {
          inputType = "rfp_pdf";
          try {
            const dataBuffer = fs.readFileSync(req.file.path);
            const parser = new PDFParse({ data: new Uint8Array(dataBuffer), verbosity: VerbosityLevel.ERRORS });
            await parser.load();
            const result = await parser.getText();
            rawText = typeof result === "string" ? result : result?.text || "";
            await parser.destroy();
            if (!rawText.trim()) {
              rawText = "[PDF text extraction failed - this may be a scanned PDF requiring OCR (Phase 2)]";
            }
          } catch (err: any) {
            console.error("[PDF parse error]", err?.message || err);
            rawText = "[PDF text extraction failed - unsupported format]";
          }
        } else if ([".txt", ".md"].includes(ext)) {
          rawText = fs.readFileSync(req.file.path, "utf-8");
        } else {
          rawText = `[Unsupported file format: ${ext}]`;
        }

        const input = await storage.createInput({
          projectId: project.id,
          type: inputType,
          source: "file",
          rawText,
          filePath: req.file.path,
          fileName: req.file.originalname,
        });

        if (rawText && !rawText.startsWith("[")) {
          processInputText(project.id, input.id, rawText).catch((err) => {
            console.error("Error processing RFP:", err);
          });
        }
      }

      const updatedProject = await storage.getProject(project.id);
      res.status(201).json(updatedProject);
    } catch (error: any) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      if (req.user!.role === "member") {
        return res.status(403).json({ message: "Members cannot edit project settings" });
      }

      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }

      if (parsed.data.organizationId !== undefined && req.user!.role !== "system_admin") {
        delete (parsed.data as any).organizationId;
      }

      const project = await storage.updateProject(Number(req.params.id), parsed.data);

      if (parsed.data.title || parsed.data.customerName) {
        translateProjectFields(
          project.id,
          parsed.data.title || project.title,
          parsed.data.customerName !== undefined ? parsed.data.customerName : project.customerName
        ).catch((err) => {
          console.error("Error translating project fields:", err);
        });
      }

      res.json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, requireProjectAccess, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const projectInputs = await storage.getInputsByProject(projectId);
      for (const input of projectInputs) {
        if (input.filePath) {
          try { fs.unlinkSync(input.filePath); } catch {}
        }
      }
      await storage.deleteProject(projectId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== PROJECT MEMBER ROUTES =====

  app.get("/api/projects/:id/members", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const members = await storage.getProjectMembers(Number(req.params.id));
      res.json(members.map((m) => ({
        ...m,
        user: m.user ? stripPassword(m.user) : undefined,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/members", requireAuth, requireProjectAccess, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      const { userId, role } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const validMemberRoles = ["viewer", "editor"];
      const memberRole = validMemberRoles.includes(role) ? role : "viewer";

      const targetUser = await storage.getUserById(Number(userId));
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (req.user!.role !== "system_admin") {
        if (targetUser.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ message: "Cannot add users from a different organization" });
        }
      }

      const member = await storage.addProjectMember({
        projectId: Number(req.params.id),
        userId: Number(userId),
        role: memberRole,
      });
      res.status(201).json(member);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:id/members/:userId", requireAuth, requireProjectAccess, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      await storage.removeProjectMember(Number(req.params.id), Number(req.params.userId));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== INPUT ROUTES (protected) =====

  app.get("/api/projects/:id/inputs", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const inputs = await storage.getInputsByProject(Number(req.params.id));
      res.json(inputs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const processingStatus = new Map<string, { status: "processing" | "done" | "error"; message?: string }>();

  app.post("/api/projects/:id/inputs", requireAuth, requireProjectAccess, upload.single("file"), async (req, res) => {
    try {
      const projectId = Number(req.params.id);

      const project = await storage.getProject(projectId);
      if (!project) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Project not found" });
      }

      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        let rawText = "";
        let inputType = "file";

        if (ext === ".pdf") {
          inputType = "rfp_pdf";
          try {
            const dataBuffer = fs.readFileSync(req.file.path);
            const parser = new PDFParse({ data: new Uint8Array(dataBuffer), verbosity: VerbosityLevel.ERRORS });
            await parser.load();
            const result = await parser.getText();
            rawText = typeof result === "string" ? result : result?.text || "";
            await parser.destroy();
            if (!rawText.trim()) {
              rawText = "[PDF text extraction failed - this may be a scanned PDF requiring OCR (Phase 2)]";
            }
          } catch (err: any) {
            console.error("[PDF parse error]", err?.message || err);
            rawText = "[PDF text extraction failed - unsupported format]";
          }
        } else if ([".txt", ".md"].includes(ext)) {
          rawText = fs.readFileSync(req.file.path, "utf-8");
        } else {
          rawText = `[Unsupported file format: ${ext}]`;
        }

        const input = await storage.createInput({
          projectId,
          type: inputType,
          source: "file",
          rawText,
          filePath: req.file.path,
          fileName: req.file.originalname,
        });

        const taskKey = `${projectId}-${input.id}`;
        processingStatus.set(taskKey, { status: "processing" });

        if (rawText && !rawText.startsWith("[")) {
          processInputText(projectId, input.id, rawText)
            .then(() => { processingStatus.set(taskKey, { status: "done" }); })
            .catch((err) => { processingStatus.set(taskKey, { status: "error", message: err.message }); });
        } else {
          processingStatus.set(taskKey, { status: "done" });
        }

        res.status(201).json({ ...input, taskKey });
      } else if (req.body.rawText && typeof req.body.rawText === "string" && req.body.rawText.trim()) {
        const inputType = VALID_INPUT_TYPES.includes(req.body.type) ? req.body.type : "text";

        if (inputType === "meeting_note") {
          await storage.incrementMeetingCount(projectId);
        }

        const input = await storage.createInput({
          projectId,
          type: inputType,
          source: "manual",
          rawText: req.body.rawText.trim(),
        });

        const taskKey = `${projectId}-${input.id}`;
        processingStatus.set(taskKey, { status: "processing" });

        processInputText(projectId, input.id, input.rawText)
          .then(() => { processingStatus.set(taskKey, { status: "done" }); })
          .catch((err) => { processingStatus.set(taskKey, { status: "error", message: err.message }); });

        res.status(201).json({ ...input, taskKey });
      } else {
        res.status(400).json({ message: "No text or file provided" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id/inputs/:inputId", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const inputId = Number(req.params.inputId);
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        return res.status(400).json({ message: "rawText is required" });
      }
      const input = await storage.getInput(inputId);
      if (!input || input.projectId !== projectId) {
        return res.status(404).json({ message: "Input not found" });
      }
      await storage.deleteStructuredItemsByInput(inputId);
      await storage.updateInput(inputId, { rawText: rawText.trim(), translatedJson: null });
      processInputText(projectId, inputId, rawText.trim()).catch((err) => {
        console.error(`Error reprocessing edited input ${inputId}:`, err);
      });
      const updated = await storage.getInput(inputId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:id/inputs/:inputId", requireAuth, requireProjectAccess, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const inputId = Number(req.params.inputId);
      const input = await storage.getInput(inputId);
      if (!input || input.projectId !== projectId) {
        return res.status(404).json({ message: "Input not found" });
      }
      if (input.filePath) {
        try { fs.unlinkSync(input.filePath); } catch {}
      }
      await storage.deleteStructuredItemsByInput(inputId);
      await storage.deleteInput(inputId);
      if (input.type === "meeting_note") {
        const project = await storage.getProject(projectId);
        if (project && project.meetingCount > 0) {
          await storage.updateProject(projectId, { meetingCount: project.meetingCount - 1 });
        }
      }
      await storage.updateProjectConfidence(projectId);
      const allInputs = await storage.getInputsByProject(projectId);
      const allItems = await storage.getStructuredItemsByProject(projectId);
      if (allInputs.length > 0) {
        const existingSummary = await storage.getLatestSummary(projectId);
        const combinedText = allInputs.map((i) => i.rawText).join("\n\n---\n\n");
        const { generateSummary } = await import("./openai.js");
        const summaryJson = await generateSummary(combinedText, allItems, existingSummary?.summaryJson || null);
        const version = existingSummary ? existingSummary.version + 1 : 1;
        await storage.createSummary({ projectId, version, summaryJson });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/transcribe", requireAuth, audioUpload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      const text = await transcribeAudio(req.file.path, req.file.originalname);
      try { fs.unlinkSync(req.file.path); } catch {}
      res.json({ text });
    } catch (error: any) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/processing-status/:taskKey", requireAuth, (req, res) => {
    const status = processingStatus.get(req.params.taskKey);
    if (!status) return res.json({ status: "unknown" });
    res.json(status);
    if (status.status === "done" || status.status === "error") {
      setTimeout(() => processingStatus.delete(req.params.taskKey), 60000);
    }
  });

  app.get("/api/projects/:id/structured-items", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const items = await storage.getStructuredItemsByProject(Number(req.params.id));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/summaries", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const sums = await storage.getSummariesByProject(Number(req.params.id));
      res.json(sums);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/summary/latest", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const summary = await storage.getLatestSummary(Number(req.params.id));
      res.json(summary || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/documents", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      const docs = await storage.getDocumentsByProject(Number(req.params.id));
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/documents/generate", requireAuth, requireProjectAccess, async (req, res) => {
    try {
      if (req.user!.role === "member") {
        return res.status(403).json({ message: "Members cannot generate documents" });
      }

      const projectId = Number(req.params.id);
      const { type } = req.body;

      if (!type || !["kickoff", "feature_proposal"].includes(type)) {
        return res.status(400).json({ message: "Invalid document type. Use 'kickoff' or 'feature_proposal'." });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const summary = await storage.getLatestSummary(projectId);
      if (!summary) {
        return res.status(400).json({ message: "No summary available. Add inputs first." });
      }

      const allInputs = await storage.getInputsByProject(projectId);
      const allItems = await storage.getStructuredItemsByProject(projectId);

      const contentJson = await generateDocument(
        type as "kickoff" | "feature_proposal",
        summary.summaryJson,
        allInputs.map((i) => i.rawText),
        allItems.map((item) => ({
          category: item.category,
          valueJson: item.valueJson,
          inputId: item.inputId,
        }))
      );

      const doc = await storage.createDocument({
        projectId,
        type,
        contentMd: contentJson.ja || contentJson.en || "",
        contentJson,
      });

      const fileBase = `doc-${doc.id}-${type}`;
      const langs = ["ja", "en", "vi"] as const;
      for (const lang of langs) {
        const md = (contentJson as any)[lang];
        if (md) {
          fs.writeFileSync(path.join(docsOutputDir, `${fileBase}-${lang}.md`), md, "utf-8");
        }
      }

      res.status(201).json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/slides", requireAuth, async (req, res) => {
    try {
      const docId = Number(req.params.id);
      const { locale } = req.body;
      const lang = locale || "ja";

      const doc = await storage.getDocument(docId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      const project = await storage.getProject(doc.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (req.user!.role !== "system_admin") {
        if (req.user!.role === "org_admin" || req.user!.role === "pm") {
          if (project.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (req.user!.role === "member") {
          const members = await storage.getProjectMembers(doc.projectId);
          if (!members.some((m) => m.userId === req.user!.id)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const cj = doc.contentJson as any;
      let markdown = "";
      if (cj && typeof cj === "object") {
        markdown = cj[lang] || cj.en || cj.ja || cj.vi || doc.contentMd;
      } else {
        markdown = doc.contentMd;
      }

      const slidesHtml = await generateSlides(markdown, doc.type, lang);

      const cleanHtml = slidesHtml.replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();

      await db.update(documentsTable).set({ slidesHtml: cleanHtml }).where(eq(documentsTable.id, docId));

      const fileBase = `doc-${docId}-${doc.type}`;
      const htmlFullPage = buildRevealHtml(cleanHtml, doc.type === "kickoff" ? "Kickoff Document" : "Feature Proposal");
      fs.writeFileSync(path.join(docsOutputDir, `${fileBase}.html`), htmlFullPage, "utf-8");

      const pptxPath = path.join(docsOutputDir, `${fileBase}.pptx`);
      if (fs.existsSync(pptxPath)) {
        try { fs.unlinkSync(pptxPath); } catch {}
      }

      res.json({ slidesHtml: cleanHtml });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/pptx", requireAuth, async (req, res) => {
    try {
      const docId = Number(req.params.id);
      const doc = await storage.getDocument(docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      if (!doc.slidesHtml) {
        return res.status(400).json({ message: "No slides generated yet. Generate slides first." });
      }

      const project = await storage.getProject(doc.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (req.user!.role !== "system_admin") {
        if (req.user!.role === "org_admin" || req.user!.role === "pm") {
          if (project.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (req.user!.role === "member") {
          const members = await storage.getProjectMembers(doc.projectId);
          if (!members.some((m) => m.userId === req.user!.id)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const fileBase = `doc-${docId}-${doc.type}`;
      const pptxPath = path.join(docsOutputDir, `${fileBase}.pptx`);
      const filename = `${doc.type === "kickoff" ? "kickoff" : "feature-proposal"}-slides.pptx`;

      let pptxBuffer: Buffer;
      if (fs.existsSync(pptxPath)) {
        pptxBuffer = fs.readFileSync(pptxPath);
      } else {
        const lang = (req.query.locale as string) || "ja";
        const cj = doc.contentJson as any;
        let markdown = "";
        if (cj && typeof cj === "object") {
          markdown = cj[lang] || cj.en || cj.ja || cj.vi || doc.contentMd;
        } else {
          markdown = doc.contentMd;
        }

        console.log("[pptx] Generating AI-structured PPTX data...");
        const pptxSlides = await generatePptxData(markdown, doc.type, lang);
        const docTitle = doc.type === "kickoff" ? "Kickoff Document" : "Feature Proposal";
        pptxBuffer = await generatePptxFromData(pptxSlides, docTitle);
        fs.writeFileSync(pptxPath, pptxBuffer);
        console.log("[pptx] AI-structured PPTX generated:", pptxBuffer.length, "bytes");
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pptxBuffer.length);
      res.end(pptxBuffer);
    } catch (error: any) {
      console.error("[pptx] Generation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/slides-html", requireAuth, async (req, res) => {
    try {
      const docId = Number(req.params.id);
      const doc = await storage.getDocument(docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      if (!doc.slidesHtml) {
        return res.status(400).json({ message: "No slides generated yet." });
      }

      const project = await storage.getProject(doc.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (req.user!.role !== "system_admin") {
        if (req.user!.role === "org_admin" || req.user!.role === "pm") {
          if (project.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (req.user!.role === "member") {
          const members = await storage.getProjectMembers(doc.projectId);
          if (!members.some((m) => m.userId === req.user!.id)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const fileBase = `doc-${docId}-${doc.type}`;
      const htmlPath = path.join(docsOutputDir, `${fileBase}.html`);

      if (!fs.existsSync(htmlPath)) {
        const title = doc.type === "kickoff" ? "Kickoff Document" : "Feature Proposal";
        const htmlFullPage = buildRevealHtml(doc.slidesHtml, title);
        fs.writeFileSync(htmlPath, htmlFullPage, "utf-8");
      }

      const filename = `${doc.type === "kickoff" ? "kickoff" : "feature-proposal"}-slides.html`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.sendFile(htmlPath);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(Number(req.params.id));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      if (req.user!.role === "member") {
        return res.status(403).json({ message: "Members cannot delete documents" });
      }

      const project = await storage.getProject(doc.projectId);
      if (project && req.user!.role !== "system_admin") {
        if (req.user!.role === "org_admin" || req.user!.role === "pm") {
          if (project.organizationId !== req.user!.organizationId) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      await storage.deleteDocument(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/reprocess", requireAuth, requireProjectAccess, requireRole("system_admin", "org_admin", "pm"), async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const allInputs = await storage.getInputsByProject(projectId);
      const allItems = await storage.getStructuredItemsByProject(projectId);

      const inputIdsWithItems = new Set(allItems.map((item) => item.inputId).filter(Boolean));

      const failedPdfInputs = allInputs.filter((input) =>
        !inputIdsWithItems.has(input.id) && input.rawText && input.rawText.startsWith("[PDF text extraction failed") && input.filePath
      );
      const missingFiles: number[] = [];
      for (const input of failedPdfInputs) {
        try {
          if (!fs.existsSync(input.filePath!)) {
            console.warn(`[reprocess] PDF file missing for input ${input.id}: ${input.filePath}`);
            missingFiles.push(input.id);
            continue;
          }
          const dataBuffer = fs.readFileSync(input.filePath!);
          const parser = new PDFParse({ data: new Uint8Array(dataBuffer), verbosity: VerbosityLevel.ERRORS });
          await parser.load();
          const pdfResult = await parser.getText();
          const newText = typeof pdfResult === "string" ? pdfResult : pdfResult?.text || "";
          await parser.destroy();
          if (newText.trim()) {
            await storage.updateInput(input.id, { rawText: newText });
            (input as any).rawText = newText;
          }
        } catch (err: any) {
          console.error(`[reprocess] Re-parse PDF for input ${input.id} failed:`, err?.message);
        }
      }

      const updatedInputs = await storage.getInputsByProject(projectId);
      const unprocessed = updatedInputs.filter((input) => !inputIdsWithItems.has(input.id) && input.rawText && !input.rawText.startsWith("["));

      if (unprocessed.length === 0 && missingFiles.length > 0) {
        return res.status(400).json({
          message: "PDF files are missing from the server. Please re-upload the PDF files using the re-upload button in the input history.",
          reprocessed: 0,
          missingFiles: missingFiles.length,
        });
      }

      if (unprocessed.length === 0) {
        return res.json({ message: "No unprocessed inputs found", reprocessed: 0 });
      }

      for (const input of unprocessed) {
        processInputText(projectId, input.id, input.rawText).catch((err) => {
          console.error(`Error reprocessing input ${input.id}:`, err);
        });
      }

      res.json({ message: `Reprocessing ${unprocessed.length} input(s)`, reprocessed: unprocessed.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/inputs/:inputId/reupload", requireAuth, requireProjectAccess, requireRole("system_admin", "org_admin", "pm"), upload.single("file"), async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const inputId = Number(req.params.inputId);

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const input = await storage.getInput(inputId);
      if (!input || input.projectId !== projectId) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Input not found" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      let rawText = "";

      if (ext === ".pdf") {
        try {
          const dataBuffer = fs.readFileSync(req.file.path);
          const parser = new PDFParse({ data: new Uint8Array(dataBuffer), verbosity: VerbosityLevel.ERRORS });
          await parser.load();
          const result = await parser.getText();
          rawText = typeof result === "string" ? result : result?.text || "";
          await parser.destroy();
          if (!rawText.trim()) {
            rawText = "[PDF text extraction failed - this may be a scanned PDF requiring OCR (Phase 2)]";
          }
        } catch (err: any) {
          console.error("[PDF re-upload parse error]", err?.message || err);
          rawText = "[PDF text extraction failed - unsupported format]";
        }
      } else if ([".txt", ".md"].includes(ext)) {
        rawText = fs.readFileSync(req.file.path, "utf-8");
      } else {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: `Unsupported file format: ${ext}` });
      }

      await storage.deleteStructuredItemsByInput(inputId);
      await storage.updateInput(inputId, {
        rawText,
        filePath: req.file.path,
        fileName: req.file.originalname,
        translatedJson: null,
      });

      if (rawText && !rawText.startsWith("[")) {
        processInputText(projectId, inputId, rawText).catch((err) => {
          console.error(`Error processing re-uploaded input ${inputId}:`, err);
        });
      }

      const updated = await storage.getInput(inputId);
      res.json(updated);
    } catch (error: any) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}

async function processInputText(projectId: number, inputId: number, text: string) {
  try {
    const [extracted, translated] = await Promise.all([
      extractStructuredData(text),
      translateInputText(text),
    ]);

    await storage.updateInputTranslation(inputId, translated);

    for (const item of extracted.items) {
      await storage.createStructuredItem({
        projectId,
        inputId,
        category: item.category,
        valueJson: item.value,
        confidence: item.confidence,
      });
    }

    await storage.updateProjectConfidence(projectId);

    const existingSummary = await storage.getLatestSummary(projectId);
    const allInputs = await storage.getInputsByProject(projectId);
    const allItems = await storage.getStructuredItemsByProject(projectId);

    const newSummaryJson = await generateSummary(
      existingSummary?.summaryJson || null,
      allInputs.map((i) => i.rawText),
      allItems.map((item) => ({ category: item.category, valueJson: item.valueJson }))
    );

    const nextVersion = existingSummary ? existingSummary.version + 1 : 1;
    await storage.createSummary({
      projectId,
      version: nextVersion,
      summaryJson: newSummaryJson,
    });
  } catch (error) {
    console.error("Error processing input text:", error);
  }
}

async function translateProjectFields(projectId: number, title: string, customerName: string | null) {
  try {
    const titleTranslated = await translateInputText(title);
    let customerNameTranslated = null;
    if (customerName) {
      customerNameTranslated = await translateInputText(customerName);
    }
    await storage.updateProject(projectId, {
      titleJson: titleTranslated,
      customerNameJson: customerNameTranslated,
    } as any);
  } catch (error) {
    console.error("Error translating project fields:", error);
  }
}
