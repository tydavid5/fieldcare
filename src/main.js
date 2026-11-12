// FieldCare main app logic.
// Demo mode is on by default when no real Firebase config is present.
// All AI calls go through Firebase AI Logic in src/firebase.js.
// Cases are stored on the device in localStorage.

import { demoTriage, demoCarePlan, SAMPLE_CASES } from "./demo.js";
import { liveAvailable, liveTriage, liveCarePlan } from "./firebase.js";

const STORE_KEY = "fieldcare.cases.v1";

const $ = (id) => document.getElementById(id);

const netPill = $("netPill");
const demoPill = $("demoPill");
const demoToggle = $("demoToggle");
const demoText = $("demoText");
const demoNote = $("demoNote");
const caseForm = $("caseForm");
const patientLabel = $("patientLabel");
const ageGroup = $("ageGroup");
const symptoms = $("symptoms");
const voiceBtn = $("voiceBtn");
const voiceNote = $("voiceNote");
const voiceChips = $("voiceChips");
const assessBtn = $("assessBtn");
const assessStatus = $("assessStatus");
const triageCard = $("triageCard");
const triageLoading = $("triageLoading");
const triageSteps = $("triageSteps");
const triageCancelBtn = $("triageCancelBtn");
const triageContent = $("triageContent");
const triageSource = $("triageSource");
const triageBanner = $("triageBanner");
const bannerShape = $("bannerShape");
const triageLevel = $("triageLevel");
const triageMeaning = $("triageMeaning");
const whyList = $("whyList");
const triageSummary = $("triageSummary");
const triageReceipt = $("triageReceipt");
const redFlagBox = $("redFlagBox");
const redFlagList = $("redFlagList");
const triageQuestions = $("triageQuestions");
const carePlanBtn = $("carePlanBtn");
const carePlanStatus = $("carePlanStatus");
const reviewBtn = $("reviewBtn");
const correctBtn = $("correctBtn");
const reviewNote = $("reviewNote");
const planCard = $("planCard");
const planLoading = $("planLoading");
const planStepsLoading = $("planStepsLoading");
const planCancelBtn = $("planCancelBtn");
const planContent = $("planContent");
const planSource = $("planSource");
const planSteps = $("planSteps");
const planDifferential = $("planDifferential");
const planWatch = $("planWatch");
const planReferral = $("planReferral");
const planFollowUp = $("planFollowUp");
const reviewBtn2 = $("reviewBtn2");
const correctBtn2 = $("correctBtn2");
const reviewNote2 = $("reviewNote2");
const caseList = $("caseList");
const caseCount = $("caseCount");
const emptyCases = $("emptyCases");
const deleteAllBtn = $("deleteAllBtn");

const CASE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let demoMode = !liveAvailable();
let currentCase = null;
let voiceSymptoms = [];
let listening = false;
let currentRec = null;
let currentCancelTriage = null;
let currentCancelPlan = null;
let correctedCaseId = null;

// Triage wording: colour plus shape plus word plus action, never colour alone.
// Triage wording: colour plus shape plus word plus action, never colour alone.
// The action words get the highlighter, in the severity tint, so colour
// still means status.
const LEVEL_MEANING = {
  URGENT: { text: "Urgent, ", action: "get help now." },
  SOON: { text: "Soon, ", action: "see a clinician today." },
  ROUTINE: { text: "Routine, ", action: "can wait." },
};

const LEVEL_ICON = {
  URGENT: "⚠ ",
  SOON: "! ",
  ROUTINE: "✓ ",
};

const BANNER_SHAPES = {
  ROUTINE:
    '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#0b6e4f"/><path d="M14 24.5l7 7 13-15" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  SOON:
    '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><path d="M24 4 L45 42 L3 42 Z" fill="#8a5a00"/><text x="24" y="36" text-anchor="middle" font-size="26" font-weight="800" fill="#ffffff">!</text></svg>',
  URGENT:
    '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><polygon points="15,3 33,3 45,15 45,33 33,45 15,45 3,33 3,15" fill="#b42318"/><text x="24" y="34" text-anchor="middle" font-size="26" font-weight="800" fill="#ffffff">!</text></svg>',
};

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function loadCases() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const fresh = parsed.filter((c) => {
      const t = Date.parse(c.createdAt || "");
      return Number.isNaN(t) || now - t < CASE_TTL_MS;
    });
    if (fresh.length !== parsed.length) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
      } catch (err) {
        // Pruning failed, the stale cases stay until the next load.
      }
    }
    return fresh;
  } catch (err) {
    return [];
  }
}

