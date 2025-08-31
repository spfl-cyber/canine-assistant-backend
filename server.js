// server.js — All-Breed Canine Assistant (URLs-only edition)
//
// Env vars to set in Render (NOT in GitHub):
//   OPENAI_API_KEY=sk-... (your OpenAI key)
//   ALLOWED_ORIGIN=https://standardpoodlesofforestlakes.com
//   ALLOWED_PATH=/all-breed/
//
// package.json should include:
// {
//   "name": "canine-assistant-backend",
//   "type": "module",
//   "version": "1.0.0",
//   "scripts": { "start": "node server.js" },
//   "dependencies": {
//     "cors": "^2.8.5",
//     "dotenv": "^16.4.5",
//     "express": "^4.19.2",
//     "express-rate-limit": "^7.3.0"
//   }
// }

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

// ----------------------
// Config / Environment
// ----------------------
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

// CORS — only allow your WordPress origin
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow server-to-server/tools
      cb(null, origin === ALLOWED_ORIGIN);
    },
    methods: ["POST", "GET", "OPTIONS"],
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

/* ---------------------------------------
   APPROVED SOURCES (your vetted lists)
--------------------------------------- */

// Veterinary / health (core)
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
  "https://positively.com/",
  "https://www.vsdogtrainingacademy.com/",
  "https://www.ccpdt.org/",
  "https://apdt.com/",
  "https://karenpryoracademy.com/",
  "https://www.dogtrainingrevolution.com/",
  "https://catchdogtrainers.com/",
  "https://goodpup.com/",
  "https://www.everydogaustin.org/",
  "https://dogsbestfriendtraining.com/",
];

// Topic buckets → 2–4 URLs per question
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
    keywords: ["puppy", "crate", "housebreaking", "house training", "socialization", "bite", "nipping", "chewing", "recall", "heel", "sit", "down", "stay"],
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

const VET_FALLBACK = ["https://veterinarypartner.vin.com/", "https://www.merckvetmanual.com/pethealth", "https://www.avma.org/"];
const TRAIN_FALLBACK = ["https://positively.com/", "https://www.ccpdt.org/"];
const TRAIN_HINTS = ["train", "crate", "socializ", "heel", "sit", "down", "stay", "recall", "gait", "stack", "ring", "obedience", "agility", "rally", "nipping", "biting", "housebreaking"];

function selectApprovedUrls(message) {
  const text = (message || "").toLowerCase();

  // Scan topic buckets
  let chosen = [];
  for (const group of TOPIC_MAP) {
    if (group.keywords.some((k) => text.includes(k))) {
      chosen.push(...group.urls);
    }
  }
  chosen = Array.from(new Set(chosen));
  if (chosen.length) return chosen.slice(0, 4);

  // Fallback pools
  const isTraining = TRAIN_HINTS.some((h) => text.includes(h));
  return (isTraining ? TRAIN_FALLBACK : VET_FALLBACK).slice(0, 3);
}

// ----------------------
// OpenAI Chat call
// ----------------------
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

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: contextMsg },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await r.json();
  if (!r.ok) {
    console.error("OpenAI error:", data);
    throw new Error("OpenAI request failed");
  }
  return data.choices?.[0]?.message?.content || "";
}

// ----------------------
// POST /chat endpoint
// ----------------------
app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body && req.body.message) || "";
    if (!userMessage) return res.status(400).json({ error: "Empty message" });

    const urls = selectApprovedUrls(userMessage);
    const reply = await askOpenAI(userMessage, urls);
    return res.json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

