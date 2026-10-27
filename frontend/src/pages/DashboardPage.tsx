import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  ScanFace,
  Activity,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Cctv,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  User,
  TrendingUp,
  Edit2,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveClock } from "@/components/common/LiveClock";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface StatsData {
  today_date: string;
  total_registered: number;
  total_present_today: number;
  on_time_today: number;
  late_today: number;
  absent_today: number;
  absent_users: string[];
}

interface TodayRecord {
  id: string;
  name: string;
  date: string;
  check_in: string;
  check_out?: string;
  status: string;
  confidence: number;
  camera_id?: string;
  override?: {
    old_status: string;
    new_status: string;
    reason: string;
  };
}

interface DayTrend {
  dayName: string;
  dateStr: string;
  total: number;
  onTime: number;
  late: number;
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [serverStatus, setServerStatus] = useState<string>("Memeriksa...");
  const [cameraCount, setCameraCount] = useState<number>(0);
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([]);
  const [allRecords, setAllRecords] = useState<TodayRecord[]>([]);
  const [search, setSearch] = useState<string>("");
  const [tabFilter, setTabFilter] = useState<"all" | "in" | "out">("all");
  const { isAuthenticated } = useAuth();

  // Manual Override modal state
  const [overrideRecord, setOverrideRecord] = useState<TodayRecord | null>(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("ON_TIME");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const { toast } = useToast();

  const loadData = () => {
    apiClient.get("/status")
      .then(() => setServerStatus("Aktif"))
      .catch(() => setServerStatus("Offline"));

    apiClient.get("/stats")
      .then((res) => setStats(res.data))
      .catch(() => {});

    apiClient.get("/cameras")
      .then((res) => setCameraCount(res.data.cameras?.length || 0))
      .catch(() => {});

    const todayDate = new Date().toISOString().split("T")[0];
    apiClient.get(`/attendance?date=${todayDate}`)
      .then((res) => setTodayRecords(res.data.records || []))
      .catch(() => {});

    apiClient.get("/attendance")
      .then((res) => setAllRecords(res.data.records || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  const openOverrideDialog = (r: TodayRecord) => {
    setOverrideRecord(r);
    setNewStatus(r.status.includes("LATE") ? "ON_TIME" : "LATE");
    setOverrideReason("");
    setIsOverrideOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideRecord) return;
    if (!overrideReason.trim()) {
      toast({
        title: "Alasan Wajib Diisi",
        description: "Mohon isi alasan koreksi manual",
        variant: "destructive"
      });
      return;
    }

    try {
      setOverrideSaving(true);
      await apiClient.put(`/attendance/${overrideRecord.id}/override`, {
        new_status: newStatus,
        reason: overrideReason.trim()
      });

      toast({
        title: "Koreksi Berhasil",
        description: `Status ${overrideRecord.name} diubah menjadi ${newStatus}`,
      });

      setIsOverrideOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal Mengoreksi",
        description: err.response?.data?.detail || "Gagal menyimpan perubahan",
        variant: "destructive"
      });
    } finally {
      setOverrideSaving(false);
    }
  };

  // Compute 7 days trend
  const weeklyTrends: DayTrend[] = React.useMemo(() => {
    const days: DayTrend[] = [];
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = dayNames[d.getDay()];

      const dayRecords = allRecords.filter((r) => r.date === dateStr);
      const onTime = dayRecords.filter((r) => r.status.includes("ON_TIME")).length;
      const late = dayRecords.filter((r) => r.status.includes("LATE")).length;

      days.push({
        dayName,
        dateStr,
        total: dayRecords.length,
        onTime,
        late
      });
    }
    return days;
  }, [allRecords]);

  const maxWeekly = Math.max(...weeklyTrends.map((w) => w.total), 5);

