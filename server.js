// server.js
// All-Breed Canine Assistant backend (Express + OpenAI)
// - CORS locked to your WordPress origin
// - Optional referer/path guard to restrict calls to /all-breed/
// - Curated veterinary & training sources for citations
// - "House Notes" (your puppy book content) loaded as first-party guidance
// - Optional /widget.js for embedding when page builders strip inline <script>

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// -------------------------------
// Environment / Config
// -------------------------------
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://standardpoodlesofforestlakes.com";
const ALLOWED_PATH = process.env.ALLOWED_PATH || "/all-breed/"; // referer must include this path

if (!OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set.");
  process.exit(1);
}

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------
// Express App
// -------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS: lock to your WP origin
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow server-to-server / local tools
      cb(null, origin === ALLOWED_ORIGIN);
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  })
);

// Basic rate limit per IP on /chat
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
});
app.use("/chat", limiter);

// Extra guard: ensure requests come from your specific page
app.use("/chat", (req, res, next) => {
  const referer = req.get("referer") || "";
  if (referer.startsWith(ALLOWED_ORIGIN) && referer.includes(ALLOWED_PATH)) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden" });
});

// -------------------------------
// Curated Source Maps (Health + Training)
// -------------------------------

// HEALTH / VETERINARY buckets
const VET_SOURCE_MAP = [
  {
    tag: "emergency_poison",
    keywords: ["poison", "toxin", "ate", "ingested", "xylitol", "ibuprofen", "grapes", "rat poison", "chocolate"],
    links: [
      "https://www.petpoisonhelpline.com/",
      "https://www.fda.gov/animal-veterinary",
    ],
  },
  {
    tag: "parasites",
    keywords: ["flea", "tick", "heartworm", "roundworm", "hookworm", "tapeworm", "giardia", "coccidia", "parasite"],
    links: [
      "https://capcvet.org/",
      "https://www.merckvetmanual.com/pethealth",
    ],
  },
  {
    tag: "vaccines_preventive",
    keywords: ["vaccine", "vaccination", "rabies", "dhpp", "dhlpp", "bordetella", "lepto", "leptospirosis", "schedule", "puppy shots"],
    links: [
      "https://www.avma.org/",
      "https://www.aaha.org/",
    ],
  },
  {
    tag: "genetics_testing",
    keywords: ["genetic", "dna", "embark", "degenerative myelopathy", "ivdd", "progressive retinal atrophy", "pra", "genotype"],
    links: [
      "https://embarkvet.com/",
      "https://www.vgl.ucdavis.edu/services/dog.php",
    ],
  },
  {
    tag: "orthopedics_surgery",
    keywords: ["tplo", "ccl", "cruciate", "acl", "hip dysplasia", "elbow dysplasia", "patella", "lameness", "orthopedic", "surgery"],
    links: [
      "https://www.acvs.org/",
      "https://ofa.org/",
    ],
  },
  {
    tag: "behavior_clinical",
    keywords: ["separation anxiety", "aggression", "reactive", "phobia", "behavior medication"],
    links: [
      "https://www.dacvb.org/",
      "https://veterinarypartner.vin.com/",
    ],
  },
  {
    tag: "dermatology_allergy",
    keywords: ["itch", "allergy", "atopy", "hot spot", "dermatitis", "yeast", "pyoderma"],
    links: [
      "https://acvd.org/",
      "https://www.merckvetmanual.com/pethealth",
    ],
  },
  {
    tag: "dentistry",
    keywords: ["tooth", "dental", "periodontal", "gingivitis", "extraction", "tartar", "vohc"],
    links: [
      "https://avdc.org/",
      "https://vohc.org/",
    ],
  },
  {
    tag: "ophthalmology",
    keywords: ["eye", "entropion", "distichia", "cataract", "cornea", "uveitis", "glaucoma"],
    links: [
      "https://acvo.org/",
      "https://www.merckvetmanual.com/pethealth",
    ],
  },
];

// GENERAL owner-friendly health references
const VET_FALLBACK_LINKS = [
  "https://veterinarypartner.vin.com/",
  "https://www.merckvetmanual.com/pethealth",
  "https://www.avma.org/",
];

// TRAINING / HANDLING buckets (credible, positive-reinforcement centered)
const TRAIN_SOURCE_MAP = [
  {
    tag: "foundations_puppy",
    keywords: ["puppy", "housebreaking", "house training", "crate", "socialization", "bite", "nipping", "chewing"],
    links: [
      "https://positively.com/", // Victoria Stilwell Positively
      "https://www.ccpdt.org/",  // Certification Council for Professional Dog Trainers
    ],
  },
  {
    tag: "methods_clicker",
    keywords: ["clicker", "marker", "reinforcement", "shaping", "capturing"],
    links: [
      "https://karenpryoracademy.com/",
      "https://positively.com/",
    ],
  },
  {
    tag: "trainer_education",
    keywords: ["certified trainer", "become a trainer", "trainer certification", "credentials", "cpdt", "ka", "ksa"],
    links: [
      "https://www.ccpdt.org/",
      "https://apdt.com/",
    ],
  },
  {
    tag: "competition_basics",
    keywords: ["conformation", "ring", "gait", "stack", "obedience", "rally", "agility"],
    links: [
      "https://apdt.com/",
      "https://positively.com/",
    ],
  },
];

