# VIP SERVICE — Native Android Build & Signed APK Guide

This project is configured with **Capacitor** (`@capacitor/android`) to package the complete **VIP SERVICE** platform as a native Android application targeting **Android 13 (API 33) and newer** (`minSdkVersion = 33`, `targetSdkVersion = 36`).

## 1. Android Project Summary
- **Application Name**: `VIP SERVICE`
- **Package / Application ID**: `com.vipservice.app`
- **Supported Android Versions**: Android 13 (API 33) through Android 16 (API 36)
- **Transport Security**: Strict HTTPS (`android:usesCleartextTraffic="false"`, `network_security_config.xml`, `androidScheme: 'https'`)
- **Backend Endpoint**: Configured automatically for Capacitor WebView via `src/utils/apiBridge.ts` (customizable over HTTPS inside **Settings -> AI Engine & Backend**)
- **Permissions Configured**:
  - `INTERNET`, `ACCESS_NETWORK_STATE`
  - `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` (Voice Assistant & Speech-to-Text)
  - `CAMERA` (optional hardware feature, for image/camera workflows)
  - `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `POST_NOTIFICATIONS` (Android 13+ granular media & notifications)
- **Icons & Splash Assets**: Adaptive launcher icons (`mipmap-anydpi-v26`), round icons, legacy density icons, 512x512 Play Store emblem, and portrait/landscape splash screens generated from the VIP SERVICE logo.

---

## 2. Prerequisites on Your Computer
1. **Node.js 20+** and **npm**
2. **Android Studio** (Ladybug / Meerkat or newer) with:
   - **Android SDK Platform 36** (and **Platform 33** for Android 13 testing)
   - **Android SDK Build-Tools**
   - **Android Emulator** or a physical **Android 13+ device** (USB Debugging enabled)
3. **JDK 21** (bundled with modern Android Studio; verify with `java -version`)

---

## 3. Sync Web Assets to the Android Project
Whenever you update frontend code (`src/`), build the web bundle and sync it into the Android Studio project:

```bash
npm install
npm run android:sync
```

If you deploy your backend to a custom production HTTPS URL, set it at build time or configure it directly inside the app's **Settings** page:

```bash
VITE_BACKEND_URL="https://your-production-backend.example.com" npm run android:sync
```

To open the Android Studio project directly:

```bash
npm run android:open
```
Or open the `android/` folder manually inside Android Studio (**File -> Open -> select `android/`**).

---

## 4. Test Debug Build on Android 13+ Device or Emulator
From Android Studio:
1. Wait for Gradle Sync to finish cleanly.
2. Connect an Android 13+ phone (with USB Debugging enabled) or launch an Android 13+ Emulator (API 33+).
3. Click **Run (`Shift + F10`)**.

Or from the terminal inside `android/`:
```bash
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 5. Build a Signed Release APK

### Option A — Android Studio GUI Wizard (Recommended)
1. Open `android/` in Android Studio.
2. Click **Build -> Generate Signed Bundle / APK...**
3. Select **APK** and click **Next**.
4. Under **Key store path**, click **Create new...** (if you don't have one yet):
   - Choose a secure path outside your repository (e.g., `~/keystores/vipservice-release.jks`).
   - Set a strong Key Store password, Key alias (`vipservice`), and Key password.
   - Fill in certificate details (Name/Organization) and click **OK**.
5. Click **Next**, select the **release** build variant, and click **Create**.
6. Your signed APK will be output to:
   `android/app/release/app-release.apk`

### Option B — Command Line (Gradle + `keystore.properties`)
1. Generate a release keystore using `keytool` (stored safely outside git):
   ```bash
   keytool -genkey -v \
     -keystore ../vipservice-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias vipservice
   ```
2. Copy the template file:
   ```bash
   cp android/keystore.properties.example android/keystore.properties
   ```
3. Edit `android/keystore.properties` with your real keystore path, alias, and passwords (both `*.jks` and `android/keystore.properties` are gitignored).
4. Build the signed APK:
   ```bash
   npm run android:sync
   cd android
   ./gradlew assembleRelease
   ```
5. The signed release APK will be generated at:
   `android/app/build/outputs/apk/release/app-release.apk`
6. (Optional for Google Play Store) Build a signed Android App Bundle (`.aab`):
   ```bash
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 6. Installing the Signed APK on Android 13+
1. Transfer `app-release.apk` to your Android 13+ device (or run `adb install -r android/app/build/outputs/apk/release/app-release.apk`).
2. Tap the APK on your phone and grant **Install unknown apps** permission when prompted.
3. Launch **VIP SERVICE** from your app drawer — note the **VIP SERVICE** icon, dark splash screen, full microphone/media permissions, and live HTTPS connection to your backend.