  const filteredRecords = todayRecords.filter((r) => {
    const matchName = r.name.toLowerCase().includes(search.toLowerCase());
    if (!matchName) return false;
    if (tabFilter === "in") return !r.check_out;
    if (tabFilter === "out") return Boolean(r.check_out);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner with Live Clock */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Pusat Kontrol Absensi AI
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Dashboard Monitoring Presensi
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 max-w-xl">
            Sistem pengenalan wajah real-time mendeteksi kehadiran, mencatat jam masuk, jam pulang, dan status keterlambatan secara otomatis.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <LiveClock size="lg" />
          <Link to="/recognize" className="flex">
            <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-6 rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
              <ScanFace className="w-5 h-5" /> Buka Scanner
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-zinc-400">Server AI</CardTitle>
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-400">{serverStatus}</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">CPU Engine</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-zinc-400">Karyawan</CardTitle>
            <Users className="h-3.5 w-3.5 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-white">{stats?.total_registered ?? 0}</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Database Wajah</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-zinc-400">Total Hadir</CardTitle>
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-teal-400">{stats?.total_present_today ?? 0}</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Hari ini</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-zinc-400">Tepat Waktu</CardTitle>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-400">{stats?.on_time_today ?? 0}</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Sesuai shift</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-zinc-400">Terlambat</CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-400">{stats?.late_today ?? 0}</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Lewat toleransi</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-zinc-400">Belum Hadir</CardTitle>
            <UserX className="h-3.5 w-3.5 text-rose-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-rose-400">{stats?.absent_today ?? 0}</div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Tidak ada event</p>
          </CardContent>
        </Card>
      </div>

      {/* WEEKLY ATTENDANCE TREND CHART */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
        <CardHeader className="p-4 md:p-6 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Tren Kehadiran 7 Hari Terakhir
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Grafik perbandingan karyawan tepat waktu vs terlambat dalam seminggu
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded bg-emerald-500"></span> Tepat Waktu
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-3 rounded bg-amber-500"></span> Terlambat
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="h-44 flex items-end justify-between gap-3 pt-4">
            {weeklyTrends.map((t, idx) => {
              const onTimeHeight = Math.round((t.onTime / maxWeekly) * 120);
              const lateHeight = Math.round((t.late / maxWeekly) * 120);
              const isToday = idx === 6;

              return (
                <div key={t.dateStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="text-[11px] font-mono text-zinc-400 font-bold">
                    {t.total}
                  </div>

                  {/* Stacked Bar */}
                  <div className="w-full max-w-[40px] flex flex-col items-center justify-end rounded-t-lg overflow-hidden bg-zinc-800/60 p-0.5">
                    {t.late > 0 && (
                      <div
                        style={{ height: `${Math.max(lateHeight, 8)}px` }}
                        className="w-full bg-amber-500 rounded-t transition-all duration-500"
                        title={`${t.dayName}: ${t.late} Terlambat`}
                      ></div>
                    )}
                    {t.onTime > 0 && (
                      <div
                        style={{ height: `${Math.max(onTimeHeight, 8)}px` }}
                        className="w-full bg-emerald-500 rounded-b transition-all duration-500"
                        title={`${t.dayName}: ${t.onTime} Tepat Waktu`}
                      ></div>
                    )}
                  </div>

                  <div className="text-center">
                    <span className={`text-xs font-semibold ${isToday ? "text-indigo-400" : "text-zinc-400"}`}>
                      {t.dayName}
                    </span>
                    <span className="text-[10px] text-zinc-400 block font-mono">
                      {t.dateStr.slice(8)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* DETAILED ATTENDANCE SECTION: WHO CHECKED IN TODAY */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
        <CardHeader className="p-4 md:p-6 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Daftar Karyawan yang Sudah Presensi Hari Ini ({todayRecords.length})
              </CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">
                Rincian kehadiran, jam masuk, jam pulang, dan status keterlambatan karyawan
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTabFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tabFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Semua ({todayRecords.length})
              </button>
              <button
                onClick={() => setTabFilter("in")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tabFilter === "in"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Sedang di Kantor ({todayRecords.filter((r) => !r.check_out).length})
              </button>
              <button
                onClick={() => setTabFilter("out")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tabFilter === "out"
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Sudah Pulang ({todayRecords.filter((r) => r.check_out).length})
              </button>
            </div>
          </div>

          {/* Search bar inside header */}
          <div className="pt-3 max-w-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
              <Input
                placeholder="Cari nama karyawan di daftar presensi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-zinc-950 border-zinc-800 pl-8 text-xs text-white h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs italic">
              {todayRecords.length === 0
                ? "Belum ada karyawan yang melakukan presensi hari ini. Silakan mulai di Scanner Presensi."
                : "Tidak ada data karyawan yang cocok dengan pencarian."}
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {filteredRecords.map((r, index) => {
                const isLate = r.status.includes("LATE");
                const isEarlyLeave = r.status.includes("EARLY_LEAVE");
                const isOverridden = Boolean(r.override);

                return (
                  <div
                    key={r.id || index}
                    className="p-4 hover:bg-zinc-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-sm">
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          {r.name}
                          <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded">
                            {Math.round(r.confidence * 100)}% Cocok
                          </span>
                          {isOverridden && (
                            <span className="text-[10px] text-indigo-400 flex items-center gap-0.5 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-800/40">
                              <ShieldCheck className="w-3 h-3" /> Koreksi Manual
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>Kamera: {r.camera_id || "Webcam"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      {/* Check In info */}
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <span className="text-[10px] text-zinc-400 font-sans block">Masuk</span>
                          <span className="font-bold text-emerald-400">{r.check_in || "-"}</span>
                        </div>
                      </div>

                      {/* Check Out info */}
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                        <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                        <div>
                          <span className="text-[10px] text-zinc-400 font-sans block">Pulang</span>
                          <span className="font-bold text-indigo-400">{r.check_out || "Belum"}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="w-28 text-right font-sans">
                        {isLate ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-400 border border-amber-800/60">
                            Terlambat
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/60">
                            Tepat Waktu
                          </span>
                        )}
                        {isEarlyLeave && (
                          <span className="block text-[10px] text-orange-400 mt-0.5">Pulang Cepat</span>
                        )}
                      </div>

                      {/* Quick Human Override Action Button (Only for Admin) */}
                      {isAuthenticated && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openOverrideDialog(r)}
                          className="text-zinc-400 hover:text-indigo-400 h-8 w-8 ml-1"
                          title="Koreksi Status Manual"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Belum Hadir Alert List */}
      {stats && stats.absent_users && stats.absent_users.length > 0 && (
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader className="p-4 border-b border-zinc-800/80">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-400">
              <UserX className="w-4 h-4" /> Karyawan yang Belum Hadir Hari Ini ({stats.absent_users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {stats.absent_users.map((name) => (
                <span
                  key={name}
                  className="px-3 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300 flex items-center gap-1.5"
                >
                  <User className="w-3 h-3 text-zinc-400" />
                  {name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/register" className="group">
          <Card className="bg-zinc-900/60 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all p-5 h-full flex flex-col justify-between">
            <div>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                Registrasi Wajah Otomatis (10 Foto)
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Fitur pendaftaran otomatis burst 10 foto tanpa klik berulang, menghasilkan model pengenalan multi-angle.
              </p>
            </div>
            <div className="flex items-center text-xs text-indigo-400 font-medium mt-4 group-hover:translate-x-1 transition-transform">
              Buka Pendaftaran <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Card>
        </Link>

        {isAuthenticated ? (
          <Link to="/cameras" className="group">
            <Card className="bg-zinc-900/60 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all p-5 h-full flex flex-col justify-between">
              <div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-3">
                  <Cctv className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  Konfigurasi Kamera & CCTV ({cameraCount})
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Kelola stream RTSP CCTV pintu masuk/keluar, uji koneksi RTSP, dan atur mode check-in otomatis.
                </p>
              </div>
              <div className="flex items-center text-xs text-emerald-400 font-medium mt-4 group-hover:translate-x-1 transition-transform">
                Kelola CCTV <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Card>
          </Link>
        ) : (
          <Link to="/attendance" className="group">
            <Card className="bg-zinc-900/60 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all p-5 h-full flex flex-col justify-between">
              <div>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                  Log Presensi & Rekapitulasi
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Lihat rincian riwayat jam masuk dan pulang karyawan harian serta status ketepatan waktu.
                </p>
              </div>
              <div className="flex items-center text-xs text-indigo-400 font-medium mt-4 group-hover:translate-x-1 transition-transform">
                Buka Log Presensi <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Card>
          </Link>
        )}
      </div>

      {/* Manual Status Override Dialog */}
      <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" /> Koreksi Status Presensi (Human Override)
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Ubah status presensi karyawan jika terjadi kesalahan komputer atau izin dinas.
            </DialogDescription>
          </DialogHeader>

          {overrideRecord && (
            <form onSubmit={handleSaveOverride} className="space-y-4 mt-2">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Nama:</span>
                  <span className="font-bold text-white">{overrideRecord.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Jam Masuk:</span>
                  <span className="text-emerald-400 font-mono">{overrideRecord.check_in || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Status Awal:</span>
                  <span className="font-semibold text-amber-400">{overrideRecord.status}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Pilih Status Baru</Label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ON_TIME">Tepat Waktu (ON_TIME)</option>
                  <option value="LATE">Terlambat (LATE)</option>
                  <option value="EARLY_LEAVE">Pulang Cepat (EARLY_LEAVE)</option>
                  <option value="DISPENSATION">Dispensasi / Tugas Luar</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Alasan Koreksi Manual *</Label>
                <Input
                  required
                  placeholder="Contoh: Kesalahan kamera, Izin dinas luar, dll"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOverrideOpen(false)}
                  className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={overrideSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {overrideSaving ? "Menyimpan..." : "Terapkan Koreksi"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
