// Demo mode engine for FieldCare.
// This is a small rule based simulation used only while demo mode is on.
// It lets the full flow be tried without a live AI connection. Every output
// it produces is labelled as a demo simulation in the UI. It is not a
// diagnosis and it does not replace the health worker's judgement.

const RED_FLAGS = [
  {
    id: "breathing",
    label: "Difficulty breathing or fast breathing",
    tests: [
      /\bdifficult(?:y)? breathing\b/,
      /\bcannot breathe\b/,
      /\bcan'?t breathe\b/,
      /\bfast breathing\b/,
      /\bshort of breath\b/,
      /\bgasping\b/,
      /\bstruggling to breathe\b/,
    ],
  },
  {
    id: "chest",
    label: "Chest pain",
    tests: [/\bchest pain\b/],
  },
  {
    id: "convulsion",
    label: "Convulsions or fits",
    tests: [/\bconvulsion/, /\bseizure\b/, /\bfit\b/, /\bfits\b/],
  },
  {
    id: "unconscious",
    label: "Unconscious, or very drowsy and hard to wake",
    tests: [
      /\bunconscious\b/,
      /\bcannot wake\b/,
      /\bcan'?t wake\b/,
      /\bwill not wake\b/,
      /\bwont wake\b/,
      /\bnot waking\b/,
      /\bcollapsed\b/,
    ],
  },
  {
    id: "bleeding",
    label: "Bleeding that will not stop",
    tests: [
      /\bbleeding heavily\b/,
      /\bbleeding a lot\b/,
      /\bblood loss\b/,
      /\bvomiting blood\b/,
      /\bcoughing blood\b/,
      /\bbleeding that will not stop\b/,
      /\bbleeding and will not stop\b/,
    ],
  },
  {
    id: "dehydration",
    label: "Signs of severe dehydration: no urine, very dry mouth, sunken eyes, or no tears when crying",
    tests: [
      /\bno urine\b/,
      /\bnot urinating\b/,
      /\bhas not urinated\b/,
      /\bsunken eyes\b/,
      /\bvery dry mouth\b/,
      /\bno tears\b/,
    ],
  },
  {
    id: "stiffneck",
    label: "High fever with a stiff neck",
    tests: [/\bstiff neck\b/],
  },
];

// Phrases where "no" means the symptom is absent. These are removed before
// matching, so "no fever" does not count as a fever. Phrases where absence
// itself is a danger sign, such as "no urine" or "no tears", are not in this
// list, because for those the absence is the finding.
const NEGATED_PHRASES = [
  "no fever",
  "no cough",
  "no diarrhoea",
  "no diarrhea",
  "no vomiting",
  "no rash",
  "no headache",
  "no sore throat",
  "no runny nose",
  "no pain",
  "no chills",
  "no sweating",
  "no bleeding",
  "no chest pain",
  "no difficulty breathing",
  "no fast breathing",
  "no stiff neck",
  "no fits",
  "no seizure",
  "no convulsion",
  "not bleeding",
  "not vomiting",
];

function stripNegations(text) {
  let cleaned = text;
  for (let i = 0; i < NEGATED_PHRASES.length; i += 1) {
    cleaned = cleaned.split(NEGATED_PHRASES[i]).join(" ");
  }
  return cleaned;
}

function has(text, re) {
  return re.test(text);
}

function findRedFlags(text) {
  const found = [];
  for (let i = 0; i < RED_FLAGS.length; i += 1) {
    const flag = RED_FLAGS[i];
    for (let j = 0; j < flag.tests.length; j += 1) {
      if (has(text, flag.tests[j])) {
        found.push(flag.label);
        break;
      }
    }
  }
  const pregnant = /\bpregnant\b/.test(text);
  if (
    pregnant &&
    (/\bswollen\b/.test(text) ||
      /\bswelling\b/.test(text) ||
      /\bheadache\b/.test(text) ||
      /\bblurred vision\b/.test(text) ||
      /\bbleeding\b/.test(text) ||
      /\bfit\b/.test(text) ||
      /\bseizure\b/.test(text) ||
      /\bconvulsion/.test(text))
  ) {
    found.push("Danger signs in pregnancy: swelling with headache, blurred vision, bleeding, or fits");
  }
  const baby = /\bbaby\b/.test(text) || /\binfant\b/.test(text);
  if (
    baby &&
    (/\bnot feeding\b/.test(text) ||
      /\brefuses to feed\b/.test(text) ||
      /\bwill not feed\b/.test(text) ||
      /\bnot breastfeeding\b/.test(text) ||
      /\brefusing to feed\b/.test(text))
  ) {
    found.push("A baby who will not feed");
  }
  return found;
}

