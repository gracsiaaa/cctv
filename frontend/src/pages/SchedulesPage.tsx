import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Plus, Trash2, Edit3, ShieldAlert, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShiftItem {
  id: string;
  name: string;
  check_in: string;
  check_out: string;
  late_tolerance_minutes: number;
}

export const SchedulesPage: React.FC = () => {
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [checkIn, setCheckIn] = useState("08:00");
  const [checkOut, setCheckOut] = useState("17:00");
  const [lateTolerance, setLateTolerance] = useState(15);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/shifts");
      setShifts(res.data.shifts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingShiftId(null);
    setName("");
    setCheckIn("08:00");
    setCheckOut("17:00");
    setLateTolerance(15);
    setIsDialogOpen(true);
  };

  const openEditDialog = (s: ShiftItem) => {
    setEditingShiftId(s.id);
    setName(s.name);
    setCheckIn(s.check_in);
    setCheckOut(s.check_out);
    setLateTolerance(s.late_tolerance_minutes);
    setIsDialogOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const payload = {
        name,
        check_in: checkIn,
        check_out: checkOut,
        late_tolerance_minutes: Number(lateTolerance)
      };

      if (editingShiftId) {
        await apiClient.put(`/shifts/${editingShiftId}`, payload);
        toast({ title: "Shift Diperbarui", description: `Jadwal ${name} berhasil disimpan` });
      } else {
        await apiClient.post("/shifts", payload);
        toast({ title: "Shift Ditambahkan", description: `Shift ${name} berhasil dibuat` });
      }

      setIsDialogOpen(false);
      fetchShifts();
    } catch (err: any) {
      toast({
        title: "Gagal Menyimpan",
        description: err.response?.data?.detail || "Terjadi kesalahan",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (id: string, shiftName: string) => {
    if (shifts.length <= 1) {
      toast({
        title: "Peringatan",
        description: "Minimal harus ada 1 shift kerja dalam sistem",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiClient.delete(`/shifts/${id}`);
      toast({ title: "Shift Dihapus", description: `Shift ${shiftName} berhasil dihapus` });
      fetchShifts();
    } catch (err) {
      toast({ title: "Gagal", description: "Gagal menghapus shift", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Manajemen Multi-Shift Kerja</h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Konfigurasi berbagai jadwal shift kantor (Pagi, Siang, Malam) dan toleransi keterlambatan
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Shift Baru
        </Button>
      </div>

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-400 text-sm">Memuat shift kerja...</div>
        ) : (
          shifts.map((s) => (
            <Card key={s.id} className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden flex flex-col justify-between">
              <div>
                <CardHeader className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> {s.name}
                  </CardTitle>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    ID: {s.id}
                  </span>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3 text-emerald-400" /> Jam Masuk
                      </div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">{s.check_in}</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-indigo-400" /> Jam Pulang
                      </div>
                      <div className="text-base font-bold text-indigo-400 mt-0.5">{s.check_out}</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800/80 text-xs flex items-center justify-between">
                    <span className="text-zinc-400">Toleransi Keterlambatan:</span>
                    <span className="font-semibold text-amber-400 font-mono">
                      +{s.late_tolerance_minutes} Menit
                    </span>
                  </div>
                </CardContent>
              </div>

              <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/30 flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(s)}
                  className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 text-xs flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteShift(s.id, s.name)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1">
        <div className="font-semibold text-white flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-400" /> Aturan Multi-Shift Sistem:
        </div>
        <p className="text-[11px] text-zinc-400">
          Karyawan dapat dihubungkan ke shift tertentu di halaman <strong>Data Karyawan</strong>. Mesin presensi otomatis mencocokkan jam masuk karyawan dengan toleransi shift masing-masing.
        </p>
      </div>

      {/* Add / Edit Shift Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingShiftId ? "Edit Jadwal Shift" : "Tambah Shift Kerja Baru"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Tentukan jam operasional dan batas toleransi keterlambatan shift.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Nama Shift</Label>
              <Input
                required
                placeholder="Contoh: Shift Pagi, Shift Malam..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Jam Masuk</Label>
                <Input
                  type="time"
                  required
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Jam Pulang</Label>
                <Input
                  type="time"
                  required
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Toleransi Keterlambatan (Menit)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                required
                value={lateTolerance}
                onChange={(e) => setLateTolerance(Number(e.target.value))}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {saving ? "Menyimpan..." : "Simpan Shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
