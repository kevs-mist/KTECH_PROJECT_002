"use client";

import React, { useState, useEffect } from "react";
import { notificationService, Notification as NotificationType } from "../../lib/services/notificationService";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setShowPermissionPrompt(false);
      // Show a test notification
      new Notification("Notifications Enabled", {
        body: "You will now receive notifications for new tickets.",
        icon: "/favicon.ico"
      });
    }
  };

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default" && user) {
      // Show prompt after a delay
      const timer = setTimeout(() => {
        setShowPermissionPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n: NotificationType) => !n.is_read).length);

      // Show browser notification for new unread notifications
      if (Notification.permission === "granted" && data.some((n: NotificationType) => !n.is_read)) {
        const newNotifications = data.filter((n: NotificationType) => !n.is_read).slice(0, 3);
        newNotifications.forEach((notif: NotificationType) => {
          new Notification(notif.title, {
            body: notif.message,
            icon: "/favicon.ico",
            tag: notif.id
          });
        });
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Real-time listener for new notifications
    // Only subscribe if user is authenticated
    const uid = user?.uid;
    if (!uid) return;

    const channel = supabase
      .channel(`notifications-${uid}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `recipient_id=eq.${uid}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Permission Prompt */}
      {showPermissionPrompt && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-xl max-w-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Enable Notifications</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Get notified when new tickets are assigned to you or appear in the open pool.</p>
          <div className="flex gap-2">
            <button
              onClick={requestNotificationPermission}
              className="px-3 py-1.5 text-xs font-semibold rounded"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Enable
            </button>
            <button
              onClick={() => setShowPermissionPrompt(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-colors"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
            style={{ background: 'var(--accent)', color: 'white', border: '2px solid var(--bg-surface)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-lg shadow-xl z-50"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="p-2">
              {notifications.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                      !notification.is_read ? 'font-semibold' : ''
                    }`}
                    style={{
                      background: !notification.is_read ? 'var(--bg-elevated)' : 'transparent',
                      border: !notification.is_read ? '1px solid var(--border)' : 'none'
                    }}
                    onClick={() => {
                      if (!notification.is_read) {
                        handleMarkAsRead(notification.id);
                      }
                      if (notification.ticket_id) {
                        window.location.href = `/employee/dashboard`;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ 
                          background: notification.is_read ? 'transparent' : 'var(--accent)' 
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-1">{notification.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {notification.message}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Floating Toasts - Mobile only */}
      {isMobile && notifications.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-50 space-y-2 max-h-[70vh] overflow-y-auto">
          {notifications.slice(0, 5).map((notification) => (
            <div
              key={notification.id}
              className="p-4 rounded-lg shadow-xl animate-in slide-in-from-top-2 duration-300"
              style={{ 
                background: notification.is_read ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderLeft: notification.is_read ? '1px solid var(--border)' : '3px solid var(--accent)'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {notification.title}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {notification.message}
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    {formatTime(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="text-xs font-semibold px-2 py-1 rounded"
                    style={{ color: 'var(--accent)' }}
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          ))}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="w-full p-3 rounded-lg text-xs font-semibold text-center"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Mark all as read
            </button>
          )}
        </div>
      )}
    </div>
  );
}
