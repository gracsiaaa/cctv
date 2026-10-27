import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Cctv,
  Plus,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Radio
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface CameraItem {
  id: string;
  name: string;
  rtsp_url: string;
  location: string;
  mode: string;
  status: string;
}

interface WorkerStatus {
  camera_id: string;
  camera_name: string;
  running: boolean;
  connected: boolean;
}

export const CamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [workers, setWorkers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingStreamId, setTogglingStreamId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("AUTO");

  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const fetchCamerasAndWorkers = async () => {
    try {
      setLoading(true);
      const [camRes, streamRes] = await Promise.all([
        apiClient.get("/cameras"),
        apiClient.get("/stream/status").catch(() => ({ data: { workers: [] } }))
      ]);

      setCameras(camRes.data.cameras || []);

      const workerMap: Record<string, boolean> = {};
      ((streamRes.data?.workers || []) as WorkerStatus[]).forEach((w) => {
        workerMap[w.camera_id] = w.running;
      });
      setWorkers(workerMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rtspUrl.trim()) {
      toast({
        title: "Peringatan",
        description: "Nama dan URL RTSP wajib diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiClient.post("/cameras", {
        name,
        rtsp_url: rtspUrl,
        location: location || "Pintu Kantor",
        mode,
      });

      toast({
        title: "Sukses",
        description: `Kamera ${name} berhasil didaftarkan`,
      });

      setIsAddOpen(false);
      setName("");
      setRtspUrl("");
      setLocation("");
      fetchCamerasAndWorkers();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.response?.data?.detail || "Gagal menyimpan data kamera",
        variant: "destructive",
      });
    }
  };

  const testConnection = async (id: string) => {
    try {
      setTestingId(id);
      const res = await apiClient.post(`/cameras/${id}/test`);
      const status = res.data.status;
      if (status === "ONLINE") {
        toast({
          title: "Koneksi Berhasil",
          description: `Stream aktif (${res.data.resolution || "OK"})`,
        });
      } else {
        toast({
          title: "Koneksi Gagal",
          description: res.data.message || "Tidak dapat menghubungi kamera RTSP",
          variant: "destructive",
        });
      }
      fetchCamerasAndWorkers();
    } catch (err: any) {
      toast({
        title: "Error Uji Coba",
        description: "Terjadi kesalahan saat memeriksa stream",
        variant: "destructive",
      });
    } finally {
      setTestingId(null);
    }
  };

  const toggleStreamWorker = async (cam: CameraItem) => {
    const isRunning = workers[cam.id];
    setTogglingStreamId(cam.id);
    try {
      if (isRunning) {
        await apiClient.post(`/stream/stop/${cam.id}`);
        setWorkers((prev) => ({ ...prev, [cam.id]: false }));
        toast({
          title: "Stream Dinonaktifkan",
          description: `Worker AI untuk ${cam.name} telah dihentikan`,
        });
      } else {
        await apiClient.post(`/stream/start/${cam.id}`);
        setWorkers((prev) => ({ ...prev, [cam.id]: true }));
        toast({
          title: "Stream Worker AI Aktif",
          description: `AI sekarang memindai feed RTSP ${cam.name} di background`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Gagal Mengubah Stream",
        description: err.response?.data?.detail || "Gagal memulai background worker",
        variant: "destructive"
      });
    } finally {
      setTogglingStreamId(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await apiClient.delete(`/cameras/${deleteTargetId}`);
      toast({ title: "Dihapus", description: "Kamera berhasil dihapus" });
      setIsDeleteOpen(false);
      setDeleteTargetId(null);
      fetchCamerasAndWorkers();
    } catch (err) {
      toast({ title: "Gagal", description: "Gagal menghapus kamera", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchCamerasAndWorkers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cctv className="w-6 h-6 text-indigo-400" /> Manajemen CCTV & RTSP
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Konfigurasi 1 CCTV utama atau multi-kamera untuk presensi otomatis dan pemantauan event
          </p>
        </div>

        {isAuthenticated && (
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Daftarkan CCTV Baru
          </Button>
        )}
      </div>

      {/* Guide Banner for 1 CCTV vs Multi CCTV */}
      <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-400" />
            Konfigurasi Single CCTV (1 Kamera Saja)
          </span>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Gunakan mode <strong>AUTO (Otomatis)</strong> jika hanya memiliki 1 CCTV. Deteksi pertama setiap hari otomatis tercatat sebagai Check-In (Masuk), dan deteksi berikutnya setelah jeda waktu tercatat sebagai Check-Out (Pulang). Anda dapat menambah CCTV kedua kapan saja (misal untuk pintu keluar).
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-zinc-800 bg-zinc-950/50">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead>Nama Kamera</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Mode Operasi</TableHead>
                  <TableHead>Stream RTSP</TableHead>
                  <TableHead>Background AI Worker</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                      Memuat data kamera...
                    </TableCell>
                  </TableRow>
                ) : cameras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                      Belum ada kamera CCTV terdaftar. Tambahkan 1 CCTV untuk mengaktifkan pemindaian otomatis.
                    </TableCell>
                  </TableRow>
                ) : (
                  cameras.map((cam) => {
                    const isWorkerRunning = Boolean(workers[cam.id]);
                    const isToggling = togglingStreamId === cam.id;

                    return (
                      <TableRow key={cam.id} className="border-zinc-800 hover:bg-zinc-800/40">
                        <TableCell className="font-semibold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                              <Cctv className="w-4 h-4" />
                            </div>
                            <div>
                              <div>{cam.name}</div>
                              <div className="text-[10px] text-zinc-400 font-mono">{cam.id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-300 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {cam.location}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                              cam.mode === "AUTO"
                                ? "bg-indigo-950 text-indigo-300 border border-indigo-800/60"
                                : cam.mode === "CHECK_IN"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                                : cam.mode === "CHECK_OUT"
                                ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                                : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {cam.mode === "AUTO" ? "AUTO (1 CCTV)" : cam.mode}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs text-zinc-400 max-w-[220px] truncate" title={cam.rtsp_url}>
                            {cam.rtsp_url}
                          </div>
                          <div className="mt-1">
                            {cam.status === "ONLINE" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-zinc-400 text-[11px]">
                                <XCircle className="w-3 h-3" /> Standby
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={isToggling}
                            onClick={() => toggleStreamWorker(cam)}
                            className={`text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 ${
                              isWorkerRunning
                                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30"
                                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            }`}
                          >
                            {isWorkerRunning ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5"></span>
                                <Square className="w-3.5 h-3.5" /> AI Aktif
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-indigo-400" /> Jalankan AI
                              </>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={testingId === cam.id}
                            onClick={() => testConnection(cam.id)}
                            className="border-zinc-700 hover:bg-zinc-800 text-xs text-zinc-200 h-8"
                          >
                            {testingId === cam.id ? "Memeriksa..." : "Uji Koneksi"}
                          </Button>
                          {isAuthenticated && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(cam.id)}
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {cameras.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-sm">Belum ada kamera CCTV terdaftar</div>
        ) : (
          cameras.map((cam) => {
            const isWorkerRunning = Boolean(workers[cam.id]);

            return (
              <Card key={cam.id} className="bg-zinc-900 border-zinc-800 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <Cctv className="w-4 h-4 text-indigo-400" /> {cam.name}
                    </h4>
                    <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {cam.location} •{" "}
                      <span className="text-indigo-400 font-semibold">{cam.mode}</span>
                    </div>
                  </div>
                  {cam.status === "ONLINE" ? (
                    <span className="text-emerald-400 text-xs font-semibold">Online</span>
                  ) : (
                    <span className="text-zinc-400 text-xs">Offline</span>
                  )}
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 break-all">
                  {cam.rtsp_url}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    onClick={() => toggleStreamWorker(cam)}
                    className={`text-xs h-8 ${
                      isWorkerRunning
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {isWorkerRunning ? "AI Aktif" : "Jalankan AI"}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={testingId === cam.id}
                      onClick={() => testConnection(cam.id)}
                      className="border-zinc-700 hover:bg-zinc-800 text-xs h-8"
                    >
                      {testingId === cam.id ? "Tes..." : "Uji Koneksi"}
                    </Button>
                    {isAuthenticated && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(cam.id)}
                        className="text-rose-400 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Camera Dialog Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Daftarkan Kamera CCTV Baru</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Masukkan alamat stream RTSP kamera IP atau DVR kantor Anda.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCamera} className="space-y-3.5 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Nama Kamera</Label>
              <Input
                placeholder="Contoh: CCTV Utama Pintu Kantor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Alamat RTSP URL</Label>
              <Input
                placeholder="rtsp://admin:pass@192.168.1.50:554/stream1"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                className="bg-zinc-950 border-zinc-800 font-mono text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Lokasi Pemasangan</Label>
                <Input
                  placeholder="Lobby, Pintu Depan..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Mode Operasi</Label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="AUTO">AUTO (1 CCTV: Masuk & Pulang Otomatis)</option>
                  <option value="CHECK_IN">CHECK-IN (Khusus Pintu Masuk)</option>
                  <option value="CHECK_OUT">CHECK-OUT (Khusus Pintu Keluar)</option>
                  <option value="MONITOR">MONITOR (Hanya Pantau Keamanan)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                Batal
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Simpan CCTV
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Camera Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Kamera</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Apakah Anda yakin ingin menghapus konfigurasi kamera CCTV ini dari sistem?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Hapus Kamera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
