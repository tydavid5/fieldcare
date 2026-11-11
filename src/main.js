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
const triageContent = $("triageContent");
const triageSource = $("triageSource");
const triageBanner = $("triageBanner");
const bannerShape = $("bannerShape");
const triageLevel = $("triageLevel");
const triageMeaning = $("triageMeaning");
const whyList = $("whyList");
const triageSummary = $("triageSummary");
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

let demoMode = !liveAvailable();
let currentCase = null;
let voiceSymptoms = [];
let listening = false;
let currentRec = null;

// Triage wording: colour plus shape plus word plus action, never colour alone.
const LEVEL_MEANING = {
  URGENT: "Urgent, get help now.",
  SOON: "Soon, see a clinician today.",
  ROUTINE: "Routine, can wait.",
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
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveCases(cases) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cases));
}

function upsertCase(updated) {
  const cases = loadCases();
  const idx = cases.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cases[idx] = updated;
  } else {
    cases.unshift(updated);
  }
  saveCases(cases);
  renderCaseList();
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

// Why this level: plain word bullets tied to what the worker entered.
function buildWhyBullets(patient, triage) {
  const bullets = [];
  const flags = triage.redFlags || [];
  flags.slice(0, 2).forEach((flag) => {
    bullets.push("Danger sign found: " + flag + ".");
  });
  if (flags.length === 0) {
    bullets.push("No danger signs were found in what you wrote.");
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
  triageMeaning.textContent = LEVEL_MEANING[triage.level] || "";
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
    carePlanBtn.disabled = true;
    carePlanStatus.textContent =
      "You are offline. This case is saved on the device, and the care plan will be added when you are back online.";
  } else {
    carePlanBtn.disabled = false;
    if (plan && plan.status === "queued") {
      carePlanStatus.textContent = "Back online. Tap the button to add the care plan.";
    } else {
      carePlanStatus.textContent = "";
    }
  }
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
  const result = await liveTriage(patient, (val) => {
    const pct = Math.round(val * 100);
    assessStatus.textContent = "Preparing the on-device model, " + pct + "% downloaded.";
  });
  if (result.data && result.data.level) {
    return { triage: result.data, source: result.source, isDemo: false };
  }
  return { triage: fallbackTriageFromText(patient), source: result.source, isDemo: false };
}

async function runCarePlan(patient, triage) {
  if (demoMode) {
    return { plan: demoCarePlan(patient, triage), source: "DEMO", isDemo: true };
  }
  const result = await liveCarePlan(patient, triage);
  if (result.data && result.data.steps) {
    return { plan: result.data, source: result.source, isDemo: false };
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
    source: result.source,
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
    .split(/[,;]|\band\b/i)
    .map((p) => p.trim().replace(/^[a-z]/, (c) => c))
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
  const text = parts.join(", ");
  if (!text) {
    assessStatus.textContent = "Describe the symptoms first, or load a sample case.";
    symptoms.focus();
    return;
  }
  symptoms.value = text;
  voiceSymptoms = [];
  renderVoiceChips();
  const patient = {
    label: patientLabel.value.trim() || "Patient",
    ageGroup: ageGroup.value,
    symptoms: text,
  };
  assessBtn.disabled = true;
  assessStatus.textContent = "";
  const finishSteps = showTriageLoading();
  try {
    const out = await runTriage(patient);
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
    upsertCase(c);
    showTriage(c, out.triage, out.source, out.isDemo);
    assessStatus.textContent = "";
  } catch (err) {
    finishSteps();
    triageLoading.classList.add("hidden");
    assessStatus.textContent =
      "The on-device check failed: " + err.message + " Try again, or switch demo mode on.";
  } finally {
    assessBtn.disabled = false;
  }
});

carePlanBtn.addEventListener("click", async () => {
  if (!currentCase) return;
  if (!isOnline()) {
    currentCase.carePlan = { status: "queued" };
    upsertCase(currentCase);
    refreshCarePlanArea();
    return;
  }
  carePlanBtn.disabled = true;
  carePlanStatus.textContent = "";
  const finishSteps = showPlanLoading();
  try {
    const out = await runCarePlan(currentCase.patient, currentCase.triage);
    finishSteps();
    const plan = Object.assign({}, out.plan, { status: "ready" });
    currentCase.carePlan = plan;
    currentCase.planSource = out.source;
    currentCase.planDemo = out.isDemo;
    upsertCase(currentCase);
    showPlan(currentCase, plan, out.source, out.isDemo);
    carePlanStatus.textContent = "";
  } catch (err) {
    finishSteps();
    planLoading.classList.add("hidden");
    carePlanStatus.textContent = "The care plan failed: " + err.message + " Try again.";
    carePlanBtn.disabled = false;
  }
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
    if ((!c.carePlan || c.carePlan.status === "queued") && isOnline()) {
      const syncBtn = el("button", "Sync care plan", "btn btn-small");
      syncBtn.type = "button";
      syncBtn.addEventListener("click", async () => {
        currentCase = c;
        carePlanBtn.click();
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

window.addEventListener("online", refreshNetPill);
window.addEventListener("offline", refreshNetPill);

refreshNetPill();
refreshDemoUI();
renderCaseList();