function saveCases(cases) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cases));
    return true;
  } catch (err) {
    return false;
  }
}

function upsertCase(updated) {
  const cases = loadCases();
  const idx = cases.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cases[idx] = updated;
  } else {
    cases.unshift(updated);
  }
  const saved = saveCases(cases);
  renderCaseList();
  return saved;
}

function isOnline() {
  return navigator.onLine;
}

function refreshNetPill() {
  if (isOnline()) {
    netPill.textContent = "Online";
    netPill.className = "pill pill-online";
  } else {
    netPill.textContent = "Offline";
    netPill.className = "pill pill-offline";
  }
  refreshCarePlanArea();
}

function refreshDemoUI() {
  demoToggle.checked = demoMode;
  if (demoMode) {
    demoPill.textContent = "Demo mode";
    demoPill.className = "pill pill-demo";
    demoText.textContent =
      "Demo mode is on. The triage and care plan answers are simulated with realistic examples, so you can try the full flow without a live AI connection. The on-device and cloud steps are labelled, so you can see where each answer would come from.";
  } else {
    demoPill.textContent = "Live mode";
    demoPill.className = "pill pill-live";
    demoText.textContent =
      "Live mode is on. Triage runs through Firebase AI Logic with Gemini Nano on-device when available, and the care plan uses Gemini Flash in the cloud.";
  }
  demoNote.textContent = liveAvailable()
    ? "Live Firebase AI Logic is configured."
    : "Live mode is not set up on this device yet. Demo mode stays on for now.";
}

demoToggle.addEventListener("change", () => {
  if (!demoToggle.checked && !liveAvailable()) {
    demoToggle.checked = true;
    demoMode = true;
    demoNote.textContent =
      "Live mode needs a Firebase key first. Demo mode stays on for now.";
    refreshDemoUI();
    return;
  }
  demoMode = demoToggle.checked;
  refreshDemoUI();
});

function setTriageBadge(source, isDemo) {
  if (isDemo) {
    triageSource.textContent = "Demo, on-device (simulated)";
    triageSource.className = "badge badge-demo";
    return;
  }
  if (source === "FALLBACK") {
    triageSource.textContent = "On-device rules (fallback)";
    triageSource.className = "badge badge-fallback";
    return;
  }
  if (source === "ON_DEVICE") {
    triageSource.textContent = "On-device";
    triageSource.className = "badge badge-device";
  } else if (source === "IN_CLOUD") {
    triageSource.textContent = "Cloud (fallback)";
    triageSource.className = "badge badge-cloud";
  } else {
    triageSource.textContent = "Hybrid";
    triageSource.className = "badge badge-cloud";
  }
}

function setPlanBadge(source, isDemo) {
  if (isDemo) {
    planSource.textContent = "Demo, cloud (simulated)";
    planSource.className = "badge badge-demo";
    return;
  }
  if (source === "FALLBACK") {
    planSource.textContent = "On-device rules (fallback)";
    planSource.className = "badge badge-fallback";
    return;
  }
  if (source === "IN_CLOUD") {
    planSource.textContent = "Cloud";
    planSource.className = "badge badge-cloud";
  } else if (source === "ON_DEVICE") {
    planSource.textContent = "On-device (fallback)";
    planSource.className = "badge badge-device";
  } else {
    planSource.textContent = "Hybrid";
    planSource.className = "badge badge-cloud";
  }
}

