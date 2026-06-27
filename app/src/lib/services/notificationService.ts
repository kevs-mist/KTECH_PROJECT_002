import { auth } from "../firebase";
import { parseJsonResponse } from "../apiClient";

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  ticket_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  async getIdToken() {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error("Unauthorized: Please log in again.");
    return token;
  },

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getIdToken();
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    return parseJsonResponse<T>(response, path);
  },

  async getNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>("/api/notifications");
  },

  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", notificationId }),
    });
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
  }
};
