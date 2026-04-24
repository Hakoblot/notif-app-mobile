import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { ThemedText } from '@/components/themed-text';

const defaultApiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendance-alerts', {
      name: 'Attendance alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#147D64',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (!Device.isDevice) {
    throw new Error('Push notifications need a physical device.');
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (existingPermission.status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Notification permission was not approved.');
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error('EAS project ID is missing. Run eas init or create an EAS build first.');
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });

  return pushToken.data;
}

async function saveTokenToBackend(input: {
  apiBaseUrl: string;
  expoPushToken: string;
  parentName: string;
  studentName: string;
}) {
  const response = await fetch(`${input.apiBaseUrl.replace(/\/$/, '')}/api/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expoPushToken: input.expoPushToken,
      parentName: input.parentName,
      studentName: input.studentName,
      platform: Platform.OS,
      deviceName: Device.deviceName || Device.modelName || 'Unknown device',
    }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || 'Could not save token to the website API.');
  }

  return body.data;
}

export default function HomeScreen() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [parentName, setParentName] = useState('Jacob Barcelona');
  const [studentName, setStudentName] = useState('Mika Santos');
  const [expoPushToken, setExpoPushToken] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState(
    'Tap the button below to request notification access.'
  );
  const [saveStatus, setSaveStatus] = useState('Not saved to SQL yet.');
  const [lastNotification, setLastNotification] = useState<Notifications.Notification>();
  const [lastResponse, setLastResponse] = useState<Notifications.NotificationResponse>();
  const [isRequestingToken, setIsRequestingToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      setLastNotification(notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      setLastResponse(response);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const requestNotificationAccess = async () => {
    setIsRequestingToken(true);
    setRegistrationStatus('Requesting notification access...');

    try {
      const token = await registerForPushNotificationsAsync();
      setExpoPushToken(token);
      setRegistrationStatus('Ready. Expo push token generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRegistrationStatus(message);
      Alert.alert('Notification setup failed', message);
    } finally {
      setIsRequestingToken(false);
    }
  };

  const copyToken = async () => {
    if (!expoPushToken) {
      Alert.alert('No push token yet', registrationStatus);
      return;
    }

    await Clipboard.setStringAsync(expoPushToken);
    Alert.alert('Token copied', 'You can paste it into the web dashboard if needed.');
  };

  const saveToken = async () => {
    if (!expoPushToken) {
      Alert.alert('Token unavailable', registrationStatus);
      return;
    }

    setIsSaving(true);
    setSaveStatus('Saving to SQL...');

    try {
      const savedToken = await saveTokenToBackend({
        apiBaseUrl,
        expoPushToken,
        parentName,
        studentName,
      });
      setSaveStatus(`Saved to SQL as token #${savedToken.id}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveStatus(message);
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Parent Alerts
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Register this device for Expo push notifications.
          </ThemedText>
        </View>

        <View style={styles.statusPanel}>
          <View style={[styles.statusDot, expoPushToken ? styles.readyDot : styles.pendingDot]} />
          <ThemedText type="defaultSemiBold" style={styles.statusText}>
            {registrationStatus}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Notification permission</ThemedText>
          <Pressable
            disabled={isRequestingToken}
            onPress={requestNotificationAccess}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isRequestingToken) && styles.disabledButton,
            ]}>
            {isRequestingToken ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                Allow notifications and get token
              </ThemedText>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Website API</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setApiBaseUrl}
            placeholder="http://192.168.1.12:3001"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={apiBaseUrl}
          />
          <ThemedText style={styles.helperText}>
            Use your computer LAN IP when testing on a physical phone.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Parent and student</ThemedText>
          <TextInput
            autoCapitalize="words"
            onChangeText={setParentName}
            placeholder="Parent name"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={parentName}
          />
          <TextInput
            autoCapitalize="words"
            onChangeText={setStudentName}
            placeholder="Student name"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={studentName}
          />
          <Pressable
            disabled={isSaving || !expoPushToken}
            onPress={saveToken}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSaving || !expoPushToken) && styles.disabledButton,
            ]}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                Save token to SQL
              </ThemedText>
            )}
          </Pressable>
          <ThemedText style={styles.helperText}>{saveStatus}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Expo push token</ThemedText>
          <ThemedText selectable style={styles.tokenText}>
            {expoPushToken || 'Waiting for token...'}
          </ThemedText>
          <Pressable style={styles.secondaryButton} onPress={copyToken}>
            <ThemedText type="defaultSemiBold" style={styles.secondaryButtonText}>
              Copy token
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Latest notification</ThemedText>
          <ThemedText style={styles.activityLine}>
            Foreground:{' '}
            {lastNotification
              ? `${lastNotification.request.content.title} - ${lastNotification.request.content.body}`
              : 'No notification received while open.'}
          </ThemedText>
          <ThemedText style={styles.activityLine}>
            Tap response:{' '}
            {lastResponse
              ? JSON.stringify(lastResponse.notification.request.content.data)
              : 'No notification opened yet.'}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
    paddingTop: 8,
  },
  title: {
    color: '#0F172A',
    lineHeight: 38,
  },
  subtitle: {
    color: '#475569',
  },
  statusPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  statusDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  readyDot: {
    backgroundColor: '#147D64',
  },
  pendingDot: {
    backgroundColor: '#D97706',
  },
  statusText: {
    color: '#0F172A',
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 6,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  helperText: {
    color: '#475569',
  },
  tokenText: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    color: '#334155',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#147D64',
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#147D64',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryButtonText: {
    color: '#147D64',
  },
  disabledButton: {
    opacity: 0.65,
  },
  activityLine: {
    color: '#334155',
  },
});