// Staged loading steps that tick off while the AI call runs.
function startStagedSteps(listEl, stepMs) {
  const items = Array.from(listEl.children);
  items.forEach((li) => li.classList.remove("done", "active"));
  const timers = [];
  items.forEach((li, i) => {
    timers.push(
      window.setTimeout(() => {
        li.classList.add("active");
      }, i * stepMs)
    );
    if (i < items.length - 1) {
      timers.push(
        window.setTimeout(() => {
          li.classList.remove("active");
          li.classList.add("done");
        }, (i + 1) * stepMs)
      );
    }
  });
  return () => {
    timers.forEach((t) => window.clearTimeout(t));
    items.forEach((li) => {
      li.classList.remove("active");
      li.classList.add("done");
    });
  };
}

// Staggered reveal: banner first, then the cards below it.
function revealStaggered(nodes) {
  nodes.forEach((node, i) => {
    if (!node) return;
    node.classList.remove("reveal");
    void node.offsetWidth;
    node.style.animationDelay = i * 80 + "ms";
    node.classList.add("reveal");
  });
}

function truncateWords(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "...";
}

// Model output is never trusted as-is. Level is forced to a known value,
// defaulting to SOON when unknown, because under-triage is the dangerous
// direction. Text fields get a safe fallback, list fields become arrays.
const TRIAGE_LEVELS = ["ROUTINE", "SOON", "URGENT"];

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.trim().length > 0);
}

function validateTriage(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const level = TRIAGE_LEVELS.includes(data.level) ? data.level : "SOON";
  const summary =
    typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim()
      : "Triage result received. Ask the questions below and use your judgement.";
  return {
    level,
    summary,
    questions: asStringArray(data.questions).slice(0, 3),
    redFlags: asStringArray(data.redFlags),
    possibleCauses: asStringArray(data.possibleCauses).slice(0, 3),
  };
}

function validatePlan(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const steps = asStringArray(data.steps);
  if (steps.length === 0) return null;
  const differential = Array.isArray(data.differential)
    ? data.differential
        .filter((d) => d && (typeof d === "string" || typeof d.name === "string"))
        .slice(0, 3)
    : [];
  return {
    steps,
    differential,
    watchFor: asStringArray(data.watchFor),
    referral:
      typeof data.referral === "string" && data.referral.trim()
        ? data.referral.trim()
        : "Refer if any danger sign appears.",
    followUp:
      typeof data.followUp === "string" && data.followUp.trim()
        ? data.followUp.trim()
        : "Review in 2 days, or sooner if new symptoms appear.",
  };
}

function isTimeoutError(err) {
  return err && typeof err.message === "string" && /took too long/i.test(err.message);
}

function isForbiddenError(err) {
  return (
    err &&
    typeof err.message === "string" &&
    /403|PERMISSION_DENIED|API key not valid|blocked/i.test(err.message)
  );
}

// One plain message for a failed AI call, so the worker always knows what
// happened and what to do next.
function friendlyAiError(err, what) {
  if (!err || err.message === "cancelled") {
    return "Cancelled. You can try again when ready.";
  }
  if (err.message === "offline") {
    return "You are offline. This case is saved on the device, and the care plan will be added when you are back online.";
  }
  if (isTimeoutError(err)) {
    return "This is taking too long, try again.";
  }
  if (isForbiddenError(err)) {
    return "Live AI is not available from this address. Try demo mode, or check the API key allowlist.";
  }
  return (
    "The " +
    what +
    " failed: " +
    (err.message || "unknown error") +
    " Try again, or switch demo mode on."
  );
}

// Why this level: plain word bullets tied to what the worker entered.
function buildWhyBullets(patient, triage) {
  const bullets = [];
  const flags = triage.redFlags || [];
  flags.slice(0, 2).forEach((flag) => {
    bullets.push("Danger sign found: " + flag + ".");
  });
  if (flags.length === 0) {
    if (triage.level === "URGENT") {
      bullets.push("The symptoms you described need urgent attention.");
    } else if (triage.level === "SOON") {
      bullets.push("The symptoms you described need a clinician today.");
    } else {
      bullets.push("No danger signs were found in what you wrote.");
    }
  }
  if (patient.symptoms) {
    bullets.push("You wrote: " + truncateWords(patient.symptoms, 90));
  }
  const causes = triage.possibleCauses || [];
  if (causes.length > 0 && !/^not clear/i.test(causes[0])) {
    bullets.push("Possible cause to check first: " + causes[0] + ".");
  }
  return bullets.slice(0, 3);
}

