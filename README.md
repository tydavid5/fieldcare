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
4. Set the Firebase config as environment variables in your host (see "API key and restrictions" below). The API key is never committed to this repo.
5. Run the app and turn demo mode off in the header. Triage then runs through Firebase AI Logic with `PREFER_ON_DEVICE`, and the care plan uses `PREFER_IN_CLOUD`. Each answer shows its source, read from `response.inferenceSource`.

Note: when App Check is enforced for AI Logic, local development needs the App Check debug provider. See the Firebase AI Logic docs for the steps.

## API key and restrictions

This section is the handover note for the Firebase API key. Read it before moving hosts, rotating the key, or handing the project to someone else.

Where the key lives: the Firebase web API key is set as the `VITE_FIREBASE_API_KEY` environment variable in Vercel (Production, type Config). It is injected at build time. It is NOT in this repo and NOT in git history. The app reads it from `import.meta.env.VITE_FIREBASE_API_KEY` in `src/config.js`. The other Firebase config values (project ID, app ID, and the rest) are in `src/config.js` because they are not secrets.

Current key (set Nov 11, 2026): Google Cloud Console, project `fieldcare-cbe75`, key name "API key 2", key ID `2e529878-a048-451a-849f-8cf0213bd7ff`. Restrictions: HTTP referrers allow only `https://fieldcare.vercel.app/*`, and API restrictions allow only the Firebase AI Logic API. The previous key ("Browser key (auto created by Firebase)", ID `4419d295-dec1-451f-bf4b-813cf8f8e934`) was leaked in this public repo on Nov 11, 2026 and was deleted the same day. Do not reuse it.

Why the key is restricted instead of hidden: a Firebase web key is meant to be visible in client code, it is in the built JavaScript by design. Security comes from the restrictions, not from hiding it. The referrer lock means the key only works from the FieldCare site, and the API lock means it only works for Firebase AI Logic. Anyone who copies the key cannot use it from another site or for other Google APIs.

Moving to a new host: the key value is just a string, it is not locked to Vercel. Copy it from Vercel (Project Settings, Environment Variables) to the new host as `VITE_FIREBASE_API_KEY`, then in Google Cloud Console, project `fieldcare-cbe75`, APIs and Services, Credentials, open the key and add the new site address to the HTTP referrers list. Remove the old address only after the new site is live and tested. The app needs no code change for a host move, only the referrer update.

Rotating the key: in Google Cloud Console, project `fieldcare-cbe75`, create a new API key, set the same referrer and API restrictions on it, set its value as `VITE_FIREBASE_API_KEY` in Vercel, redeploy, verify the live site works, then delete the old key in the console. Never delete the old key before the new one is live and tested.

Handing the project over: the new maintainer needs access to three things, all under the Google account `0x5ive@gmail.com` unless ownership is transferred. The Google Cloud project `fieldcare-cbe75` (to manage the key and its restrictions), the Vercel project `fieldcare` (to read or change the env var), and this GitHub repo (to update the code). Transfer ownership of all three properly; do not just share the key value, because the key alone does not let anyone update its restrictions or rotate it.

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
