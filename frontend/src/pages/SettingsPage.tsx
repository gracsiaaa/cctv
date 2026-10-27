import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sliders, Save, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const SettingsPage: React.FC = () => {
  const [threshold, setThreshold] = useState<number>(0.4);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(300);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const res = await apiClient.get("/settings");
      if (res.data) {
        setThreshold(res.data.recognition_threshold ?? 0.4);
        setCooldownSeconds(res.data.cooldown_seconds ?? 300);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiClient.put("/settings", {
        recognition_threshold: Number(threshold),
        cooldown_seconds: Number(cooldownSeconds),
      });

      toast({
        title: "Pengaturan Tersimpan",
        description: "Parameter mesin AI berhasil diperbarui",
      });
    } catch (err) {
      toast({
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan pengaturan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Pengaturan Mesin AI</h2>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Konfigurasi ambang batas akurasi ArcFace dan durasi jeda anti-duplikasi absensi.
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
        <CardHeader className="border-b border-zinc-800 p-4 md:p-6">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" /> Parameter Recognition
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 md:p-6 space-y-4">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-zinc-200">Threshold Kemiripan Wajah</Label>
                <span className="font-mono text-indigo-400 font-semibold">{threshold}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-zinc-400">
                Nilai standar 0.40. Nilai lebih tinggi (misal 0.50) lebih ketat dan mengurangi salah identifikasi.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-zinc-200">Jeda Anti-Duplikasi (Cooldown)</Label>
                <span className="font-mono text-emerald-400 font-semibold">{cooldownSeconds} detik ({Math.round(cooldownSeconds / 60)} menit)</span>
              </div>
              <input
                type="range"
                min="30"
                max="1800"
                step="30"
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <p className="text-[11px] text-zinc-400">
                Mencegah orang yang sama tercatat berulang kali saat berdiri di depan kamera.
              </p>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-2">
              <div className="flex items-center gap-2 font-medium text-white">
                <Cpu className="w-4 h-4 text-indigo-400" /> Informasi Arsitektur AI
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Model Deteksi: <span className="text-white">SCRFD 10G</span></div>
                <div>Model Vektor: <span className="text-white">ArcFace 512-D</span></div>
                <div>Runtime Provider: <span className="text-white">CPUExecution</span></div>
                <div>Storage Engine: <span className="text-white">Persistent JSON</span></div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {loading ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