function showTriageLoading() {
  triageCard.classList.remove("hidden");
  planCard.classList.add("hidden");
  triageContent.classList.add("hidden");
  triageLoading.classList.remove("hidden");
  triageLoading.setAttribute("aria-busy", "true");
  triageCard.scrollIntoView({ behavior: "smooth", block: "start" });
  return startStagedSteps(triageSteps, 1200);
}

function showTriage(c, triage, sourceLabel, isDemo) {
  triageLoading.classList.add("hidden");
  triageLoading.setAttribute("aria-busy", "false");
  triageContent.classList.remove("hidden");
  setTriageBadge(sourceLabel, isDemo);
  triageBanner.className =
    "triage-banner triage-banner-" + triage.level.toLowerCase();
  bannerShape.innerHTML = BANNER_SHAPES[triage.level] || BANNER_SHAPES.ROUTINE;
  triageLevel.textContent = triage.level;
  const meaning = LEVEL_MEANING[triage.level];
  triageMeaning.innerHTML = "";
  if (meaning) {
    triageMeaning.appendChild(document.createTextNode(meaning.text));
    triageMeaning.appendChild(
      el("span", meaning.action, "hl hl-" + triage.level.toLowerCase())
    );
  }
  const savedAt = c.createdAt ? new Date(c.createdAt) : null;
  triageReceipt.textContent =
    "Saved on this device" +
    (savedAt && !Number.isNaN(savedAt.getTime())
      ? ", " +
        savedAt.toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "") +
    ".";
  whyList.innerHTML = "";
  buildWhyBullets(c.patient, triage).forEach((b) => {
    whyList.appendChild(el("li", b));
  });
  triageSummary.textContent = triage.summary;
  redFlagList.innerHTML = "";
  if (triage.redFlags && triage.redFlags.length > 0) {
    redFlagBox.classList.remove("hidden");
    triage.redFlags.forEach((flag) => {
      redFlagList.appendChild(el("li", flag));
    });
  } else {
    redFlagBox.classList.add("hidden");
  }
  triageQuestions.innerHTML = "";
  (triage.questions || []).forEach((q) => {
    triageQuestions.appendChild(el("li", q));
  });
  reviewNote.textContent = "";
  reviewBtn.disabled = false;
  reviewBtn.textContent = "Ask a clinician to review";
  refreshCarePlanArea();
  revealStaggered([
    triageBanner,
    $("whyBox"),
    redFlagBox.classList.contains("hidden") ? null : redFlagBox,
    triageQuestions,
    $("carePlanArea"),
  ]);
  triageCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPlanLoading() {
  planCard.classList.remove("hidden");
  planContent.classList.add("hidden");
  planLoading.classList.remove("hidden");
  planLoading.setAttribute("aria-busy", "true");
  planCard.scrollIntoView({ behavior: "smooth", block: "start" });
  return startStagedSteps(planStepsLoading, 1400);
}

function showPlan(c, plan, sourceLabel, isDemo) {
  planLoading.classList.add("hidden");
  planLoading.setAttribute("aria-busy", "false");
  planContent.classList.remove("hidden");
  setPlanBadge(sourceLabel, isDemo);
  planSteps.innerHTML = "";
  (plan.steps || []).forEach((s) => {
    planSteps.appendChild(el("li", s));
  });
  planDifferential.innerHTML = "";
  (plan.differential || []).forEach((d) => {
    const name = typeof d === "string" ? d : d.name;
    const note = typeof d === "string" ? "" : d.note;
    const item = el("li", "");
    item.appendChild(el("strong", name));
    if (note) item.appendChild(document.createTextNode(" " + note));
    planDifferential.appendChild(item);
  });
  planWatch.innerHTML = "";
  const watch = plan.watchFor || plan.redFlags || [];
  if (watch.length === 0) {
    planWatch.appendChild(
      el("li", "Difficulty breathing, chest pain, fits, unconsciousness, bleeding that will not stop, or no urine.")
    );
  } else {
    watch.forEach((w) => {
      planWatch.appendChild(el("li", w));
    });
  }
  planReferral.textContent = plan.referral || "";
  planFollowUp.textContent = plan.followUp || "";
  reviewNote2.textContent = "";
  reviewBtn2.disabled = false;
  reviewBtn2.textContent = "Ask a clinician to review";
  refreshCarePlanArea();
  revealStaggered([planSteps, planDifferential, planWatch]);
  planCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function refreshCarePlanArea() {
  if (!currentCase) return;
  const plan = currentCase.carePlan;
  if (plan && plan.status === "ready") {
    carePlanBtn.classList.add("hidden");
    carePlanStatus.textContent = "Care plan ready. See below.";
    return;
  }
  carePlanBtn.classList.remove("hidden");
  if (!isOnline()) {
    if (demoMode) {
      carePlanBtn.disabled = false;
      carePlanStatus.textContent =
        "You are offline. The demo care plan works offline, tap the button to add it.";
    } else {
      carePlanBtn.disabled = true;
      carePlanStatus.textContent =
        "You are offline. This case is saved on the device, and the care plan will be added when you are back online.";
    }
  } else {
    carePlanBtn.disabled = false;
    if (plan && plan.status === "queued") {
      carePlanStatus.textContent = "Back online. Tap the button to add the care plan.";
    } else {
      carePlanStatus.textContent = "";
    }
  }
}

// Fetch and save the care plan for one case. When show is true the plan is
// displayed on screen, otherwise it is saved quietly in the background.
// Returns true when a ready plan was saved.
async function fetchCarePlanForCase(c, show) {
  if (!isOnline() && !demoMode) {
    c.carePlan = { status: "queued" };
    upsertCase(c);
    refreshCarePlanArea();
    return false;
  }
  let finishSteps = null;
  if (show) {
    carePlanBtn.disabled = true;
    carePlanStatus.textContent = "";
    finishSteps = showPlanLoading();
  }
  let cancelFn = null;
  const cancelPromise = new Promise((resolve, reject) => {
    cancelFn = () => reject(new Error("cancelled"));
  });
  if (show) currentCancelPlan = cancelFn;
  try {
    const work = runCarePlan(c.patient, c.triage);
    const out = show ? await Promise.race([work, cancelPromise]) : await work;
    if (finishSteps) finishSteps();
    const plan = Object.assign({}, out.plan, { status: "ready" });
    c.carePlan = plan;
    c.planSource = out.source;
    c.planDemo = out.isDemo;
    const saved = upsertCase(c);
    if (show) {
      showPlan(c, plan, out.source, out.isDemo);
      carePlanStatus.textContent = "";
      if (!saved) {
        carePlanStatus.textContent =
          "Could not save this case on the device, storage may be full. The care plan above is still shown.";
      }
    }
    return true;
  } catch (err) {
    if (finishSteps) finishSteps();
    if (show) planLoading.classList.add("hidden");
    const message = friendlyAiError(err, "care plan");
    if (show) {
      carePlanStatus.textContent = message;
      carePlanBtn.disabled = false;
    }
    return false;
  } finally {
    if (show) currentCancelPlan = null;
  }
}

// When the connection returns, add the care plan to every queued case.
async function syncQueuedCases() {
  if (!isOnline()) return;
  const queued = loadCases().filter(
    (c) => !c.carePlan || c.carePlan.status === "queued"
  );
  for (let i = 0; i < queued.length; i += 1) {
    const c = queued[i];
    const show = Boolean(currentCase && c.id === currentCase.id);
    await fetchCarePlanForCase(c, show);
  }
  renderCaseList();
  refreshCarePlanArea();
}

function newCaseId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fallbackTriageFromText(patient) {
  const t = demoTriage(patient);
  return {
    level: t.level,
    summary: t.summary + " (Live answer could not be read, so this summary comes from the on-device rules.)",
    questions: t.questions,
    redFlags: t.redFlags,
    possibleCauses: t.possibleCauses,
  };
}

async function runTriage(patient) {
  if (demoMode) {
    return { triage: demoTriage(patient), source: "DEMO", isDemo: true };
  }
  if (!isOnline()) {
    return { triage: fallbackTriageFromText(patient), source: "FALLBACK", isDemo: false };
  }
  try {
    const result = await liveTriage(patient, (val) => {
      const pct = Math.round(val * 100);
      assessStatus.textContent = "Preparing the on-device model, " + pct + "% downloaded.";
    });
    const triage = validateTriage(result.data);
    if (triage) {
      return { triage, source: result.source, isDemo: false };
    }
    return { triage: fallbackTriageFromText(patient), source: "FALLBACK", isDemo: false };
  } catch (err) {
    if (isTimeoutError(err)) throw err;
    return { triage: fallbackTriageFromText(patient), source: "FALLBACK", isDemo: false };
  }
}

async function runCarePlan(patient, triage) {
  if (demoMode) {
    return { plan: demoCarePlan(patient, triage), source: "DEMO", isDemo: true };
  }
  if (!isOnline()) {
    throw new Error("offline");
  }
  try {
    const result = await liveCarePlan(patient, triage);
    const plan = validatePlan(result.data);
    if (plan) {
      return { plan, source: result.source, isDemo: false };
    }
  } catch (err) {
    if (isTimeoutError(err)) throw err;
    // Any other live failure falls through to the rules plan below.
  }
  const demo = demoCarePlan(patient, triage);
  return {
    plan: {
      steps: demo.steps,
      differential: demo.differential,
      watchFor: [],
      referral: demo.referral,
      followUp: demo.followUp + " (Live answer could not be read, so this plan comes from the on-device rules.)",
    },
    source: "FALLBACK",
    isDemo: false,
  };
}

// Voice transcript as editable chips: tap the cross to remove one.
function renderVoiceChips() {
  voiceChips.innerHTML = "";
  voiceChips.classList.toggle("hidden", voiceSymptoms.length === 0);
  voiceSymptoms.forEach((text, idx) => {
    const chip = el("span", "", "symptom-chip");
    chip.appendChild(document.createTextNode(text));
    const remove = el("button", "×", "");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove " + text);
    remove.addEventListener("click", () => {
      voiceSymptoms.splice(idx, 1);
      renderVoiceChips();
    });
    chip.appendChild(remove);
    voiceChips.appendChild(chip);
  });
}

function addVoiceTranscript(said) {
  const parts = said
    .split(/[,;]/)
    .map((p) => p.trim().replace(/^[a-z]/, (c) => c.toUpperCase()))
    .filter((p) => p.length > 1);
  parts.forEach((p) => {
    const lower = p.toLowerCase();
    const exists =
      voiceSymptoms.some((s) => s.toLowerCase() === lower) ||
      symptoms.value.toLowerCase().includes(lower);
    if (!exists) voiceSymptoms.push(p);
  });
  renderVoiceChips();
  if (voiceSymptoms.length > 0) {
    voiceNote.textContent =
      "Check the symptoms above. Tap the cross to remove one, then tap Check on device.";
  }
}

caseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typed = symptoms.value.trim();
  const parts = [];
  if (typed) parts.push(typed);
  voiceSymptoms.forEach((s) => parts.push(s));
  const text = parts.join(", ").slice(0, 500);
  if (!text) {
    assessStatus.textContent = "Describe the symptoms first, or load a sample case.";
    symptoms.focus();
    return;
  }
  symptoms.value = text;
  voiceSymptoms = [];
  renderVoiceChips();
  const patient = {
    label: patientLabel.value.trim().slice(0, 40) || "Patient",
    ageGroup: ageGroup.value,
    symptoms: text,
  };
  assessBtn.disabled = true;
  assessStatus.textContent = "";
  const finishSteps = showTriageLoading();
  let cancelFn = null;
  const cancelPromise = new Promise((resolve, reject) => {
    cancelFn = () => reject(new Error("cancelled"));
  });
  currentCancelTriage = cancelFn;
  try {
    const out = await Promise.race([runTriage(patient), cancelPromise]);
    finishSteps();
    const c = {
      id: newCaseId(),
      createdAt: new Date().toISOString(),
      patient,
      triage: out.triage,
      triageSource: out.source,
      triageDemo: out.isDemo,
      carePlan: null,
    };
    currentCase = c;
    const saved = upsertCase(c);
    if (correctedCaseId && correctedCaseId !== c.id) {
      const remaining = loadCases().filter((x) => x.id !== correctedCaseId);
      saveCases(remaining);
      correctedCaseId = null;
      renderCaseList();
    }
    showTriage(c, out.triage, out.source, out.isDemo);
    assessStatus.textContent = saved
      ? ""
      : "Could not save this case on the device, storage may be full. The triage result above is still shown.";
  } catch (err) {
    finishSteps();
    triageLoading.classList.add("hidden");
    assessStatus.textContent = friendlyAiError(err, "on-device check");
  } finally {
    currentCancelTriage = null;
    assessBtn.disabled = false;
  }
});

