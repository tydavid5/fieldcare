// FieldCare Firebase configuration.
// This file holds PLACEHOLDER values. The app runs in demo mode until a real
// Firebase config is pasted here. Do not invent a real API key.
// Steps to go live:
// 1. Create a Firebase project in the Firebase console.
// 2. Go to AI Services, then AI Logic, and click Get started. Choose the
//    Gemini Developer API as the provider.
// 3. Register this web app and copy its Firebase config below.
// 4. Turn demo mode off in the app header.
// See the README for the full checklist.

export const firebaseConfig = {
  apiKey: "AIzaSyAgY2P7f3vJeZ83Jur4wXZ7OdgYWdSGEX0",
  authDomain: "fieldcare-cbe75.firebaseapp.com",
  projectId: "fieldcare-cbe75",
  storageBucket: "fieldcare-cbe75.firebasestorage.app",
  messagingSenderId: "845721543399",
  appId: "1:845721543399:web:bc00b75b4ce8a21e973842",
};

export function isConfigured() {
  return (
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID" &&
    Boolean(firebaseConfig.apiKey) &&
    Boolean(firebaseConfig.projectId)
  );
}