// Owner-friendly training fallback
const TRAIN_FALLBACK_LINKS = [
  "https://positively.com/",
  "https://www.ccpdt.org/",
];

// Choose links by scanning keywords across both maps
function selectApprovedLinks(message) {
  const text = (message || "").toLowerCase();

  const pick = (MAP, FALLBACK) => {
    const chosen = [];
    for (const group of MAP) {
      if (group.keywords.some((k) => text.includes(k))) {
        chosen.push(...group.links);
      }
    }
    const unique = Array.from(new Set(chosen));
    return unique.length ? unique.slice(0, 4) : FALLBACK;
  };

  // Heuristic: if message smells like training/handling → prefer TRAIN sources, else VET
  const trainingHints = ["train", "crate", "socializ", "heel", "sit", "down", "stay", "recall", "gait", "stack", "ring", "obedience", "agility", "rally", "nipping", "biting", "housebreaking"];
  const isTraining = trainingHints.some((h) => text.includes(h));

  const links = isTraining
    ? pick(TRAIN_SOURCE_MAP, TRAIN_FALLBACK_LINKS)
    : pick(VET_SOURCE_MAP, VET_FALLBACK_LINKS);

  // De-duplicate once more (in case overlap across categories)
  return Array.from(new Set(links)).slice(0, 4);
}

// -------------------------------
// House Notes (your puppy book content) loader & selector
// -------------------------------
const NOTES_DIR = path.join(__dirname, "house_notes");

// Load markdown notes with light front-matter
function loadHouseNotes() {
  if (!fs.existsSync(NOTES_DIR)) return [];
  const files = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith(".md"));
  return files.map((fname) => {
    const raw = fs.readFileSync(path.join(NOTES_DIR, fname), "utf8");
    // Parse minimal front-matter (optional)
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/m.exec(raw);
    let meta = { title: fname.replace(".md", ""), tags: [], keywords: [] };
    let body = raw;
    if (m) {
      body = m[2].trim();
      const fm = m[1];
      const getList = (key) => {
        const r = new RegExp(`${key}:\\s*\\[(.*?)\\]`);
        const s = r.exec(fm)?.[1] || "";
        return s
          .split(",")
          .map((x) => x.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);
      };
      const t = /title:\s*(.+)/.exec(fm)?.[1]?.trim();
      if (t) meta.title = t;
      meta.tags = getList("tags");
      meta.keywords = getList("keywords");
    }
    return { id: fname, meta, body };
  });
}

const HOUSE_NOTES = loadHouseNotes();

// Score notes by keyword/tag overlap; return top N
function selectHouseNotes(message, max = 2) {
  const q = (message || "").toLowerCase();
  const scored = HOUSE_NOTES.map((n) => {
    let score = 0;
    n.meta.keywords?.forEach((k) => {
      if (q.includes(k.toLowerCase())) score += 3;
    });
    n.meta.tags?.forEach((k) => {
      if (q.includes(k.toLowerCase())) score += 2;
    });
    if (n.meta.title && q.includes(n.meta.title.toLowerCase())) score += 1;
    // tiny fallback: if nothing hit, check if first word appears in body
    if (score === 0 && q.length) {
      const first = q.split(/\s+/)[0];
      if (first && n.body.toLowerCase().includes(first)) score += 1;
    }
    return { note: n, score };
  })
    .sort((a, b) => b.score - a.score)
    .filter((x) => x.score > 0)
    .slice(0, max)
    .map((x) => x.note);

  return scored;
}

// -------------------------------
// OpenAI Chat Completion
// -------------------------------
async function chatWithOpenAI({ userMessage, links, houseContext }) {
  const systemPrompt = `
You are the All-Breed Canine Assistant for dog owners, handlers, and breeders.

FOCUS
- Health education: rely on approved veterinary bodies (VIN Veterinary Partner, Merck Vet Manual, AVMA, AAHA, FDA CVM, ACV* specialty colleges, CAPC, university vet sites). Use only the provided links in "Approved links" for citations.
- Training & socialization: positive reinforcement, stepwise plans, and humane methods; reference credible training bodies (CCPDT, VSA, APDT, Karen Pryor Academy) when useful.
- Getting started in showing/competition (AKC/UKC basics).
- Ethical breeding (pre-breeding health testing, whelping care, responsible placement).

GUARDRAILS
- Not a substitute for a veterinarian. For urgent, severe, or individualized medical issues, advise contacting a licensed veterinarian or emergency clinic.
- Do not invent sources. Only cite from the provided approved links.
- Keep answers clear, kind, and professional.

STYLE
- Start with concise, actionable steps, then brief context.
- End every answer with a short "Sources" section listing 2–4 of the approved links most relevant to the user’s question.

HOUSE GUIDANCE
- If a "House guidance" block is provided, treat it as first-party guidance. You may use it freely, but do NOT name or refer to any book or internal source by name.
`.trim();

  const contextMsg =
    `Approved links relevant to this question:\n` +
    links.map((l) => `- ${l}`).join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "assistant", content: contextMsg