carePlanBtn.addEventListener("click", async () => {
  if (!currentCase) return;
  await fetchCarePlanForCase(currentCase, true);
});

function markForReview(noteEl, btnEl) {
  if (!currentCase) return;
  currentCase.flaggedForReview = true;
  upsertCase(currentCase);
  noteEl.textContent =
    "Marked for clinician review. Show this case to a clinician when you see them.";
  btnEl.disabled = true;
  btnEl.textContent = "Marked for clinician review";
}

function correctCase() {
  if (currentCase) correctedCaseId = currentCase.id;
  triageCard.classList.add("hidden");
  planCard.classList.add("hidden");
  assessStatus.textContent =
    "Edit the symptoms above, then tap Check on device again.";
  symptoms.scrollIntoView({ behavior: "smooth", block: "center" });
  symptoms.focus();
}

reviewBtn.addEventListener("click", () => markForReview(reviewNote, reviewBtn));
reviewBtn2.addEventListener("click", () => markForReview(reviewNote2, reviewBtn2));
correctBtn.addEventListener("click", correctCase);
correctBtn2.addEventListener("click", correctCase);

function renderCaseList() {
  const cases = loadCases();
  caseList.innerHTML = "";
  caseCount.textContent = cases.length + (cases.length === 1 ? " case" : " cases");
  emptyCases.classList.toggle("hidden", cases.length > 0);
  cases.forEach((c) => {
    const card = el("div", "", "case-item");
    const head = el("div", "", "case-head");
    head.appendChild(el("strong", c.patient.label));
    const chip = el(
      "span",
      (LEVEL_ICON[c.triage.level] || "") + c.triage.level,
      "chip chip-" + c.triage.level.toLowerCase()
    );
    head.appendChild(chip);
    card.appendChild(head);
    card.appendChild(el("p", c.patient.ageGroup + " " + c.triage.summary, "case-summary"));
    const statusText = c.carePlan && c.carePlan.status === "ready"
      ? "Care plan ready"
      : c.carePlan && c.carePlan.status === "queued"
        ? "Care plan queued, waiting for signal"
        : "On-device triage only";
    const statusLine = statusText + (c.flaggedForReview ? ". Marked for clinician review" : "");
    card.appendChild(el("p", statusLine, "fine"));
    const actions = el("div", "", "row");
    const viewBtn = el("button", "View", "btn btn-ghost btn-small");
    viewBtn.type = "button";
    viewBtn.addEventListener("click", () => {
      correctedCaseId = null;
      currentCase = c;
      patientLabel.value = c.patient.label === "Patient" ? "" : c.patient.label;
      ageGroup.value = c.patient.ageGroup;
      symptoms.value = c.patient.symptoms;
      voiceSymptoms = [];
      renderVoiceChips();
      showTriage(c, c.triage, c.triageSource, c.triageDemo);
      if (c.carePlan && c.carePlan.status === "ready") {
        showPlan(c, c.carePlan, c.planSource, c.planDemo);
      } else {
        planCard.classList.add("hidden");
      }
    });
    actions.appendChild(viewBtn);
    if ((!c.carePlan || c.carePlan.status === "queued") && (isOnline() || demoMode)) {
      const syncBtn = el("button", "Sync care plan", "btn btn-small");
      syncBtn.type = "button";
      syncBtn.addEventListener("click", async () => {
        currentCase = c;
        await fetchCarePlanForCase(c, true);
      });
      actions.appendChild(syncBtn);
    }
    const delBtn = el("button", "Delete", "btn btn-ghost btn-small");
    delBtn.type = "button";
    delBtn.addEventListener("click", () => {
      const remaining = loadCases().filter((x) => x.id !== c.id);
      saveCases(remaining);
      if (currentCase && currentCase.id === c.id) {
        currentCase = null;
        triageCard.classList.add("hidden");
        planCard.classList.add("hidden");
      }
      renderCaseList();
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);
    caseList.appendChild(card);
  });
}

document.querySelectorAll(".chip-btn[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sample = SAMPLE_CASES[btn.dataset.sample];
    if (!sample) return;
    patientLabel.value = sample.label;
    ageGroup.value = sample.ageGroup;
    symptoms.value = sample.symptoms;
    voiceSymptoms = [];
    renderVoiceChips();
    symptoms.focus();
  });
});

