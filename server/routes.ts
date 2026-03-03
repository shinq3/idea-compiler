import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { extractStructuredData, generateSummary, generateDocument, generateSlides, transcribeAudio, translateInputText } from "./openai";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];
const ALLOWED_AUDIO_EXTENSIONS = [".webm", ".mp4", ".m4a", ".wav", ".mp3", ".ogg"];
const VALID_STATUSES = ["discovery", "proposal", "negotiation", "won", "lost"];
const VALID_INPUT_TYPES = ["text", "meeting_note", "rfp_pdf", "file"];

const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  customerName: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  budgetMin: z.coerce.number().int().nonnegative().nullable().optional(),
  budgetMax: z.coerce.number().int().nonnegative().nullable().optional(),
  releaseDateTarget: z.string().nullable().optional(),
  status: z.enum(["discovery", "proposal", "negotiation", "won", "lost"]).default("discovery"),
});

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  customerName: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  budgetMin: z.coerce.number().int().nonnegative().nullable().optional(),
  budgetMax: z.coerce.number().int().nonnegative().nullable().optional(),
  releaseDateTarget: z.string().nullable().optional(),
  status: z.enum(["discovery", "proposal", "negotiation", "won", "lost"]).optional(),
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ message: "Not found" });
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects", upload.single("rfpFile"), async (req, res) => {
    try {
      const parsed = createProjectSchema.safeParse({
        title: req.body.title,
        customerName: req.body.customerName || null,
        owner: req.body.owner || null,
        budgetMin: req.body.budgetMin || null,
        budgetMax: req.body.budgetMax || null,
        releaseDateTarget: req.body.releaseDateTarget || null,
      });

      if (!parsed.success) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }

      const project = await storage.createProject(parsed.data);

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
            const pdfParse = (await import("pdf-parse")).default;
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            rawText = pdfData.text;
            if (!rawText.trim()) {
              rawText = "[PDF text extraction failed - this may be a scanned PDF requiring OCR (Phase 2)]";
            }
          } catch {
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

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
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

  app.delete("/api/projects/:id", async (req, res) => {
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

  app.get("/api/projects/:id/inputs", async (req, res) => {
    try {
      const inputs = await storage.getInputsByProject(Number(req.params.id));
      res.json(inputs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const processingStatus = new Map<string, { status: "processing" | "done" | "error"; message?: string }>();

  app.post("/api/projects/:id/inputs", upload.single("file"), async (req, res) => {
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
            const pdfParse = (await import("pdf-parse")).default;
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            rawText = pdfData.text;
            if (!rawText.trim()) {
              rawText = "[PDF text extraction failed - this may be a scanned PDF requiring OCR (Phase 2)]";
            }
          } catch {
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

  app.post("/api/transcribe", audioUpload.single("audio"), async (req, res) => {
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

  app.get("/api/processing-status/:taskKey", (req, res) => {
    const status = processingStatus.get(req.params.taskKey);
    if (!status) return res.json({ status: "unknown" });
    res.json(status);
    if (status.status === "done" || status.status === "error") {
      setTimeout(() => processingStatus.delete(req.params.taskKey), 60000);
    }
  });

  app.get("/api/projects/:id/structured-items", async (req, res) => {
    try {
      const items = await storage.getStructuredItemsByProject(Number(req.params.id));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/summaries", async (req, res) => {
    try {
      const sums = await storage.getSummariesByProject(Number(req.params.id));
      res.json(sums);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/summary/latest", async (req, res) => {
    try {
      const summary = await storage.getLatestSummary(Number(req.params.id));
      res.json(summary || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/documents", async (req, res) => {
    try {
      const docs = await storage.getDocumentsByProject(Number(req.params.id));
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/documents/generate", async (req, res) => {
    try {
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

      res.status(201).json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/slides", async (req, res) => {
    try {
      const docId = Number(req.params.id);
      const { locale } = req.body;
      const lang = locale || "ja";

      const doc = await storage.getDocument(docId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
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

      res.json({ slidesHtml: cleanHtml });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      await storage.deleteDocument(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
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
