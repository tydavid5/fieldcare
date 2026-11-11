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
const assessBtn = $("assessBtn");
const assessStatus = $("assessStatus");
const triageCard = $("triageCard");
const triageSource = $("triageSource");
const triageLevel = $("triageLevel");
const triageMeaning = $("triageMeaning");
const triageSummary = $("triageSummary");
const redFlagBox = $("redFlagBox");
const redFlagList = $("redFlagList");
const triageQuestions = $("triageQuestions");
const carePlanBtn = $("carePlanBtn");
const carePlanStatus = $("carePlanStatus");
const planCard = $("planCard");
const planSource = $("planSource");
const planSteps = $("planSteps");
const planDifferential = $("planDifferential");
const planWatch = $("planWatch");
const planReferral = $("planReferral");
const planFollowUp = $("planFollowUp");
const caseList = $("caseList");
const caseCount = $("caseCount");
const emptyCases = $("emptyCases");

let demoMode = !liveAvailable();
let currentCase = null;

const LEVEL_MEANING = {
  URGENT: "Urgent. Refer now. Do not wait.",
  SOON: "Soon. Review today, within a few hours.",
  ROUTINE: "Routine. Manage at home for now, and review if it gets worse.",
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
}

demoToggle.addEventListener("change", () => {
  if (!demoToggle.checked && !liveAvailable()) {
    demoToggle.checked = true;
    demoMode = true;
    demoNote.textContent =
      "Live mode needs a real Firebase config first. Add it in src/config.js, then turn demo mode off. Demo mode stays on for now.";
    refreshDemoUI();
    return;
  }
  demoMode = demoToggle.checked;
  demoNote.textContent = liveAvailable()
    ? "Live Firebase AI Logic is configured."
    : "To use live Firebase AI Logic, add a real Firebase config in src/config.js and turn demo mode off. See the README for the steps.";
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

function showTriage(c, triage, sourceLabel, isDemo) {
  triageCard.classList.remove("hidden");
  setTriageBadge(sourceLabel, isDemo);
  triageLevel.textContent = triage.level;
  triageLevel.className = "level level-" + triage.level.toLowerCase();
  triageMeaning.textContent = LEVEL_MEANING[triage.level] || "";
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
  refreshCarePlanArea();
  triageCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPlan(c, plan, sourceLabel, isDemo) {
  planCard.classList.remove("hidden");
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
  refreshCarePlanArea();
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

caseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = symptoms.value.trim();
  if (!text) {
    assessStatus.textContent = "Describe the symptoms first, or load a sample case.";
    symptoms.focus();
    return;
  }
  const patient = {
    label: patientLabel.value.trim() || "Patient",
    ageGroup: ageGroup.value,
    symptoms: text,
  };
  assessBtn.disabled = true;
  assessStatus.textContent = demoMode
    ? "Checking on device (demo simulation)..."
    : "Checking on device with Firebase AI Logic...";
  try {
    const out = await runTriage(patient);
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
  carePlanStatus.textContent = demoMode
    ? "Getting the care plan from the cloud (demo simulation)..."
    : "Getting the care plan from the cloud with Firebase AI Logic...";
  try {
    const out = await runCarePlan(currentCase.patient, currentCase.triage);
    const plan = Object.assign({}, out.plan, { status: "ready" });
    currentCase.carePlan = plan;
    currentCase.planSource = out.source;
    currentCase.planDemo = out.isDemo;
    upsertCase(currentCase);
    showPlan(currentCase, plan, out.source, out.isDemo);
    carePlanStatus.textContent = "";
  } catch (err) {
    carePlanStatus.textContent = "The care plan failed: " + err.message + " Try again.";
    carePlanBtn.disabled = false;
  }
});

function renderCaseList() {
  const cases = loadCases();
  caseList.innerHTML = "";
  caseCount.textContent = cases.length + (cases.length === 1 ? " case" : " cases");
  emptyCases.classList.toggle("hidden", cases.length > 0);
  cases.forEach((c) => {
    const card = el("div", "", "case-item");
    const head = el("div", "", "case-head");
    head.appendChild(el("strong", c.patient.label));
    const chip = el("span", c.triage.level, "chip chip-" + c.triage.level.toLowerCase());
    head.appendChild(chip);
    card.appendChild(head);
    card.appendChild(el("p", c.patient.ageGroup + " " + c.triage.summary, "case-summary"));
    const statusText = c.carePlan && c.carePlan.status === "ready"
      ? "Care plan ready"
      : c.carePlan && c.carePlan.status === "queued"
        ? "Care plan queued, waiting for signal"
        : "On-device triage only";
    card.appendChild(el("p", statusText, "fine"));
    const actions = el("div", "", "row");
    const viewBtn = el("button", "View", "btn btn-ghost btn-small");
    viewBtn.type = "button";
    viewBtn.addEventListener("click", () => {
      currentCase = c;
      patientLabel.value = c.patient.label === "Patient" ? "" : c.patient.label;
      ageGroup.value = c.patient.ageGroup;
      symptoms.value = c.patient.symptoms;
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

document.querySelectorAll(".chip-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const sample = SAMPLE_CASES[btn.dataset.sample];
    if (!sample) return;
    patientLabel.value = sample.label;
    ageGroup.value = sample.ageGroup;
    symptoms.value = sample.symptoms;
    symptoms.focus();
  });
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  voiceBtn.disabled = true;
  voiceNote.textContent = "Voice input is not supported in this browser. Type the symptoms instead.";
} else {
  voiceBtn.addEventListener("click", () => {
    const rec = new SpeechRecognition();
    rec.lang = "en-NG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    voiceBtn.disabled = true;
    voiceBtn.textContent = "Listening...";
    voiceNote.textContent = "Speak now. Tap the button again to stop.";
    rec.onresult = (event) => {
      const said = event.results[0][0].transcript;
      symptoms.value = symptoms.value ? symptoms.value + " " + said : said;
    };
    rec.onerror = () => {
      voiceNote.textContent = "Voice input did not work. Type the symptoms instead.";
    };
    rec.onend = () => {
      voiceBtn.disabled = false;
      voiceBtn.textContent = "Speak symptoms";
      voiceNote.textContent = "";
    };
    try {
      rec.start();
    } catch (err) {
      voiceBtn.disabled = false;
      voiceBtn.textContent = "Speak symptoms";
      voiceNote.textContent = "Voice input did not start. Type the symptoms instead.";
    }
  });
}

window.addEventListener("online", refreshNetPill);
window.addEventListener("offline", refreshNetPill);

refreshNetPill();
refreshDemoUI();
renderCaseList();