document.querySelectorAll(".chip-btn[data-symptom]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const word = btn.dataset.symptom;
    const current = symptoms.value.trim();
    if (current.toLowerCase().includes(word.toLowerCase())) return;
    symptoms.value = current ? current + ", " + word : word;
    symptoms.focus();
  });
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  voiceBtn.disabled = true;
  voiceNote.textContent = "Voice input is not supported in this browser. Type the symptoms instead.";
} else {
  voiceBtn.addEventListener("click", () => {
    if (listening && currentRec) {
      currentRec.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-NG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    currentRec = rec;
    listening = true;
    voiceBtn.classList.add("listening");
    voiceBtn.querySelector("span").textContent = "Listening, tap to stop";
    voiceNote.textContent = "Speak now. Tap the button again to stop.";
    rec.onresult = (event) => {
      const said = event.results[0][0].transcript;
      addVoiceTranscript(said);
    };
    rec.onerror = () => {
      voiceNote.textContent = "Voice input did not work. Type the symptoms instead.";
    };
    rec.onend = () => {
      listening = false;
      currentRec = null;
      voiceBtn.classList.remove("listening");
      voiceBtn.querySelector("span").textContent = "Speak symptoms";
      if (!voiceNote.textContent || voiceNote.textContent === "Speak now. Tap the button again to stop.") {
        voiceNote.textContent = "";
      }
    };
    try {
      rec.start();
    } catch (err) {
      listening = false;
      currentRec = null;
      voiceBtn.classList.remove("listening");
      voiceBtn.querySelector("span").textContent = "Speak symptoms";
      voiceNote.textContent = "Voice input did not start. Type the symptoms instead.";
    }
  });
}

window.addEventListener("online", () => {
  refreshNetPill();
  syncQueuedCases();
});
window.addEventListener("offline", refreshNetPill);

triageCancelBtn.addEventListener("click", () => {
  if (currentCancelTriage) currentCancelTriage();
});

planCancelBtn.addEventListener("click", () => {
  if (currentCancelPlan) currentCancelPlan();
});

deleteAllBtn.addEventListener("click", () => {
  const cases = loadCases();
  if (cases.length === 0) return;
  if (!window.confirm("Delete all " + cases.length + " saved cases from this device? This cannot be undone.")) {
    return;
  }
  saveCases([]);
  correctedCaseId = null;
  currentCase = null;
  triageCard.classList.add("hidden");
  planCard.classList.add("hidden");
  renderCaseList();
});

// Register the service worker so the app shell loads offline. A failed
// registration must never break the app, so errors are ignored.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

refreshNetPill();
refreshDemoUI();
renderCaseList();
