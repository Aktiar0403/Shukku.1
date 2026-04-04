# Shukkuu

A shared household app for couples to manage grocery lists, meds, stationary, and reminders with real-time updates.

## 🚀 GitHub Actions: Build Android APK

This repository is set up with a GitHub Actions workflow that automatically builds an Android APK whenever you push to the `main` branch.

### How to get the APK:
1.  **Push your code** to this repository.
2.  Go to the **Actions** tab in your GitHub repository.
3.  Select the **"Build Android APK"** workflow.
4.  Once the workflow finishes, click on the run to see the **Artifacts** section.
5.  Download the **`app-debug`** artifact, which contains the `app-debug.apk`.

## 📱 Installation (PWA)

You can also install Shukkuu as a Progressive Web App (PWA) directly from your browser:
1.  Open the app URL in Chrome on your Android phone.
2.  Tap the **"Install Shukkuu App"** button at the bottom of the screen.
3.  The app will be added to your home screen.

## 🛠️ Tech Stack
- React + Vite
- Tailwind CSS
- Firebase (Firestore & Auth)
- Capacitor (Native Android)
- GitHub Actions (CI/CD)
