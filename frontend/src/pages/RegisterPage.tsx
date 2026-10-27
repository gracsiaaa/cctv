import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  CheckCircle2,
  SwitchCamera,
  Trash2,
  Sparkles,
  Zap,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CAPTURE_GUIDES = [
  "1/10: Tatap lurus ke depan",
  "2/10: Tatap lurus santai",
  "3/10: Tengok sedikit ke kiri",
  "4/10: Tengok sedikit ke kiri",
  "5/10: Tengok sedikit ke kanan",
  "6/10: Tengok sedikit ke kanan",
  "7/10: Tengok sedikit ke atas",
  "8/10: Tengok sedikit ke bawah",
  "9/10: Berikan senyuman natural",
  "10/10: Ekspresi netral sempurna!"
];

export const RegisterPage: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [name, setName] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const isCancelledRef = useRef<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
    };
  }, []);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Automated 10-photo burst capture (Strictly 10 photos)
  const startAutoCapture = async () => {
    if (isAutoCapturing) return;
    isCancelledRef.current = false;
    setIsAutoCapturing(true);
    setCapturedImages([]);

    // 1. Countdown 3.. 2.. 1..
    for (let c = 3; c > 0; c--) {
      if (isCancelledRef.current) {
        setIsAutoCapturing(false);
        setCountdown(null);
        return;
      }
      setCountdown(c);
      await sleep(1000);
    }
    setCountdown(null);

    // 2. Exactly 10 photos loop
    const photos: string[] = [];
    for (let step = 1; step <= 10; step++) {
      if (isCancelledRef.current) break;

      setCurrentStep(step);

      let img = webcamRef.current?.getScreenshot();
      if (!img) {
        await sleep(150);
        img = webcamRef.current?.getScreenshot();
      }

      if (img) {
        photos.push(img);
        setCapturedImages([...photos]);
      }

      // Interval 450ms between shots
      await sleep(450);
    }

    setIsAutoCapturing(false);
    setCurrentStep(0);

    if (photos.length > 0) {
      toast({
        title: `Selesai Mengambil ${photos.length} Foto!`,
        description: `${photos.length} sampel sudut wajah berhasil ditangkap secara otomatis`,
      });
    }
  };

  const captureSingle = useCallback(() => {
    const image = webcamRef.current?.getScreenshot();
    if (image) {
      if (capturedImages.length >= 10) {
        toast({
          title: "Batas Tercapai",
          description: "Maksimal 10 foto per sesi registrasi",
          variant: "destructive"
        });
        return;
      }
      setCapturedImages((prev) => [...prev, image]);
    }
  }, [webcamRef, capturedImages]);

  const removePhoto = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetAllPhotos = () => {
    setCapturedImages([]);
    toast({ title: "Foto Direset", description: "Silakan ambil foto kembali" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Peringatan",
        description: "Nama karyawan wajib diisi",
        variant: "destructive",
      });
      return;
    }

    if (capturedImages.length === 0) {
      toast({
        title: "Peringatan",
        description: "Ambil minimal 1 foto wajah",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;

      for (const imgBase64 of capturedImages) {
        const res = await fetch(imgBase64);
        const blob = await res.blob();

        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("file", blob, "photo.jpg");

        await apiClient.post("/register-face", formData);
        successCount++;
      }

      toast({
        title: "Berhasil Mendaftarkan Karyawan",
        description: `${successCount} sampel vektor wajah disimpan untuk ${name}`,
      });

      setName("");
      setCapturedImages([]);
    } catch (err: any) {
      toast({
        title: "Gagal Mendaftarkan",
        description: err.response?.data?.detail || "Gagal memproses pendaftaran wajah",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-400" /> Registrasi Wajah Otomatis
        </h2>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Sistem akan mengambil 10 foto otomatis secara beruntun dari berbagai sudut wajah untuk akurasi terbaik.
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
        <CardContent className="p-4 md:p-6 space-y-4">
          {/* Camera Viewport */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-inner flex items-center justify-center">
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

            {/* Quick Actions overlay */}
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleCamera}
                disabled={isAutoCapturing}
                className="bg-black/60 border-zinc-700/80 text-white hover:bg-black/80 rounded-full h-9 w-9 backdrop-blur-md"
                title="Ganti Kamera"
              >
                <SwitchCamera className="w-4 h-4" />
              </Button>
            </div>

            {/* Face guideline frame */}
            <div className="absolute pointer-events-none inset-x-0 inset-y-0 flex items-center justify-center">
              <div
                className={`w-48 h-60 md:w-56 md:h-72 border-2 rounded-full transition-colors ${
                  isAutoCapturing
                    ? "border-emerald-400 animate-pulse border-solid"
                    : "border-dashed border-indigo-400/50"
                }`}
              ></div>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                <span className="text-7xl font-extrabold text-amber-400 animate-bounce">
                  {countdown}
                </span>
                <span className="text-sm font-semibold mt-2 text-zinc-200">
                  Bersiap di depan kamera...
                </span>
              </div>
            )}

            {/* Auto Capture Progress Overlay */}
            {isAutoCapturing && (
              <div className="absolute bottom-3 inset-x-3 bg-black/80 backdrop-blur-md border border-zinc-700/80 p-2.5 rounded-xl flex items-center justify-between text-white z-20">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {CAPTURE_GUIDES[currentStep - 1] || "Mengambil foto..."}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">
                  {capturedImages.length}/10 Foto
                </span>
              </div>
            )}
          </div>

          {/* Trigger Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              onClick={startAutoCapture}
              disabled={isAutoCapturing || countdown !== null}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 text-amber-300" />
              {capturedImages.length >= 10
                ? "Ambil Ulang 10 Foto Otomatis"
                : "Mulai Ambil 10 Foto Otomatis"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={captureSingle}
              disabled={isAutoCapturing || capturedImages.length >= 10}
              className="w-full sm:w-auto border-zinc-700 hover:bg-zinc-800 text-zinc-200 rounded-xl px-4 py-6 text-xs flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> Ambil 1 Manual
            </Button>

            {capturedImages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={resetAllPhotos}
                disabled={isAutoCapturing}
                className="text-zinc-400 hover:text-rose-400 text-xs py-6"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Foto
              </Button>
            )}
          </div>

          {/* Thumbnail Gallery (Up to 10 photos) */}
          {capturedImages.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-zinc-800">
              <div className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                <span>Galeri Sampel Wajah ({capturedImages.length}/10 Foto)</span>
                <span className="text-[10px] text-zinc-400">Semua foto akan di-encode ke database</span>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {capturedImages.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 group"
                  >
                    <img src={src} alt={`sample-${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute inset-0 bg-red-950/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <span className="absolute bottom-0.5 left-0.5 bg-black/80 text-[8px] text-white px-1 rounded">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Submit */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-3 border-t border-zinc-800">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-zinc-200">
                Nama Lengkap Karyawan
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="bg-zinc-950 border-zinc-800 text-white h-11 focus-visible:ring-indigo-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || capturedImages.length === 0 || !name.trim() || isAutoCapturing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 rounded-xl text-sm"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" /> Sedang Menyimpan {capturedImages.length} Vektor Wajah...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Simpan Identitas & {capturedImages.length} Foto Wajah
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
