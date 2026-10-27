import React, { useState, useEffect } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Cctv
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const RegisterFromCCTVPage: React.FC = () => {
  const [name, setName] = useState("");
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const res = await apiClient.get("/cameras");
      setCameras(res.data.cameras || []);
      if (res.data.cameras.length > 0) {
        setSelectedCamera(res.data.cameras[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch cameras", err);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Nama tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCamera) {
      toast({
        title: "Error",
        description: "Pilih kamera CCTV terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      setCapturing(true);
      setProgress("Menghubungkan ke CCTV...");

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("num_samples", "10");

      setProgress("Mengambil 10 sampel wajah dari CCTV (berdiri di depan kamera)...");

      const res = await apiClient.post(
        `/register-face-from-cctv/${selectedCamera}`,
        formData,
        { timeout: 60000 }
      );

      toast({
        title: "Berhasil Registrasi dari CCTV",
        description: `${res.data.samples_captured} sampel wajah berhasil direkam untuk ${name}`,
      });

      setName("");
      setProgress("");
    } catch (err: any) {
      toast({
        title: "Gagal Registrasi",
        description: err.response?.data?.detail || "Gagal mengambil wajah dari CCTV",
        variant: "destructive",
      });
      setProgress("");
    } finally {
      setLoading(false);
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Cctv className="w-6 h-6 text-emerald-400" /> Registrasi Wajah dari CCTV
        </h2>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Sistem akan mengambil 10 foto otomatis dari stream CCTV (angle top-down) untuk registrasi.
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
        <CardContent className="p-4 md:p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-300">
                  Panduan Registrasi dari CCTV:
                </p>
                <ul className="text-xs text-amber-200/80 space-y-1 list-disc list-inside">
                  <li>Pastikan CCTV sudah terdaftar dan online</li>
                  <li>Berdiri di posisi yang sama dengan angle CCTV saat absensi nanti</li>
                  <li>Sistem akan capture 10 frame otomatis (~3-5 detik)</li>
                  <li>Jangan bergerak terlalu cepat, biarkan sistem detect wajah</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white font-semibold">
                Nama Karyawan
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Contoh: John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="camera" className="text-white font-semibold">
                Pilih Kamera CCTV
              </Label>
              <select
                id="camera"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                disabled={loading || cameras.length === 0}
                className="w-full mt-1.5 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {cameras.length === 0 && (
                  <option value="">Tidak ada kamera terdaftar</option>
                )}
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.name} - {cam.location}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress */}
          {capturing && progress && (
            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">{progress}</p>
                <p className="text-xs text-emerald-200/60 mt-0.5">
                  Mohon berdiri di depan kamera dan tunggu...
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleRegister}
            disabled={loading || !name.trim() || !selectedCamera}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-6 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sedang Merekam dari CCTV...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                Mulai Registrasi dari CCTV
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">
              Registrasi ini menggunakan angle CCTV yang sama dengan saat absensi nanti
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">
              Lebih cocok untuk CCTV dengan angle top-down / fisheye
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
