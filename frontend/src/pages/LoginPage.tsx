import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock, User, ArrowLeft, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Peringatan",
        description: "Username dan kata sandi wajib diisi",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post("/auth/login", { username, password });
      const data = res.data.data;
      login(data.token, { username: data.username, role: data.role });

      toast({
        title: "Login Berhasil",
        description: `Selamat datang kembali, ${data.username}`,
      });

      navigate("/");
    } catch (err: any) {
      toast({
        title: "Login Gagal",
        description: err.response?.data?.detail || "Kombinasi username atau password salah",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      {/* Back to Live Scanner */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center text-xs">
        <Link
          to="/recognize"
          className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Buka Kiosk Scanner (Publik)
        </Link>
        <span className="text-zinc-400">Panel Administrator</span>
      </div>

      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-extrabold text-white tracking-tight">
            Masuk Admin CCTV
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Akses dashboard konfigurasi, kelola karyawan, dan rekonsiliasi presensi
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Username</Label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                <Input
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 pl-9 text-white h-11 focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Kata Sandi</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 pl-9 text-white h-11 focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>Default Kredensial: <strong>admin</strong> / <strong>admin123</strong></span>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-600/30 text-sm"
            >
              {loading ? "Memverifikasi Kredensial..." : "Masuk ke Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