// ----------------------
// OPTIONAL: external widget loader
// If Divi strips inline <script>, include on your WP page:
//   <script src="https://canine-assistant.onrender.com/widget.js" defer></script>
// ----------------------
app.get("/widget.js", (_req, res) => {
  res.type("application/javascript").send(`
    (function(){
      var style=document.createElement('style');
      style.innerHTML=[
        "#chatButton{position:fixed;top:20px;right:20px;background:#4CAF50;color:#fff;border:none;border-radius:50%;width:60px;height:60px;font-size:28px;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,.2);z-index:100000}",
        "#chatWindow{display:none;position:fixed;top:90px;right:20px;width:350px;height:450px;background:#fff;border:1px solid #ccc;border-radius:12px;box-shadow:0 6px 12px rgba(0,0,0,.3);flex-direction:column;overflow:hidden;z-index:100000;font-family:Arial,sans-serif}",
        "#chatHeader{background:#4CAF50;color:#fff;padding:10px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;position:relative}",
        "#chatHeader .buttons{display:flex;gap:8px}",
        "#chatHeader button{background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer}",
        "#notifDot{display:none;position:absolute;top:8px;right:70px;width:12px;height:12px;background:red;border-radius:50%}",
        "#chatBody{flex:1;padding:10px;overflow-y:auto;font-size:14px;color:#222}",
        "#chatBody .user{font-weight:bold;margin-top:10px}",
        "#chatBody .bot{margin-left:15px;color:#444;white-space:pre-wrap}",
        "#chatInput{display:flex;border-top:1px solid #ddd}",
        "#chatInput input{flex:1;padding:10px;border:none;outline:none}",
        "#chatInput button{background:#4CAF50;color:#fff;border:none;padding:10px 15px;cursor:pointer}",
        "#chatWindow.minimized{height:40px}",
        "#chatWindow.minimized #chatBody,#chatWindow.minimized #chatInput{display:none}"
      ].join("\\n");
      document.head.appendChild(style);

      var btn=document.createElement('button'); btn.id='chatButton'; btn.setAttribute('aria-label','Open Canine Assistant'); btn.textContent='💬';
      var win=document.createElement('div'); win.id='chatWindow'; win.setAttribute('role','dialog'); win.setAttribute('aria-label','Canine Assistant');
      win.innerHTML=[
        '<div id="chatHeader">🐾 Canine Assistant',
        '  <span id="notifDot"></span>',
        '  <div class="buttons"><button id="resetBtn" title="Reset">♻️</button><button id="minimizeBtn" title="Minimize">—</button></div>',
        '</div>',
        '<div id="chatBody"><p><em>Hi! Ask me about dog health, training, showing, or breeding.<br>⚠️ Educational only — not a substitute for a veterinarian.</em></p></div>',
        '<div id="chatInput"><input id="message" type="text" placeholder="Type your question…"><button id="sendBtn" title="Send">➤</button></div>'
      ].join("");

      document.addEventListener('DOMContentLoaded', function(){
        document.body.appendChild(btn);
        document.body.appendChild(win);
        var minimizeBtn=document.getElementById('minimizeBtn'),
            resetBtn=document.getElementById('resetBtn'),
            notifDot=document.getElementById('notifDot'),
            chatBody=document.getElementById('chatBody'),
            input=document.getElementById('message'),
            sendBtn=document.getElementById('sendBtn');

        var BACKEND=new URL('.', (document.currentScript && document.currentScript.src) || window.location.href).origin;

        btn.onclick=function(){ win.style.display=(win.style.display==='none'||!win.style.display)?'flex':'none'; if(win.style.display==='flex' && input) input.focus(); };
        minimizeBtn.onclick=function(){ win.classList.toggle('minimized'); minimizeBtn.textContent=win.classList.contains('minimized')?'▢':'—'; if(!win.classList.contains('minimized')) notifDot.style.display='none'; };
        resetBtn.onclick=function(){ chatBody.innerHTML='<p><em>Hi! Ask me about dog health, training, showing, or breeding.<br>⚠️ Educational only — not a substitute for a veterinarian.</em></p>'; if(input) input.value=''; };

        function append(role,text){ var d=document.createElement('div'); d.className=(role==='user'?'user':'bot'); d.textContent=(role==='user'?'You: ':'Assistant: ')+text; chatBody.appendChild(d); chatBody.scrollTop=chatBody.scrollHeight; }
        async function sendMessage(){
          var msg=(input&&input.value||'').trim(); if(!msg) return;
          append('user',msg); if(input) input.value='';
          try{
            var r=await fetch(BACKEND+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
            var data=await r.json(); if(!r.ok) throw new Error(data.error||'Request failed');
            append('assistant',data.reply||''); if(win.classList.contains('minimized')) notifDot.style.display='block';
          }catch(e){ append('assistant','Sorry—I\\'m having trouble right now.'); console.error(e); }
        }
        sendBtn.onclick=sendMessage; if(input) input.addEventListener('keydown',function(e){ if(e.key==='Enter') sendMessage(); });
      });
    })();
  `);
});

// ----------------------
// Start server
// ----------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   CORS allowed origin: ${ALLOWED_ORIGIN}`);
  console.log(`   Referer path guard:  ${ALLOWED_PATH}`);
});
