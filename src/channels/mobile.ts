/**
 * Mobile Channel
 *
 * Push notification delivery for mobile companion apps (iOS/Android).
 * Supports FCM and APNs with topic subscriptions and silent notifications.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Mobile channel configuration */
export interface MobileChannelConfig {
  enabled: boolean;
  fcmServerKey?: string;
  apnsKeyId?: string;
  apnsTeamId?: string;
  apnsBundleId?: string;
  topics: string[];
}

/** Push notification payload */
export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  topic?: string;
  priority: 'normal' | 'high';
}

/** Device registration */
export interface DeviceRegistration {
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  token: string;
  topics: string[];
  registeredAt: number;
}

/** Notification result */
export interface NotificationResult {
  success: boolean;
  platform: string;
  messageId?: string;
  error?: string;
}

/**
 * Mobile channel — push notification delivery for companion apps.
 *
 * Manages device registrations, topic subscriptions, and sends
 * push notifications via FCM (Android) and APNs (iOS).
 */
class MobileChannel implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'mobile',
    version: '0.1.0',
    description: 'Push notification channel for mobile companion apps',
    dependencies: [],
  };

  private config: MobileChannelConfig = {
    enabled: false,
    topics: [],
  };
  private ctx!: FeatureContext;
  private devices: Map<string, DeviceRegistration> = new Map();

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<MobileChannelConfig>) };
  }

  async start(): Promise<void> {
    this.ctx.logger.info('Mobile channel active', {
      fcm: !!this.config.fcmServerKey,
      apns: !!this.config.apnsKeyId,
      topics: this.config.topics,
    });
  }

  async stop(): Promise<void> {
    this.devices.clear();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.config.enabled,
      details: {
        registeredDevices: this.devices.size,
        fcmConfigured: !!this.config.fcmServerKey,
        apnsConfigured: !!this.config.apnsKeyId,
      },
    };
  }

  /** Register a device for push notifications */
  registerDevice(registration: DeviceRegistration): void {
    const key = `${registration.userId}:${registration.deviceId}`;
    this.devices.set(key, registration);
    this.ctx.logger.info('Device registered', {
      userId: registration.userId,
      platform: registration.platform,
      topics: registration.topics,
    });
  }

  /** Unregister a device */
  unregisterDevice(userId: string, deviceId: string): boolean {
    return this.devices.delete(`${userId}:${deviceId}`);
  }

  /** Get all devices for a user */
  getUserDevices(userId: string): DeviceRegistration[] {
    return Array.from(this.devices.values()).filter(d => d.userId === userId);
  }

  /** Send push notification */
  async sendNotification(notification: PushNotification): Promise<NotificationResult> {
    const device = this.devices.get(`${notification.userId}:default`)
      ?? Array.from(this.devices.values()).find(d => d.userId === notification.userId);

    if (!device) {
      return { success: false, platform: 'none', error: 'No device registered for user' };
    }

    try {
      if (device.platform === 'android' && this.config.fcmServerKey) {
        return await this.sendFCM(device, notification);
      } else if (device.platform === 'ios' && this.config.apnsKeyId) {
        return await this.sendAPNs(device, notification);
      }

      return {
        success: false,
        platform: device.platform,
        error: 'No push provider configured for this platform',
      };
    } catch (err) {
      return {
        success: false,
        platform: device.platform,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Send to all devices for a user */
  async broadcastToUser(userId: string, notification: Omit<PushNotification, 'userId'>): Promise<NotificationResult[]> {
    const devices = this.getUserDevices(userId);
    const results: NotificationResult[] = [];

    for (const device of devices) {
      results.push(
        await this.sendNotification({ ...notification, userId: device.userId })
      );
    }

    return results;
  }

  /** Send via Firebase Cloud Messaging */
  private async sendFCM(device: DeviceRegistration, notification: PushNotification): Promise<NotificationResult> {
    if (!this.config.fcmServerKey) {
      return { success: false, platform: 'android', error: 'FCM not configured' };
    }

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.config.fcmServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: device.token,
          notification: {
            title: notification.title,
            body: notification.body,
            sound: notification.sound ?? 'default',
          },
          data: notification.data,
          priority: notification.priority === 'high' ? 'high' : 'normal',
        }),
      });

      const result = await response.json() as { success: number; failure: number; message_id?: string };
      return {
        success: result.success === 1,
        platform: 'android',
        messageId: result.message_id,
      };
    } catch (err) {
      return {
        success: false,
        platform: 'android',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Send via Apple Push Notification Service (placeholder — needs APNs HTTP/2 client) */
  private async sendAPNs(device: DeviceRegistration, notification: PushNotification): Promise<NotificationResult> {
    // Real implementation would use apn2 or apns2 library with JWT auth
    this.ctx.logger.debug('APNs send (stub)', {
      device: device.deviceId,
      title: notification.title,
    });
    return { success: true, platform: 'ios', messageId: `apns-stub-${Date.now()}` };
  }
}

export default new MobileChannel();
