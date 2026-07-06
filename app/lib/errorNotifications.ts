import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type ErrorNotification = {
  id: string;
  source: string;
  message: string;
  occurredAt: string;
  occurrenceCount: number;
};

const MAX_NOTIFICATIONS = 20;
const MAX_MESSAGE_LENGTH = 2_000;
const notificationFilePath = path.join(
  process.env.ORACLE_ADMIN_CACHE_DIR || "/tmp/oracle-admin-cache",
  "error-notifications.json",
);
let mutationQueue: Promise<void> = Promise.resolve();

function queueMutation<T>(mutation: () => Promise<T>) {
  const result = mutationQueue.then(mutation, mutation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function sortNewestFirst(notifications: ErrorNotification[]) {
  return notifications.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
}

async function readNotifications() {
  try {
    const raw = await fs.readFile(notificationFilePath, "utf8");
    const parsed = JSON.parse(raw) as { notifications?: ErrorNotification[] };

    if (!Array.isArray(parsed.notifications)) {
      return [];
    }

    return sortNewestFirst(parsed.notifications).slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

async function writeNotifications(notifications: ErrorNotification[]) {
  await fs.mkdir(path.dirname(notificationFilePath), { recursive: true });
  const temporaryPath = `${notificationFilePath}.${process.pid}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify({ notifications }, null, 2),
    "utf8",
  );
  await fs.rename(temporaryPath, notificationFilePath);
}

export async function getErrorNotifications() {
  await mutationQueue;
  return readNotifications();
}

export async function addErrorNotification(source: string, message: string) {
  const normalizedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

  if (!normalizedMessage) {
    return;
  }

  try {
    await queueMutation(async () => {
      const notifications = await readNotifications();
      const occurredAt = new Date().toISOString();
      const duplicate = notifications.find(
        (notification) =>
          notification.source === source &&
          notification.message === normalizedMessage,
      );

      const nextNotifications = duplicate
        ? notifications.map((notification) =>
            notification.id === duplicate.id
              ? {
                  ...notification,
                  occurredAt,
                  occurrenceCount: notification.occurrenceCount + 1,
                }
              : notification,
          )
        : [
            {
              id: randomUUID(),
              source,
              message: normalizedMessage,
              occurredAt,
              occurrenceCount: 1,
            },
            ...notifications,
          ];

      await writeNotifications(
        sortNewestFirst(nextNotifications).slice(0, MAX_NOTIFICATIONS),
      );
    });
  } catch {
    // Notification persistence must not replace the original operational error.
  }
}

export async function deleteErrorNotification(id: string) {
  return queueMutation(async () => {
    const notifications = await readNotifications();
    const nextNotifications = notifications.filter(
      (notification) => notification.id !== id,
    );

    if (nextNotifications.length === notifications.length) {
      return false;
    }

    await writeNotifications(nextNotifications);
    return true;
  });
}
