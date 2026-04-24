# notif-app

Expo SDK 54 mobile app for registering a parent's device for Expo push notifications.

This app does not send notifications directly in production. It asks for notification permission, gets an `ExponentPushToken[...]`, and sends that token to `notif-app-web`, which stores it in Aiven MySQL and sends notifications through Expo Push Service.

## Install

```bash
npm install
```

## Android Push Setup

Android push notifications use FCM under the hood, even when the app and backend use Expo Push Service. This project does not use the Firebase JS SDK or `@react-native-firebase/*`.

You need two Firebase items:

### 1. `google-services.json`

This initializes Firebase/FCM in the native Android app.

1. Open Firebase Console: https://console.firebase.google.com
2. Create or open your Firebase project.
3. Add an Android app.
4. Use this Android package name:

   ```txt
   com.nyuusutairuitdept.notifapp
   ```

5. Download `google-services.json`.
6. Put it in the mobile project root:

   ```txt
   C:\Users\Documents\GitHub\notif-app\google-services.json
   ```

7. Make sure `app.json` has:

   ```json
   "android": {
     "package": "com.itdept.notifapp",
     "googleServicesFile": "./google-services.json"
   }
   ```

`google-services.json` is app config and is commonly committed in mobile apps, especially private repos. If your repo is public and you prefer not to commit it, add it to `.gitignore` and provide it separately before EAS builds.

### 2. FCM V1 Service Account Key

This is private. Never commit it.

1. Firebase Console -> Project settings -> Service accounts.
2. Click `Generate new private key`.
3. Download the `firebase-adminsdk-xxxxx.json` file.
4. Upload it to EAS:

   ```bash
   eas credentials
   ```

5. Choose Android -> your build profile/application -> Google Service Account -> FCM V1 -> upload the JSON key.

The service account key is only for Expo/EAS credentials. It does not go in the app and does not go in Render.

## Build Preview APK

After adding `google-services.json` and setting `EXPO_PUBLIC_API_URL`:

```bash
eas build --profile preview --platform android
```

Install the APK on a real Android device. Push notifications do not work on Android emulators or iOS simulators.

## Test Flow

1. Start or deploy `notif-app-web`.
2. Open the mobile app on a real device.
3. Tap `Allow notifications and get token`.
4. Tap `Save token to SQL`.
5. Open the web dashboard.
6. Confirm the token appears.
7. Send a push notification to all tokens or selected tokens.

## Troubleshooting

`Default FirebaseApp is not initialized`

- The Android build is missing `google-services.json`, or it was added after the APK was built.
- Add `google-services.json`, confirm `android.googleServicesFile`, then rebuild the APK.

No permission popup

- Android 12 and below may not show a runtime notification prompt.
- Android 13+ should show the prompt once.
- If permission was denied before, enable notifications in Android app settings or reinstall the app.

No push token

- Use a physical device.
- Use a development or preview build, not a simulator.
- Confirm EAS project ID exists in `app.json`.
- Confirm Android FCM credentials are configured in EAS.

## Useful Docs

- Expo push setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Android FCM credentials: https://docs.expo.dev/push-notifications/fcm-credentials/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
