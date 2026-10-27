import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  LogIn,
  LogOut,
  Loader2,
  RefreshCw,
  User,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CCTVEvent {
  camera_id: string;
  camera_name: string;
  name: string;
  confidence: number;
  snapshot_url: string;
  attendance: any;
  timestamp: string;
  today_status?: {
    has_checked_in: boolean;
    has_checked_out: boolean;
    check_in: string | null;
    check_out: string | null;
    status: string | null;
  };
}

interface UserStatus {
  name: string;
  has_checked_in: boolean;
  has_checked_out: boolean;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
}

export const LiveSnapshotPage: React.FC = () => {
  const [latestEvent, setLatestEvent] = useState<CCTVEvent | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  const fetchLatestEvent = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const res = await apiClient.get("/stream/events", {
        params: { limit: 1 }
      });
      
      if (res.data.events && res.data.events.length > 0) {
        const event = res.data.events[0];
        setLatestEvent(event);
        
        // Fetch user status if known
        if (event.name !== "Unknown") {
          try {
            const statusRes = await apiClient.get(`/attendance/status/${event.name}`);
            setUserStatus(statusRes.data);
          } catch (err) {
            console.error("Failed to fetch user status", err);
            setUserStatus(null);
          }
        } else {
          setUserStatus(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch latest event", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestEvent(true);
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        fetchLatestEvent(false);
      }, 3000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  const handleManualAction = async (action: "check-in" | "check-out") => {
    if (!latestEvent || latestEvent.name === "Unknown") {
      toast({
        title: "Tidak Ada Wajah Dikenali",
        description: "Berdiri di depan CCTV terlebih dahulu agar wajah terdeteksi",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(true);

      const endpoint = action === "check-in" ? "/attendance/check-in" : "/attendance/check-out";
      const payload = {
        name: latestEvent.name,
        camera_id: latestEvent.camera_id,
        confidence: latestEvent.confidence
      };

      const res = await apiClient.post(endpoint, payload);

      const actionLabel = action === "check-in" ? "Masuk" : "Keluar";

      // Backend returns { status: "success", action: "CHECKED_OUT", record: {...} }
      if (res.data.status === "success" || res.data.success === true) {
        toast({
          title: `✅ Presensi ${actionLabel} Berhasil`,
          description: `${latestEvent.name} - ${res.data.action || res.data.status}`,
        });
        
        // Refresh latest event
        setTimeout(() => fetchLatestEvent(false), 1000);
      } else {
        toast({
          title: "Presensi Gagal",
          description: res.data.message || "Gagal mencatat presensi",
          variant: "destructive",
        });
      }

    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Gagal memproses presensi",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const isKnown = latestEvent && latestEvent.name !== "Unknown";
  const confidencePercent = latestEvent ? Math.round(latestEvent.confidence * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-400" /> Live Snapshot CCTV
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Snapshot terbaru dari CCTV untuk absensi masuk dan keluar
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLatestEvent(true)}
            disabled={loading}
            className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`border-zinc-700 ${
              autoRefresh
                ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/50"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </Button>
        </div>
      </div>

      {/* Main Snapshot Card */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          {/* Snapshot Display */}
          <div className="relative aspect-video bg-black overflow-hidden border-b border-zinc-800">
            {latestEvent ? (
              <>
                <img
                  src={`http://localhost:8000${latestEvent.snapshot_url}`}
                  alt={latestEvent.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as any).style.display = "none";
                  }}
                />
                
                {/* Overlay Info */}
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-md ${
                      isKnown
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                        : "bg-rose-950/80 text-rose-400 border border-rose-800/80"
                    }`}
                  >
                    {confidencePercent}% Cocok
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md border border-zinc-700 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-white">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-mono">{latestEvent.timestamp}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-zinc-500">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Belum ada snapshot terbaru</p>
                  <p className="text-xs mt-1">Berdiri di depan CCTV untuk mulai</p>
                </div>
              </div>
            )}
          </div>

          {/* Identity & Status */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-full ${
                    isKnown ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"
                  }`}
                >
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {latestEvent?.name || "Menunggu..."}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {latestEvent?.camera_name || "CCTV Pintu Utama"}
                  </p>
                </div>
              </div>

              {isKnown && userStatus && (
                <div className="text-right">
                  {userStatus.has_checked_in && !userStatus.has_checked_out ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">
                        Sudah Absen Masuk ({userStatus.check_in})
                      </span>
                    </div>
                  ) : userStatus.has_checked_out ? (
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">
                        Sudah Absen Keluar ({userStatus.check_out})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs font-semibold">Belum Absen</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleManualAction("check-in")}
                disabled={!isKnown || actionLoading || userStatus?.has_checked_in}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    {userStatus?.has_checked_in ? "Sudah Masuk" : "Absen Masuk"}
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleManualAction("check-out")}
                disabled={!isKnown || actionLoading || !userStatus?.has_checked_in || userStatus?.has_checked_out}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-5 h-5 mr-2" />
                    {userStatus?.has_checked_out ? "Sudah Keluar" : "Absen Keluar"}
                  </>
                )}
              </Button>
            </div>

            {/* Helper Text */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                💡 <span className="font-semibold text-zinc-300">Cara Pakai:</span> Berdiri di depan CCTV → Wajah terdeteksi otomatis → Klik tombol <span className="text-emerald-400 font-semibold">Absen Masuk</span> saat datang atau <span className="text-rose-400 font-semibold">Absen Keluar</span> saat pulang.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium">Auto-refresh setiap 3 detik</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium">Snapshot real-time dari CCTV</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