const PATTERNS = [
  {
    id: "malaria",
    test: (t) =>
      /\bfever\b/.test(t) &&
      (/\bchills\b/.test(t) ||
        /\bshivering\b/.test(t) ||
        /\bsweating\b/.test(t) ||
        /\bheadache\b/.test(t)),
    level: "SOON",
    summary:
      "Fever with chills or headache. In this area, malaria is a likely cause and a malaria test is needed today.",
    questions: [
      "How many days has the fever lasted?",
      "Has the patient had a malaria test yet?",
      "Is the patient drinking fluids and eating?",
    ],
    possibleCauses: ["Malaria", "Viral fever", "Urinary infection"],
  },
  {
    id: "pneumonia",
    test: (t) => /\bcough\b/.test(t) && /\bfever\b/.test(t),
    level: "SOON",
    summary:
      "Cough with fever. This may be a chest infection such as pneumonia, so the patient needs review soon.",
    questions: [
      "How fast is the patient breathing? Count breaths for one minute.",
      "Is there chest pain or noisy breathing?",
      "How many days has the cough lasted?",
    ],
    possibleCauses: ["Pneumonia", "Malaria", "Bronchitis"],
  },
  {
    id: "diarrhoea",
    test: (t) => /\bdiarrh/.test(t) || /\brunning stomach\b/.test(t),
    level: "SOON",
    summary:
      "Diarrhoea, with a risk of dehydration. Give oral rehydration salts and watch fluid intake closely.",
    questions: [
      "How many times has the patient passed watery stool today?",
      "Is the patient vomiting as well?",
      "Is the patient passing urine normally?",
    ],
    possibleCauses: ["Gastroenteritis", "Food poisoning", "Cholera, when the stool is very watery"],
  },
  {
    id: "rashfever",
    test: (t) => /\brash\b/.test(t) && /\bfever\b/.test(t),
    level: "SOON",
    summary:
      "Fever with a rash. This needs review soon, and measles is one cause to keep in mind in this area.",
    questions: [
      "When did the rash start?",
      "Is there cough, red eyes, or a runny nose as well?",
      "Has the child had measles vaccination?",
    ],
    possibleCauses: ["Measles", "Viral rash", "Allergic reaction"],
  },
  {
    id: "headachefever",
    test: (t) => /\bheadache\b/.test(t) && /\bfever\b/.test(t),
    level: "SOON",
    summary:
      "Headache with fever. This needs review soon to rule out a serious infection.",
    questions: [
      "How high is the fever, and how long has it lasted?",
      "Is the neck stiff, or is there vomiting?",
      "Is the patient sensitive to light?",
    ],
    possibleCauses: ["Malaria", "Viral fever", "Meningitis, when there is a stiff neck"],
  },
  {
    id: "severepain",
    test: (t) =>
      /\bsevere\b/.test(t) &&
      (/\bstomach\b/.test(t) || /\babdominal\b/.test(t) || /\bbelly\b/.test(t)),
    level: "SOON",
    summary:
      "Severe stomach pain. This needs review soon, because some causes need urgent care.",
    questions: [
      "Where exactly is the pain, and when did it start?",
      "Is there vomiting, fever, or blood in the stool?",
      "Can the patient pass urine and stool normally?",
    ],
    possibleCauses: ["Severe stomach infection", "Appendicitis", "Urinary infection"],
  },
  {
    id: "mildcold",
    test: (t) =>
      /\bcough\b/.test(t) &&
      (/\bsore throat\b/.test(t) || /\brunny nose\b/.test(t)) &&
      !/\bfever\b/.test(t),
    level: "ROUTINE",
    summary:
      "Mild cough with a sore throat and no fever. This looks like a common cold and can be managed at home for now.",
    questions: [
      "How many days has the cough lasted?",
      "Is the patient eating and drinking normally?",
      "Is anyone else at home unwell with the same symptoms?",
    ],
    possibleCauses: ["Common cold", "Throat infection", "Allergy"],
  },
  {
    id: "mildpain",
    test: (t) =>
      (/\bstomach\b/.test(t) || /\babdominal\b/.test(t) || /\bbelly\b/.test(t)) &&
      !/\bsevere\b/.test(t),
    level: "ROUTINE",
    summary:
      "Mild stomach pain with no danger signs. This can be watched at home for now, with clear advice on when to return.",
    questions: [
      "When did the pain start, and what makes it worse?",
      "Is there vomiting or diarrhoea as well?",
      "Has the patient eaten anything unusual?",
    ],
    possibleCauses: ["Mild stomach upset", "Gas", "Early infection"],
  },
];

