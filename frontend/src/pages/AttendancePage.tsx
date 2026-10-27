import React, { useEffect, useState } from "react";
import { apiClient, API_URL } from "@/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Edit2,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface AttendanceRecord {
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
    overridden_by: string;
    overridden_at: string;
  };
}

export const AttendancePage: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const { isAuthenticated } = useAuth();

  // Manual Override Dialog State
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("ON_TIME");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const { toast } = useToast();

  const fetchRecords = async (date?: string) => {
    try {
      setLoading(true);
      const url = date ? `/attendance?date=${date}` : "/attendance";
      const res = await apiClient.get(url);
      setRecords(res.data.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(filterDate);
  }, [filterDate]);

  const openOverrideDialog = (record: AttendanceRecord) => {
    setOverrideRecord(record);
    setNewStatus(record.status.includes("LATE") ? "ON_TIME" : "LATE");
    setOverrideReason("");
    setIsOverrideOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideRecord) return;
    if (!overrideReason.trim()) {
      toast({
        title: "Alasan Wajib Diisi",
        description: "Mohon isi alasan koreksi manual untuk kebutuhan audit trail",
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
        title: "Status Berhasil Dikoreksi",
        description: `Presensi ${overrideRecord.name} diubah menjadi ${newStatus}`,
      });

      setIsOverrideOpen(false);
      fetchRecords(filterDate);
    } catch (err: any) {
      toast({
        title: "Gagal Mengoreksi",
        description: err.response?.data?.detail || "Terjadi kesalahan saat menyimpan",
        variant: "destructive"
      });
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleExportCSV = () => {
    const url = `${API_URL}/attendance/export?date=${filterDate}`;
    window.open(url, "_blank");
  };

  const renderStatusBadge = (r: AttendanceRecord) => {
    const status = r.status;
    const isOverridden = Boolean(r.override);

    let badge = null;
    if (status.includes("ON_TIME")) {
      badge = (
        <span className="inline-flex items-center gap-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2.5 py-0.5 rounded-full text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Tepat Waktu
        </span>
      );
    } else if (status.includes("LATE")) {
      badge = (
        <span className="inline-flex items-center gap-1 bg-amber-950/60 text-amber-400 border border-amber-800/60 px-2.5 py-0.5 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5" /> Terlambat
        </span>
      );
    } else if (status.includes("EARLY_LEAVE")) {
      badge = (
        <span className="inline-flex items-center gap-1 bg-orange-950/60 text-orange-400 border border-orange-800/60 px-2.5 py-0.5 rounded-full text-xs font-medium">
          <Clock className="w-3.5 h-3.5" /> Pulang Cepat
        </span>
      );
    } else {
      badge = (
        <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
          {status}
        </span>
      );
    }

    return (
      <div className="flex flex-col items-end gap-1">
        {badge}
        {isOverridden && (
          <span
            className="text-[10px] text-indigo-400 flex items-center gap-1 font-sans cursor-help"
            title={`Koreksi: ${r.override?.reason}`}
          >
            <ShieldCheck className="w-3 h-3 text-indigo-400" /> Koreksi Admin
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Log Presensi Karyawan</h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Data rekap absensi harian dan koreksi status kehadiran manual jika terjadi kesalahan perangkat
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs h-10 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-indigo-400" /> Unduh CSV
          </Button>

          <div className="relative">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-white text-xs h-10 w-40"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => fetchRecords(filterDate)}
            className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 h-10"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-zinc-800 bg-zinc-950/50">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-14">No</TableHead>
                  <TableHead>Nama Karyawan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jam Masuk</TableHead>
                  <TableHead>Jam Pulang</TableHead>
                  <TableHead>Kamera</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  {isAuthenticated && <TableHead className="w-16 text-center">Koreksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAuthenticated ? 8 : 7} className="text-center py-8 text-zinc-400">
                      Memuat data presensi...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAuthenticated ? 8 : 7} className="text-center py-8 text-zinc-400">
                      Tidak ada catatan presensi pada tanggal {filterDate}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r, index) => (
                    <TableRow key={r.id || index} className="border-zinc-800 hover:bg-zinc-800/40">
                      <TableCell className="font-medium text-zinc-400">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-white">{r.name}</TableCell>
                      <TableCell className="text-zinc-400 text-xs">{r.date}</TableCell>
                      <TableCell className="text-emerald-400 font-mono text-xs">
                        <span className="inline-flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" /> {r.check_in || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-indigo-400 font-mono text-xs">
                        {r.check_out ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" /> {r.check_out}
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic">Belum Pulang</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">{r.camera_id || "webcam"}</TableCell>
                      <TableCell className="text-right">{renderStatusBadge(r)}</TableCell>
                      {isAuthenticated && (
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openOverrideDialog(r)}
                            className="text-zinc-400 hover:text-indigo-300 hover:bg-indigo-950/40 h-8 w-8"
                            title="Koreksi Status Manual (Human Override)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-zinc-400 text-sm">Memuat log presensi...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-sm">
            Tidak ada data presensi pada {filterDate}
          </div>
        ) : (
          records.map((r) => (
            <Card key={r.id} className="bg-zinc-900 border-zinc-800 p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-base">{r.name}</h4>
                  <div className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" /> {r.date}
                  </div>
                </div>
                {renderStatusBadge(r)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 font-sans">Masuk</div>
                  <div className="text-emerald-400 font-semibold">{r.check_in || "-"}</div>
                </div>
                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 font-sans">Pulang</div>
                  <div className="text-indigo-400 font-semibold">{r.check_out || "-"}</div>
                </div>
              </div>

              {isAuthenticated && (
                <div className="pt-2 border-t border-zinc-800/80 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openOverrideDialog(r)}
                    className="border-zinc-700 hover:bg-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-indigo-400" /> Koreksi Status Manual
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Manual Status Override Dialog */}
      <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" /> Koreksi Status Kehadiran (Human Override)
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Ubah status presensi karyawan jika terjadi kesalahan deteksi kamera atau toleransi khusus.
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
                  placeholder="Contoh: Kamera gerbang lag, Izin dinas luar, dll"
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
