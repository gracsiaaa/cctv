import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Bell, CheckCheck, AlertTriangle, UserX, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  timestamp: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifs = () => {
    apiClient.get("/notifications")
      .then((res) => setNotifications(res.data.notifications || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 8000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await apiClient.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl h-9 w-9"
        title="Notifikasi Sistem"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-zinc-950 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs text-white">Notifikasi Real-Time</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800/60 px-1.5 py-0.2 rounded-full font-mono">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-zinc-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Tandai Dibaca
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 italic">
                  Belum ada notifikasi sistem
                </div>
              ) : (
                notifications.slice(0, 15).map((n) => {
                  const isLate = n.type === "LATE";
                  const isUnknown = n.type === "UNKNOWN";

                  return (
                    <div
                      key={n.id}
                      onClick={() => markSingleRead(n.id)}
                      className={`p-3 text-xs transition-colors cursor-pointer hover:bg-zinc-800/40 flex items-start gap-2.5 ${
                        !n.is_read ? "bg-indigo-950/20" : ""
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isLate ? (
                          <div className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        ) : isUnknown ? (
                          <div className="p-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <UserX className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold text-white text-xs truncate">
                            {n.title}
                          </h5>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 ml-1"></span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
                          {new Date(n.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
