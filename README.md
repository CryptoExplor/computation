# 🧾 Tax Dashboard App (ITR Computation + Firebase + PWA)

A modern web dashboard for tax professionals to parse ITR JSON files, generate summary PDFs, compute taxes with old/new regime logic, and manage clients using Firebase.

---

## 🚀 Features

- 🔐 Firebase Auth (per-user login, plan-based access)
- 📁 Upload ITR JSON → auto-parsed into structured summary
- 📊 Tax Computation (Old/New regime, slabs, age-based, 87A)
- 🧾 Export PDF reports and CSV summaries
- 👤 Client dashboard for each user
- 🧑‍💼 CA/Agency plan with employee login support (coming soon)
- 💳 Razorpay billing system (upgrade to family, pro, agency)
- 🌐 PWA support (install on mobile/desktop)
- ☁️ Firebase Hosting-ready

---

## 🛠 Tech Stack

- React + Vite + Tailwind CSS
- Firebase (Auth, Firestore, Storage)
- Razorpay (for payments)
- jsPDF + AutoTable (PDF export)
- Progressive Web App (manifest + service worker)

---

## ⚙️ Installation

```bash
# Clone the repo
https://github.com/your-username/tax-dashboard-app.git
cd tax-dashboard-app

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔥 Firebase Setup

1. Create a project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable:
   - Email/Password Auth
   - Firestore
   - Storage
3. Replace `src/config/firebaseConfig.js` with your keys
4. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

---

## 🧪 Testing

| Feature                  | How to Test                                    |
|--------------------------|------------------------------------------------|
| Login/Register          | Try new users from app login page              |
| Upload JSON             | Use real ITR JSON files                        |
| Client Dashboard        | Should show parsed summaries                   |
| PDF Download            | Click "Download PDF" on client card            |
| CSV Export              | Click "Export CSV" on dashboard                |
| Plan Limits             | Upload clients beyond limits → alert shown     |
| Razorpay Flow           | Use Razorpay test card in `PlansPage.jsx`      |
| Offline Mode (PWA)      | Try app after loading once (with no network)   |
| Install to Desktop/Mobile | Use "Install" button in browser address bar |

---

## 📦 Build + Deploy

```bash
npm run build
firebase deploy
```

---

## 📃 License

MIT — Free for personal and commercial use with attribution.

---

## ✨ Contributors

- [@CryptoExplor](https://github.com/CryptoExplor) — core developer
- [ChatGPT Turbo](https://chat.openai.com) — paired AI dev support