const DEFAULT_TRIAGE = {
  level: "ROUTINE",
  summary:
    "These symptoms do not match a clear pattern. Ask the questions below, watch the patient, and use your judgement. When in doubt, refer.",
  questions: [
    "How many days has this been going on?",
    "Is the patient eating and drinking normally?",
    "Has the patient had this problem before?",
  ],
  possibleCauses: ["Not clear from these symptoms", "Needs more questions", "Ask a senior health worker"],
};

export function demoTriage(patient) {
  const text = stripNegations((" " + patient.symptoms + " ").toLowerCase());
  const redFlags = findRedFlags(text);
  if (redFlags.length > 0) {
    return {
      level: "URGENT",
      summary:
        "Danger signs are present. This patient needs urgent referral now. Do not wait for a care plan.",
      questions: [
        "When did the danger sign start?",
        "Is the patient breathing normally right now?",
        "Can the patient be taken to the nearest health centre at once?",
      ],
      redFlags,
      possibleCauses: [],
    };
  }
  for (let i = 0; i < PATTERNS.length; i += 1) {
    if (PATTERNS[i].test(text)) {
      const p = PATTERNS[i];
      return {
        level: p.level,
        summary: p.summary,
        questions: p.questions,
        redFlags: [],
        possibleCauses: p.possibleCauses,
      };
    }
  }
  return {
    level: DEFAULT_TRIAGE.level,
    summary: DEFAULT_TRIAGE.summary,
    questions: DEFAULT_TRIAGE.questions,
    redFlags: [],
    possibleCauses: DEFAULT_TRIAGE.possibleCauses,
  };
}

