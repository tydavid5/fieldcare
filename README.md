# FieldCare

Community health workers in Nigerian villages have no signal and no doctor nearby, so they need a triage assistant that works fully offline and gets smarter when it finds signal.

## How it works

A health worker speaks or types a patient's symptoms. FieldCare then runs two steps.

1. On-device triage, offline. Gemini Nano, through Firebase AI Logic, summarises the symptoms, suggests triage questions, and assigns a triage level: routine, soon, or urgent. This step runs on the device, so it works with no signal and patient details stay on the device.
2. Cloud care plan, when online. When the device finds signal, Gemini Flash, through Firebase AI Logic, adds a fuller care plan, a short list of possible causes, and danger signs to watch for.

Cases assessed offline are saved on the device in an offline queue. The care plan is added when the connection returns.

FieldCare is a triage aid, not a diagnosis. The health worker makes the final call. Any danger sign means urgent referral at once.

## Demo mode

Demo mode is on by default. The triage and care plan answers are simulated with realistic examples, so the full flow can be tried without a live AI connection. Every demo answer is labelled as a simulation, and the on-device and cloud steps are labelled so you can see where each answer would come from.

On-device Gemini Nano needs Chrome on Desktop version 139 or higher, with the on-device model downloaded. It is not available on most phones yet, which is why demo mode is the default.

## Go live with Firebase AI Logic

1. Create a Firebase project in the Firebase console.
2. Go to AI Services, then AI Logic, and click Get started. Choose the Gemini Developer API as the provider.
3. Register this web app in the Firebase console and copy its Firebase config.
4. Paste the config into `src/config.js`, replacing the placeholder values.
5. Run the app and turn demo mode off in the header. Triage then runs through Firebase AI Logic with `PREFER_ON_DEVICE`, and the care plan uses `PREFER_IN_CLOUD`. Each answer shows its source, read from `response.inferenceSource`.

Note: when App Check is enforced for AI Logic, local development needs the App Check debug provider. See the Firebase AI Logic docs for the steps.

## Run it locally

```
npm install
npm run dev
```

Then open the local address shown in the terminal.

## Deploy

The app is a Vite static site. Deploy it with the Vercel CLI and choose the production deploy when asked, or connect the repo to Vercel and let it build on every push.

## Tech

- Vite and plain JavaScript, no framework
- Firebase AI Logic, Gemini Nano on-device and Gemini Flash in the cloud
- Web Speech API for voice input
- localStorage for the offline case queue

All AI inference goes through Firebase AI Logic. No other model API is called.

## Hackathon

Built for #BuildHybridAI 2026 on Devpost. The entry uses Firebase AI Logic hybrid inference: on-device when available, cloud as fallback, with the source shown for every answer.

## License

MIT. See LICENSE.
