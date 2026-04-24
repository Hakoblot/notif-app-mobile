# Expo Push Notifications Plan

## Prototype Goal

Use this app to confirm the full device path:

1. Request notification permission on a real Android or iOS device.
2. Generate an `ExpoPushToken`.
3. Send a test parent attendance alert through Expo Push Service.
4. Confirm foreground, background, and closed-app notification behavior.

Push notifications do not work on Android emulators or iOS simulators. Use an EAS development or preview build installed on a physical device.

## Production Flow

1. Parent signs in on the mobile app.
2. App requests notification permission and gets an `ExpoPushToken`.
3. App sends the token to your backend with the authenticated parent account and device metadata.
4. Backend stores tokens per parent/device, not just per parent.
5. Face attendance system sends events to backend:
   - `campus_arrival`
   - `campus_exit`
   - `early_exit`
   - `unknown_exit_attempt`
6. Backend decides which parents/guardians should be notified.
7. Backend sends notifications to Expo Push Service using the stored Expo tokens.
8. Backend stores Expo push tickets, checks receipts later, and disables stale tokens when Expo reports `DeviceNotRegistered`.

## Data Model Sketch

`parent_devices`

- `id`
- `parent_id`
- `expo_push_token`
- `platform`
- `device_name`
- `notifications_enabled`
- `last_registered_at`
- `disabled_at`

`attendance_events`

- `id`
- `student_id`
- `event_type`
- `campus_zone`
- `captured_at`
- `confidence`
- `camera_id`
- `review_status`

`notification_logs`

- `id`
- `attendance_event_id`
- `parent_id`
- `expo_push_token`
- `title`
- `body`
- `payload`
- `expo_ticket_id`
- `ticket_status`
- `receipt_status`
- `sent_at`

## Backend Sending Notes

For Node.js, use `expo-server-sdk`. Send messages in chunks and keep retry logic for HTTP 429 and 5xx responses. Expo's Node SDK already limits concurrent connections.

The app should never be the production trigger. The in-app send button is only for device testing. In production, the backend triggers notifications after validating the face attendance event and checking parent/student relationships.

## Android and iOS Credentials

With Expo Push Service, your backend does not talk directly to FCM or APNs. It sends to Expo, and Expo forwards to FCM/APNs.

Android still needs FCM V1 credentials configured in EAS for the app. iOS needs APNs credentials and a paid Apple Developer account. This is credential setup, not a custom FCM backend.

## Closed-App Behavior

If the user approved notifications, remote pushes can appear even when the app is backgrounded or closed. Delivery is still controlled by iOS/Android, battery settings, network state, notification channels, and push provider reliability. The app code runs when foregrounded, and tap handlers run when the user opens the app from a notification.