const PLAN_LIBRARY = {
  malaria: {
    steps: [
      "Do a malaria test today. Do not guess.",
      "Give paracetamol for the fever, following the dose for the patient's age.",
      "Encourage fluids, small sips often.",
      "If the malaria test is positive, start treatment following the national protocol and tell the patient to finish the full course.",
      "Keep the patient warm during chills and cool during high fever.",
    ],
    differential: [
      { name: "Malaria", note: "Fever with chills is common here. A test confirms it." },
      { name: "Viral fever", note: "Fever without a clear focus, often settles in a few days." },
      { name: "Urinary infection", note: "Fever with pain when passing urine, or back pain." },
    ],
    referral: "Refer at once if there are convulsions, very high fever that will not come down, vomiting that stops all fluids, or the patient becomes drowsy.",
    followUp: "Review in 2 days, or sooner if the fever rises or new symptoms appear.",
  },
  pneumonia: {
    steps: [
      "Count the breathing rate for one full minute and write it down.",
      "Listen for noisy breathing and check for chest indrawing.",
      "Give paracetamol for the fever, following the dose for the patient's age.",
      "Encourage fluids and rest.",
      "If fast breathing or chest indrawing is present, refer at once. Do not wait.",
    ],
    differential: [
      { name: "Pneumonia", note: "Cough with fever and fast breathing." },
      { name: "Malaria", note: "Fever with cough can also be malaria. Test when in doubt." },
      { name: "Bronchitis", note: "Cough with noisy breathing, often after a cold." },
    ],
    referral: "Refer at once for fast breathing, chest indrawing, blue lips, or inability to drink.",
    followUp: "Review in 2 days, or sooner if breathing gets worse.",
  },
  diarrhoea: {
    steps: [
      "Start oral rehydration salts at once. Small sips, often.",
      "Continue feeding. Do not stop food.",
      "Give zinc for children under 5, following the local protocol.",
      "Keep the patient clean and wash hands after toileting.",
      "Write down how many stools and vomits happen each day.",
    ],
    differential: [
      { name: "Gastroenteritis", note: "Diarrhoea with or without vomiting, often from food or water." },
      { name: "Food poisoning", note: "Sudden diarrhoea after a shared meal." },
      { name: "Cholera", note: "Very watery diarrhoea in large amounts. Report it and refer at once." },
    ],
    referral: "Refer at once for no urine, sunken eyes, no tears when crying, very weak, or blood in the stool.",
    followUp: "Review in 1 day, or sooner if the patient cannot keep fluids down.",
  },
  rashfever: {
    steps: [
      "Check the temperature and write it down.",
      "Keep the patient away from other children until reviewed.",
      "Give paracetamol for the fever, following the dose for the patient's age.",
      "Encourage fluids and rest.",
      "Ask about measles vaccination and write the answer down.",
    ],
    differential: [
      { name: "Measles", note: "Fever, rash, cough, red eyes. Needs review and isolation." },
      { name: "Viral rash", note: "Rash with mild fever, often settles on its own." },
      { name: "Allergic reaction", note: "Rash after a new food or medicine, often itchy." },
    ],
    referral: "Refer at once for difficulty breathing, swelling of the face or tongue, or a very sick child.",
    followUp: "Review in 2 days, or sooner if the rash spreads fast or the fever rises.",
  },
  headachefever: {
    steps: [
      "Check the temperature and write it down.",
      "Check for a stiff neck and sensitivity to light.",
      "Give paracetamol for the fever and pain, following the dose for the patient's age.",
      "Encourage fluids and rest in a quiet, dark room.",
      "Do a malaria test, because malaria is common here.",
    ],
    differential: [
      { name: "Malaria", note: "Fever with headache is common here. Test to confirm." },
      { name: "Viral fever", note: "Headache with fever, often settles in a few days." },
      { name: "Meningitis", note: "Fever with a stiff neck or vomiting. Refer at once." },
    ],
    referral: "Refer at once for a stiff neck, repeated vomiting, confusion, or fits.",
    followUp: "Review in 1 day, or sooner if the headache worsens.",
  },
  severepain: {
    steps: [
      "Ask where the pain is and when it started. Write it down.",
      "Check for fever, vomiting, and blood in the stool.",
      "Do not give strong pain medicine before review, because it can hide the signs.",
      "Encourage small sips of water if the patient can keep fluids down.",
      "Prepare for referral, because severe stomach pain often needs a doctor.",
    ],
    differential: [
      { name: "Severe stomach infection", note: "Pain with fever and vomiting." },
      { name: "Appendicitis", note: "Pain that moves to the lower right side and gets worse." },
      { name: "Urinary infection", note: "Pain low in the belly with pain when passing urine." },
    ],
    referral: "Refer at once for severe pain, a hard belly, vomiting blood, or blood in the stool.",
    followUp: "Review the same day if the pain does not ease.",
  },
  mildcold: {
    steps: [
      "Give warm fluids and rest.",
      "Keep the patient away from smoke and dust.",
      "Honey and warm water can soothe a sore throat for children over 1 year.",
      "Do not give antibiotics for a common cold.",
      "Write down the symptoms and the date, so change is easy to see.",
    ],
    differential: [
      { name: "Common cold", note: "Mild cough and sore throat, no fever." },
      { name: "Throat infection", note: "Sore throat with pain when swallowing." },
      { name: "Allergy", note: "Cough and runny nose that come and go." },
    ],
    referral: "Refer if a fever starts, breathing becomes fast or noisy, or the cough lasts more than 2 weeks.",
    followUp: "Review in 3 days if the cough is still there.",
  },
  mildpain: {
    steps: [
      "Ask what the patient ate and when the pain started.",
      "Give small sips of water and light food.",
      "Avoid spicy food and fizzy drinks for now.",
      "Write down the symptoms and the date.",
      "Tell the patient to return if the pain gets worse.",
    ],
    differential: [
      { name: "Mild stomach upset", note: "Pain after food, settles on its own." },
      { name: "Gas", note: "Pain that comes and goes, with bloating." },
      { name: "Early infection", note: "Pain that may grow into diarrhoea or vomiting." },
    ],
    referral: "Refer if the pain becomes severe, there is vomiting or blood in the stool, or a fever starts.",
    followUp: "Review in 2 days if the pain is still there.",
  },
  urgent: {
    steps: [
      "Refer the patient to the nearest health centre at once. Do not wait.",
      "Keep the airway clear and keep the patient on their side if unconscious.",
      "Do not give food or drink to an unconscious patient.",
      "Write down the danger signs and the time they started.",
      "Send someone ahead to tell the health centre a patient is coming.",
    ],
    differential: [
      { name: "Cause not known here, a doctor must review the patient.", note: "" },
    ],
    referral: "Refer now. This is urgent.",
    followUp: "Follow up at the health centre after referral.",
  },
  soonDefault: {
    steps: [
      "Do a malaria test today. Do not guess.",
      "Check the temperature and breathing, and write both down.",
      "Give paracetamol for fever or pain, following the dose for the patient's age.",
      "Encourage fluids, small sips often.",
      "Tell the patient to return today if the symptoms get worse.",
    ],
    differential: [
      { name: "Cause not clear from these symptoms", note: "A malaria test and review today will narrow it down." },
    ],
    referral: "Refer at once if any danger sign appears, or if the patient is not improving by tomorrow.",
    followUp: "Review tomorrow, or sooner if new symptoms appear.",
  },
  default: {
    steps: [
      "Ask the three questions from the triage result and write the answers down.",
      "Check temperature and breathing, and write both down.",
      "Give simple advice for the main symptom and tell the patient what to watch for.",
      "Ask a senior health worker when the picture is not clear.",
      "Tell the patient when to return.",
    ],
    differential: [
      { name: "Not clear from these symptoms", note: "More questions are needed." },
      { name: "Needs more questions", note: "The pattern will show with more detail." },
      { name: "Ask a senior health worker", note: "A second view helps when the picture is unclear." },
    ],
    referral: "Refer if any danger sign appears, or if the patient is not improving in 2 days.",
    followUp: "Review in 2 days, or sooner if new symptoms appear.",
  },
};

