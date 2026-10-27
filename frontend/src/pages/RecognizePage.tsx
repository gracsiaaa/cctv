import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Play,
  Square,
  Video,
  SwitchCamera,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Sparkles,
  UserCheck,
  Cctv,
  Camera,
  Radio,
  CalendarCheck,
  MapPin,
  ArrowDownRight,
  ArrowUpRight
} from "lucide-react";
import { LiveClock } from "@/components/common/LiveClock";
import { useToast } from "@/hooks/use-toast";

interface TodayStatus {
  name: string;
  has_checked_in: boolean;
  has_checked_out: boolean;
  check_in?: string | null;
  check_out?: string | null;
  status?: string | null;
}

interface AttendanceAction {
  action: string;
  name?: string;
  status?: string;
  record?: {
    check_in?: string;
    check_out?: string;
    status?: string;
  };
  remaining_seconds?: number;
}

interface FaceResult {
  name: string;
  confidence: number;
  bbox: number[];
  timestamp: string;
  attendance?: AttendanceAction;
  today_status?: TodayStatus;
}

interface CCTVEventItem {
  camera_id: string;
  camera_name: string;
  name: string;
  confidence: number;
  snapshot_url: string;
  attendance?: AttendanceAction;
  timestamp: string;
}

export const RecognizePage: React.FC = () => {
  // Mode selection: "webcam" for laptop/phone testing or "cctv" for CCTV RTSP Event snapshots
  const [viewMode, setViewMode] = useState<"webcam" | "cctv">("webcam");

  // Webcam mode states
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isProcessingRef = useRef<boolean>(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [faces, setFaces] = useState<FaceResult[]>([]);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [intervalMs, setIntervalMs] = useState<number>(1200);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // CCTV mode states
  const [cctvEvents, setCctvEvents] = useState<CCTVEventItem[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeWorkers, setActiveWorkers] = useState<Record<string, boolean>>({});
  const [isAutoClosing, setIsAutoClosing] = useState(false);

  const { toast } = useToast();

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const drawBoxes = useCallback((detectedFaces: FaceResult[]) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas coordinate size to the visible video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detectedFaces.forEach((face) => {
      const [x1, y1, x2, y2] = face.bbox;
      const width = x2 - x1;
      const height = y2 - y1;

      const isKnown = face.name !== "Unknown";
      const color = isKnown ? "#10b981" : "#f43f5e";

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, width, height);

      // Label background
      ctx.fillStyle = color;
      const text = `${face.name} ${Math.round(face.confidence * 100)}%`;
      ctx.font = "bold 15px sans-serif";
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(x1, Math.max(0, y1 - 26), textWidth + 12, 26);

      // Text label
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, x1 + 6, Math.max(18, y1 - 8));
    });
  }, []);

  const captureAndRecognize = useCallback(async () => {
    if (!webcamRef.current) return;
    if (isProcessingRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      isProcessingRef.current = true;
      const res = await fetch(imageSrc);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");
      formData.append("camera_id", "webcam_live");
      formData.append("auto_record", "false"); // Interactive click mode

      const response = await apiClient.post("/recognize", formData);
      const detectedFaces: FaceResult[] = response.data.faces || [];
      setFaces(detectedFaces);
      drawBoxes(detectedFaces);

      const hasKnown = detectedFaces.some((f) => f.name !== "Unknown");
      if (hasKnown && "vibrate" in navigator) {
        navigator.vibrate(40);
      }
    } catch (err) {
      console.error("Frame recognition error", err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [drawBoxes]);

  useEffect(() => {
    let timer: any = null;
    if (isStreaming && viewMode === "webcam") {
      timer = setInterval(captureAndRecognize, intervalMs);
    } else {
      if (timer) clearInterval(timer);
      setFaces([]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming, intervalMs, captureAndRecognize, viewMode]);

  // CCTV Stream Events polling
  const fetchCctvData = async () => {
    try {
      const [eventsRes, statusRes, camRes] = await Promise.all([
        apiClient.get("/stream/events"),
        apiClient.get("/stream/status").catch(() => ({ data: { workers: [] } })),
        apiClient.get("/cameras").catch(() => ({ data: { cameras: [] } })),
      ]);

      setCctvEvents(eventsRes.data.events || []);
      setCameras(camRes.data.cameras || []);

      const workerMap: Record<string, boolean> = {};
      (statusRes.data?.workers || []).forEach((w: any) => {
        workerMap[w.camera_id] = w.running;
      });
      setActiveWorkers(workerMap);
    } catch (err) {
      console.error("CCTV events fetch error", err);
    }
  };

  useEffect(() => {
    if (viewMode === "cctv") {
      fetchCctvData();
      const interval = setInterval(fetchCctvData, 2500);
      return () => clearInterval(interval);
    }
  }, [viewMode]);

  const toggleWorker = async (camId: string, camName: string, isRunning: boolean) => {
    try {
      if (isRunning) {
        await apiClient.post(`/stream/stop/${camId}`);
        toast({ title: "Stream Dihentikan", description: `AI Worker ${camName} dinonaktifkan` });
      } else {
        await apiClient.post(`/stream/start/${camId}`);
        toast({ title: "Stream Aktif", description: `AI Worker ${camName} mulai memindai RTSP` });
      }
      fetchCctvData();
    } catch (err: any) {
      toast({
        title: "Gagal Mengubah Status Stream",
        description: err.response?.data?.detail || "Gagal menghubungkan",
        variant: "destructive"
      });
    }
  };

  const handleAutoClose = async () => {
    try {
      setIsAutoClosing(true);
      const res = await apiClient.post("/attendance/auto-close");
      toast({
        title: "Tutup Buku Harian Selesai",
        description: `${res.data.closed_count || 0} presensi tanpa check-out telah ditandai status NO_CHECKOUT`,
      });
    } catch (err) {
      toast({ title: "Gagal Menutup Absen", variant: "destructive" });
    } finally {
      setIsAutoClosing(false);
    }
  };

  // Handle explicit Check-In action (Webcam mode)
  const handleCheckIn = async (personName: string, confidence: number) => {
    try {
      setActionLoading(personName);
      const res = await apiClient.post("/attendance/check-in", {
        name: personName,
        camera_id: "webcam_live",
        confidence: confidence,
      });

      if (res.data.status === "already_checked_in") {
        toast({
          title: "Sudah Presensi Masuk",
          description: res.data.message,
        });
      } else {
        toast({
          title: "Presensi Masuk Berhasil!",
          description: `${personName} tercatat masuk pada jam ${res.data.record?.check_in} (${res.data.record?.status})`,
        });
      }

      setFaces((prev) =>
        prev.map((f) =>
          f.name === personName
            ? {
                ...f,
                today_status: {
                  name: personName,
                  has_checked_in: true,
                  has_checked_out: false,
                  check_in: res.data.record?.check_in || "Baru Saja",
                  check_out: null,
                  status: res.data.record?.status || "ON_TIME",
                },
              }
            : f
        )
      );
    } catch (err: any) {
      toast({
        title: "Gagal Presensi",
        description: err.response?.data?.detail || "Gagal mencatat presensi",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle explicit Check-Out action (Webcam mode)
  const handleCheckOut = async (personName: string, confidence: number) => {
    try {
      setActionLoading(personName);
      const res = await apiClient.post("/attendance/check-out", {
        name: personName,
        camera_id: "webcam_live",
        confidence: confidence,
      });

      toast({
        title: "Presensi Pulang Berhasil! (Check Out)",
        description: `${personName} tercatat pulang pada jam ${res.data.record?.check_out} (${res.data.record?.status})`,
      });

      setFaces((prev) =>
        prev.map((f) =>
          f.name === personName
            ? {
                ...f,
                today_status: {
                  ...f.today_status,
                  name: personName,
                  has_checked_in: true,
                  has_checked_out: true,
                  check_out: res.data.record?.check_out || "Baru Saja",
                  status: res.data.record?.status || "ON_TIME",
                },
              }
            : f
        )
      );
    } catch (err: any) {
      toast({
        title: "Gagal Check Out",
        description: err.response?.data?.detail || "Gagal memproses check out",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const recognizedPeople = faces.filter((f) => f.name !== "Unknown");

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
          <button
            onClick={() => {
              setIsStreaming(false);
              setViewMode("webcam");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "webcam"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> Kamera Laptop / HP
          </button>
          <button
            onClick={() => {
              setIsStreaming(false);
              setViewMode("cctv");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "cctv"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Cctv className="w-3.5 h-3.5" /> CCTV Stream Events (Snapshot)
          </button>
        </div>

        {viewMode === "cctv" && (
          <Button
            variant="outline"
            size="sm"
            disabled={isAutoClosing}
            onClick={handleAutoClose}
            className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5"
            title="Tandai absen tanpa check-out di akhir hari"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
            {isAutoClosing ? "Menutup Absen..." : "Tutup Buku Absen (Auto-Close)"}
          </Button>
        )}
      </div>

      {/* ============================================================== */}
      {/* VIEW MODE 1: WEBCAM (LAPTOP/HP)                                */}
      {/* ============================================================== */}
      {viewMode === "webcam" && (
        <div className="space-y-4 md:space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isStreaming ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                  }`}
                ></span>
                Scanner Kamera Interaktif
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Mode webcam untuk testing laptop atau ponsel (klik tombol untuk check-in/out)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <LiveClock size="md" />
              <Button
                onClick={() => setIsStreaming((prev) => !prev)}
                className={
                  isStreaming
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 font-semibold"
                }
              >
                {isStreaming ? (
                  <>
                    <Square className="w-4 h-4 mr-1.5" /> Stop Scanner
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1.5" /> Mulai Pindai Wajah
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Camera Viewport */}
            <div className="lg:col-span-2 space-y-3">
              <Card className="bg-zinc-900 border-zinc-800 overflow-hidden relative shadow-2xl">
                <div className="relative aspect-video bg-black flex items-center justify-center">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      facingMode: facingMode,
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    }}
                    className="w-full h-full object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />

                  {/* Camera Flip Button */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={toggleCamera}
                      className="bg-black/60 border-zinc-700/80 text-white hover:bg-black/80 rounded-full h-9 w-9 backdrop-blur-md"
                      title="Ganti Kamera"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </Button>
                  </div>

                  {!isStreaming && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                      <div className="p-4 rounded-full bg-zinc-800/80 text-zinc-400 mb-3 border border-zinc-700">
                        <Video className="w-8 h-8" />
                      </div>
                      <h4 className="font-semibold text-white text-base">Kamera Sedang Standby</h4>
                      <p className="text-xs text-zinc-400 max-w-sm mt-1">
                        Klik tombol 'Mulai Pindai Wajah' untuk mengaktifkan pendeteksi wajah.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Quick Config Bar */}
              <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Interval Pindai:</span>
                  <select
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Number(e.target.value))}
                    className="bg-zinc-800 text-white rounded px-2 py-1 text-xs border border-zinc-700"
                  >
                    <option value={800}>800 ms (Respons Cepat)</option>
                    <option value={1200}>1.2 detik (Standar)</option>
                    <option value={2000}>2.0 detik (Hemat Daya)</option>
                  </select>
                </div>
                <div className="text-[11px] text-emerald-400 font-medium hidden sm:block">
                  Mode Verifikasi Interaktif Aktif
                </div>
              </div>
            </div>

            {/* Action Panel */}
            <div>
              <Card className="bg-zinc-900 border-zinc-800 h-full flex flex-col shadow-xl">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-400" /> Verifikasi Presensi
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {faces.length} Wajah Terlihat
                  </span>
                </div>

                <CardContent className="p-4 flex-1 overflow-y-auto max-h-[520px] space-y-4">
                  {recognizedPeople.length > 0 ? (
                    recognizedPeople.map((person, idx) => {
                      const today = person.today_status;
                      const hasCheckedIn = today?.has_checked_in;
                      const hasCheckedOut = today?.has_checked_out;
                      const isLoading = actionLoading === person.name;

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-zinc-950 border-2 border-indigo-500/50 shadow-lg space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-zinc-400">Wajah Teridentifikasi</div>
                              <div className="text-lg font-bold text-white flex items-center gap-1.5">
                                {person.name}
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                              {Math.round(person.confidence * 100)}% Cocok
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
                            <div className="flex justify-between text-zinc-400">
                              <span>Presensi Masuk:</span>
                              <span className={hasCheckedIn ? "text-emerald-400 font-semibold" : "text-zinc-500 italic"}>
                                {today?.check_in || "Belum"}
                              </span>
                            </div>
                            <div className="flex justify-between text-zinc-400">
                              <span>Presensi Pulang:</span>
                              <span className={hasCheckedOut ? "text-indigo-400 font-semibold" : "text-zinc-500 italic"}>
                                {today?.check_out || "Belum"}
                              </span>
                            </div>
                          </div>

                          {!hasCheckedIn ? (
                            <Button
                              onClick={() => handleCheckIn(person.name, person.confidence)}
                              disabled={isLoading}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                            >
                              <LogIn className="w-5 h-5" />
                              {isLoading ? "Menyimpan Presensi..." : "Klik Untuk Presensi Masuk"}
                            </Button>
                          ) : !hasCheckedOut ? (
                            <Button
                              onClick={() => handleCheckOut(person.name, person.confidence)}
                              disabled={isLoading}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                            >
                              <LogOut className="w-5 h-5" />
                              {isLoading ? "Menyimpan Check Out..." : "Klik Untuk Check Out (Presensi Pulang)"}
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-xl text-center text-xs font-semibold flex items-center justify-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                Presensi Hari Ini Sudah Lengkap!
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCheckOut(person.name, person.confidence)}
                                disabled={isLoading}
                                className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs"
                              >
                                Perbarui Jam Pulang
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-zinc-800/80 text-zinc-500 mx-auto flex items-center justify-center">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-white text-sm">Menunggu Wajah Terdeteksi</h4>
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                        Arahkan wajah Anda ke kamera. Tombol presensi masuk atau pulang akan muncul secara otomatis.
                      </p>
                    </div>
                  )}

                  {faces.some((f) => f.name === "Unknown") && (
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <div>
                        <span className="font-bold">Wajah Tidak Dikenal:</span> Silakan lakukan pendaftaran di menu Registrasi Wajah terlebih dahulu.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE 2: CCTV EVENT STREAM (1 CCTV OR MULTI-CCTV)         */}
      {/* ============================================================== */}
      {viewMode === "cctv" && (
        <div className="space-y-6">
          {/* CCTV Control Banner */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cctv className="w-5 h-5 text-indigo-400" /> Event Stream CCTV Otomatis
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                AI memindai RTSP di background server. Setiap orang yang melintas di depan CCTV langsung difoto (snapshot) dan dicatat presensinya.
              </p>
            </div>

            {/* Camera Quick Control (Handles 1 CCTV or Multi-CCTV) */}
            <div className="flex flex-wrap items-center gap-2">
              {cameras.length === 0 ? (
                <div className="text-xs text-amber-400 bg-amber-950/60 border border-amber-800/60 px-3 py-1.5 rounded-xl">
                  Belum ada CCTV terdaftar di menu Kamera
                </div>
              ) : (
                cameras.map((c) => {
                  const isRunning = Boolean(activeWorkers[c.id]);
                  return (
                    <Button
                      key={c.id}
                      size="sm"
                      onClick={() => toggleWorker(c.id, c.name, isRunning)}
                      className={`text-xs h-9 px-3.5 rounded-xl flex items-center gap-2 font-semibold ${
                        isRunning
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                          <Square className="w-3.5 h-3.5" /> CCTV Aktif ({c.name})
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-indigo-400" /> Nyalakan AI CCTV ({c.name})
                        </>
                      )}
                    </Button>
                  );
                })
              )}
            </div>
          </div>

          {/* CCTV Live Events Timeline / Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                Snapshot Deteksi Terkini ({cctvEvents.length})
              </h4>
              <span className="text-xs text-zinc-400 font-mono">Auto Refresh 2.5s</span>
            </div>

            {cctvEvents.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-800 p-12 text-center text-zinc-400 text-xs italic">
                <Cctv className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                Belum ada event deteksi dari CCTV. Pastikan CCTV telah dinyalakan tombol 'Nyalakan AI CCTV' di atas.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {cctvEvents.map((evt, index) => {
                  const isKnown = evt.name !== "Unknown";
                  const action = evt.attendance?.action;
                  const isCheckIn = action === "CHECKED_IN";
                  const isCheckOut = action === "CHECKED_OUT";

                  return (
                    <Card
                      key={index}
                      className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden hover:border-indigo-500/50 transition-all"
                    >
                      {/* Snapshot Photo captured from CCTV frame */}
                      <div className="relative aspect-video bg-black overflow-hidden border-b border-zinc-800">
                        <img
                          src={`http://localhost:8000${evt.snapshot_url}`}
                          alt={evt.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback if snapshot path not yet populated
                            (e.target as any).style.display = "none";
                          }}
                        />
                        <div className="absolute top-2 right-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isKnown
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                                : "bg-rose-950/80 text-rose-400 border border-rose-800/80"
                            }`}
                          >
                            {Math.round(evt.confidence * 100)}% Cocok
                          </span>
                        </div>
                      </div>

                      <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-sm text-white truncate">{evt.name}</h5>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {evt.timestamp.slice(11)}
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-zinc-400" />
                          <span>{evt.camera_name}</span>
                        </div>

                        {/* Attendance Action Result Badge */}
                        <div className="pt-2 border-t border-zinc-800/80">
                          {isCheckIn && (
                            <span className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                              <ArrowDownRight className="w-3.5 h-3.5" /> Absen Masuk Dicatat
                            </span>
                          )}
                          {isCheckOut && (
                            <span className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                              <ArrowUpRight className="w-3.5 h-3.5" /> Absen Pulang Dicatat
                            </span>
                          )}
                          {!isCheckIn && !isCheckOut && (
                            <span className="w-full inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-300">
                              {action || "Event Terpantau"}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
