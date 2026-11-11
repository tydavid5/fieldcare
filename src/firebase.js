// Live Firebase AI Logic calls for FieldCare.
// All AI inference goes through Firebase AI Logic. No other model API is used.
// Triage uses PREFER_ON_DEVICE, so Gemini Nano answers when it is available
// and the SDK falls back to the cloud model otherwise. The care plan uses
// PREFER_IN_CLOUD, so Gemini Flash answers when online and the SDK falls back
// to the on-device model when offline. Each response reports its source in
// response.inferenceSource, either ON_DEVICE or IN_CLOUD.

import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import { firebaseConfig, isConfigured } from "./config.js";

let app = null;
let ai = null;

function getAiService() {
  if (!isConfigured()) {
    throw new Error("Firebase is not configured yet.");
  }
  if (!ai) {
    app = initializeApp(firebaseConfig);
    ai = getAI(app, { backend: new GoogleAIBackend() });
  }
  return ai;
}

function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

function sourceOf(response) {
  const src = response && response.inferenceSource;
  if (src === "ON_DEVICE") return "ON_DEVICE";
  if (src === "IN_CLOUD") return "IN_CLOUD";
  return "UNKNOWN";
}

export function liveAvailable() {
  return isConfigured();
}

// Start the on-device model download. Must be called after a user tap and
// before the first triage request. The callback receives download progress
// as a number from 0 to 1.
export async function prepareOnDeviceModel(onProgress) {
  const service = getAiService();
  const model = getGenerativeModel(service, {
    model: "gemini-3.5-flash-lite",
    mode: InferenceMode.PREFER_ON_DEVICE,
  });
  model.initializeDeviceModel((val) => {
    if (typeof onProgress === "function") onProgress(val);
  });
  return model;
}

const TRIAGE_INSTRUCTIONS =
  "You are a triage assistant for a community health worker in rural Nigeria. " +
  "Read the patient details and symptoms. Return ONLY a JSON object with these fields: " +
  "level, one of ROUTINE, SOON, URGENT; " +
  "summary, one plain sentence; " +
  "questions, an array of 3 short questions to ask the patient; " +
  "redFlags, an array of danger signs found, empty when there are none; " +
  "possibleCauses, an array of up to 3 short possible causes. " +
  "Use plain language. Do not give a diagnosis. The health worker makes the final call.";

export async function liveTriage(patient, onProgress) {
  const service = getAiService();
  const model = getGenerativeModel(service, {
    model: "gemini-3.5-flash-lite",
    mode: InferenceMode.PREFER_ON_DEVICE,
    generationConfig: { responseMimeType: "application/json" },
  });
  model.initializeDeviceModel((val) => {
    if (typeof onProgress === "function") onProgress(val);
  });
  const prompt =
    TRIAGE_INSTRUCTIONS +
    " Patient: " +
    patient.label +
    ", age group " +
    patient.ageGroup +
    ". Symptoms: " +
    patient.symptoms;
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const data = parseJson(text);
  return { source: sourceOf(response), data, rawText: text };
}

const PLAN_INSTRUCTIONS =
  "You are a clinical support assistant for a community health worker in rural Nigeria. " +
  "Read the patient details, symptoms and triage result. Return ONLY a JSON object with these fields: " +
  "steps, an array of short action steps in plain language; " +
  "differential, an array of up to 3 objects with name and note; " +
  "watchFor, an array of danger signs to watch for; " +
  "referral, one sentence on when to refer the patient; " +
  "followUp, one sentence on when to review the patient. " +
  "Use plain language and Nigerian primary care context, for example a malaria test, oral rehydration salts, and referral to the nearest health centre. " +
  "Do not give a diagnosis. The health worker makes the final call.";

export async function liveCarePlan(patient, triage) {
  const service = getAiService();
  const model = getGenerativeModel(service, {
    model: "gemini-3.5-flash-lite",
    mode: InferenceMode.PREFER_IN_CLOUD,
    generationConfig: { responseMimeType: "application/json" },
  });
  const prompt =
    PLAN_INSTRUCTIONS +
    " Patient: " +
    patient.label +
    ", age group " +
    patient.ageGroup +
    ". Symptoms: " +
    patient.symptoms +
    ". Triage level: " +
    triage.level +
    ". Triage summary: " +
    triage.summary;
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const data = parseJson(text);
  return { source: sourceOf(response), data, rawText: text };
}