export function demoCarePlan(patient, triage) {
  const text = stripNegations((" " + patient.symptoms + " ").toLowerCase());
  if (triage.level === "URGENT") {
    return PLAN_LIBRARY.urgent;
  }
  for (let i = 0; i < PATTERNS.length; i += 1) {
    if (PATTERNS[i].test(text)) {
      return PLAN_LIBRARY[PATTERNS[i].id] || PLAN_LIBRARY.default;
    }
  }
  if (triage.level === "SOON") {
    return PLAN_LIBRARY.soonDefault;
  }
  return PLAN_LIBRARY.default;
}

export const SAMPLE_CASES = {
  routine: {
    label: "Bola, 9 years",
    ageGroup: "5 to 17 years",
    symptoms: "Mild cough for 2 days, slight sore throat, no fever. Playing normally and eating well.",
  },
  malaria: {
    label: "Amina, 4 years",
    ageGroup: "Under 5 years",
    symptoms: "Fever for 3 days, chills and shivering at night, headache, vomiting once. Drinking water but eating very little.",
  },
  dehydration: {
    label: "Chinedu, 2 years",
    ageGroup: "Under 5 years",
    symptoms: "Diarrhoea 5 times today, vomiting twice, dry mouth, no tears when crying, very weak.",
  },
  pregnancy: {
    label: "Mrs. Okafor, 28 years, 7 months pregnant",
    ageGroup: "18 to 49 years",
    symptoms: "Headache for 2 days, swollen face and hands, blurred vision. She is 7 months pregnant.",
  },
};
