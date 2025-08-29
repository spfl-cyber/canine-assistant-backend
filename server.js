import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();
const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3000;
// Lock CORS to your site (adjust if your domain differs)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://standardpoodlesofforestlakes.com";
// (Optional) further restrict by page path:
const ALLOWED_PATH = process.env.ALLOWED_PATH || "/all-breed/";

// --- Middleware ---
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server and tools without origin
      if (!origin) return cb(null, true);
      cb(null, origin === ALLOWED_ORIGIN);
    },
    methods: ["POST", "OPTIONS"],
  })
);

// Basic abuse protection (tune as desired)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 requests/minute per IP
});
app.use("/chat", limiter);

// (Extra guard) Check Referer to ensure requests come from the specific page
app.use("/chat", (req, res, next) => {
  const referer = req.get("referer") || "";
  if (referer.startsWith(ALLOWED_ORIGIN) && referer.includes(ALLOWED_PATH)) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden" });
});

// --- Chat endpoint ---
app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body && req.body.message) || "";
    if (!userMessage) return res.status(400).json({ error: "Empty message" });

    // OpenAI call
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
`You are the All-Breed Canine Assistant for dog owners, handlers, and breeders.
FOCUS:
- Health education (reference reputable veterinary sources when appropriate: e.g., Cornell, UC Davis, OFA, AKC Canine Health Foundation).
- Training/socialization with practical, step-by-step guidance (positive methods emphasized).
- Getting started in showing/competition (AKC/UKC basics; conformation, agility, obedience, rally, barn hunt, dock diving).
- Ethical breeding (pre-breeding health testing, whelping care, responsible placement).
GUARDRAILS:
- This is not a substitute for a veterinarian. For urgent, severe, or individualized medical questions, advise contacting a licensed vet.
- Avoid human medical advice. Keep answers safe, kind, and clear.
TONE:
- Friendly, encouraging, and professional. Cite reputable sources when claims may need verification.`
          },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({ error: "OpenAI request failed" });
    }

    return res.json({ reply: data.choices?.[0]?.message?.content || "" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
