import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification({
  to,
  title,
  body,
  data,
}: {
  to: string | null | undefined;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  if (!to || !Expo.isExpoPushToken(to)) return;

  const message: ExpoPushMessage = {
    to,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch {
    // Non-fatal — delivery failure should not break the message send response
  }
}
