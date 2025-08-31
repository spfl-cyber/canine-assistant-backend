// server.js — All-Breed Canine Assistant (URLs-only)
// Dependencies (package.json):
//   "express", "cors", "dotenv", "express-rate-limit"
// Env vars (Render):
//   OPENAI_API_KEY=sk-...
//   ALLOWED_ORIGIN=https://standardpoodlesofforestlakes.com
//   ALLOWED_PATH=/all-breed/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://standardpoodlesofforestlakes.com";
const ALLOWED_PATH = process.env.ALLOWED_PATH || "/all-breed/";

if (!OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS — only allow your WordPress site
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow server-to-server/tools
      cb(null, origin === ALLOWED_ORIGIN);
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Throttle calls to /chat
app.use("/chat", rateLimit({ windowMs: 60 * 1000, max: 30 }));

// Optional: block calls unless they come from your /all-breed/ page
app.use("/chat", (req, res, next) => {
  const referer = req.get("referer") || "";
  if (referer.startsWith(ALLOWED_ORIGIN) && referer.includes(ALLOWED_PATH)) return next();
  return res.status(403).json({ error: "Forbidden" });
});

/* ------------------------------
   APPROVED SOURCES (your lists)
------------------------------ */

// Veterinary / health (from your master list)
const VET_CORE = [
  "https://veterinarypartner.vin.com/",
  "https://www.acvm.us/",
  "https://www.acvs.org/",
  "https://www.merckvetmanual.com/pethealth",
  "https://www.vet.cornell.edu/departments-centers-and-institutes/canine-health-center",
  "https://www.vgl.ucdavis.edu/services/dog.php",
  "https://www.dvm360.com",
  "https://embarkvet.com",
  "https://www.ipgicmg.com",
  "https://www.dacvb.org",
  "https://www.advim.org",
  "https://www.aavmc.org",
  "https://www.acvp.org",
  "https://www.acvr.org",
  "https://www.acvecc.org",
  "https://www.acvpm.org",
  "https://www.avma.org",
  "https://www.acvaa.org",
  "https://acvd.org",
  "https://vetmeds.org",
  "https://www.vsmr.org",
  "https://acvo.org",
  "https://www.vetspecialists.com",
  "https://www.acvcp.org",
];

// Additional authoritative pet-health resources you approved
const VET_EXTRA = [
  "https://www.petmd.com/",
  "https://pets.webmd.com/",
  "https://www.pethealthnetwork.com/",
  "https://www.petplace.com/",
  "https://www.petpoisonhelpline.com/",
  "https://www.aaha.org/",
  "https://www.fda.gov/animal-veterinary",
  "https://www.woah.org/",
  "https://www.wikivet.net/",
  "https://capcvet.org/",
  "https://indoorpet.osu.edu/",
  "https://www.nlm.nih.gov/services/queries/veterinarymed.html",
  "https://avdc.org/",
  "https://vohc.org/",
];

// Training & certification (credible, positive-reinforcement)
const TRAINING = [
  "https://positively.com/",            // Victoria Stilwell Positively
  "https://www.vsdogtrainingacademy.com/", // Victoria Stilwell Academy
  "https://www.ccpdt.org/",             // Certification Council for Professional Dog Trainers
  "https://apdt.com/",                  // Association of Professional Dog Trainers
  "https://karenpryoracademy.com/",     // Karen Pryor Academy
  "https://www.dogtrainingrevolution.com/", // Zak George site
  "https://catchdogtrainers.com/",      // CATCH Trainers
  "https://goodpup.com/",               // GoodPup (vetted trainers)
  "https://www.everydogaustin.org/",    // Nonprofit training/behavior org
  "https://dogsbestfriendtraining.com/" // Established certified trainers
];

// Topic buckets → url picks (kept short so citations stay focused)
const TOPIC_MAP = [
  {
    tag: "emergency_poison",
    keywords: ["poison", "toxin", "ate", "ingested", "xylitol", "ibuprofen", "grapes", "rat poison", "chocolate"],
    urls: ["https://www.petpoisonhelpline.com/", "https://www.fda.gov/animal-veterinary"],
  },
  {
    tag: "parasites",
    keywords: ["flea", "tick", "heartworm", "roundworm", "hookworm", "tapeworm", "giardia", "coccidia", "parasite"],
    urls: ["https://capcvet.org/", "https://www.merckvetmanual.com/pethealth"],
  },
  {
    tag: "vaccines_preventive",
    keywords: ["vaccine", "vaccination", "rabies", "dhpp", "dhlpp", "bordetella", "lepto", "leptospirosis", "schedule", "puppy shots"],
    urls: ["https://www.avma.org/", "https://www.aaha.org/"],
  },
  {
    tag: "genetics_testing",
    keywords: ["genetic", "dna", "embark", "degenerative myelopathy", "ivdd", "pra", "progressive retinal atrophy"],
    urls: ["https://embarkvet.com", "https://www.vgl.ucdavis.edu/services/dog.php"],
  },
  {
    tag: "orthopedics",
    keywords: ["tplo", "ccl", "cruciate", "acl", "hip dysplasia", "elbow dysplasia", "patella", "lameness", "orthopedic"],
    urls: ["https://www.acvs.org/", "https://ofa.org/"],
  },
  {
    tag: "dermatology_allergy",
    keywords: ["itch", "allergy", "atopy", "hot spot", "dermatitis", "yeast", "pyoderma"],
    urls: ["https://acvd.org/", "https://www.merckvetmanual.com/pethealth"],
  },
  {
    tag: "ophthalmology",
    keywords: ["eye", "entropion", "distichia", "cataract", "cornea", "uveitis", "glaucoma"],
    urls: ["https://acvo.org/", "https://www.merckvetmanual.com/pethealth"],
  },
  {
    tag: "behavior_clinical",
    keywords: ["separation anxiety", "aggression", "reactive", "phobia", "behavior medication"],
    urls: ["https://www.dacvb.org/", "https://veterinarypartner.vin.com/"],
  },
  // Training-focused buckets
  {
    tag: "puppy_foundations",
    keywords: ["puppy", "crate", "housebreaking", "house training", "socialization", "bite", "nipping", "chewing", "recall", "heel"],
    urls: ["https://positively.com/", "https://www.ccpdt.org/"],
  },
  {
    tag: "clicker_methods",
    keywords: ["clicker", "marker", "reinforcement", "shaping", "capturing"],
    urls: ["https://karenpryoracademy.com/", "https://positively.com/"],
  },
  {
    tag: "trainer_credentials",
    keywords: ["certified trainer", "become a trainer", "trainer certification", "cpdt", "ka", "ksa", "apdt"],
    urls: ["https://www.ccpdt.org/", "https://apdt.com/"],
  },
  {
    tag: "show_compete_basics",
    keywords: ["conformation", "ring", "gait", "stack", "obedience", "rally", "agility"],
    urls: ["https://apdt.com/", "https://positively.com/"],
  },
];

// Fallback pools
const VET_FALLBACK = ["https://veterinarypartner.vin.com/", "https://www.merckvetmanual.com/pethealth", "https://www.avma.org/"];
const TRAIN_FALLBACK = ["https://positively.com/", "https://www.ccpdt.org/"];

// Heuristic: decide if question is training-heavy
const TRAIN_HINTS = ["train", "crate", "socializ", "heel", "sit", "down", "stay", "recall", "gait", "stack", "ring", "obedience", "agility", "rally", "nipping", "biting", "housebreaking"];

// Pick 2–4 URLs to cite based on keywords
function selectApprovedUrls(message) {
  const text = (message || "").toLowerCase();

  // scan buckets
  let chosen = [];
  for (const group of TOPIC_MAP) {
    if (group.keywords.some((k) => text.includes(k))) {
      chosen.push(...group.urls);
    }
  }
  chosen = Array.from(new Set(chosen));

  if (chosen.length) return chosen.slice(0, 4);

  // fallback based on training vs. vet tilt
  const isTraining = TRAIN_HINTS.some((h) => text.includes(h));
  const pool = isTraining ? TRAIN_FALLBACK : VET_FALLBACK;
  return pool.slice(0, 3);
}

/* ------------------------------
   OpenAI call
------------------------------ */
async function askOpenAI(userMessage, urls) {
  const systemPrompt = `
You are the All-Breed Canine Assistant for dog owners, handlers, and breeders.

FOCUS
- Health education from reputable veterinary bodies and references.
- Training & socialization using humane, positive-reinforcement methods.
- Getting started in showing/competition (AKC/UKC basics).
- Ethical breeding (pre-breeding health testing, whelping care, responsible placement).

GUARDRAILS
- You are not a substitute for a veterinarian. For urgent, severe, or individualized medical issues, advise contacting a licensed veterinarian or emergency clinic.
- Do NOT invent sources. Only cite from the approved links provided below.

STYLE
- Start with concise, actionable steps; then give brief context.
- End every answer with a short "Sources" section listing 2–4 of the approved links most relevant to the question.
`.trim();

  const contextMsg =
    "Approved links relevant to this question:\n" +
    urls.map((u) => `- ${u}`).join("\n");

  const r = await fetch("https://api.openai.com/v1/chat/completions",
