import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserPlus,
  ScanFace,
  Users,
  CalendarCheck2,
  Cctv,
  Clock,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  LogIn,
  Camera
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const mainLinks = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/live-snapshot", label: "Live Snapshot", icon: Camera },
    { to: "/recognize", label: "Live Absensi", icon: ScanFace },
    { to: "/register", label: "Register Wajah", icon: UserPlus },
    { to: "/people", label: "Data Karyawan", icon: Users },
    { to: "/attendance", label: "Log Presensi", icon: CalendarCheck2 },
  ];

  const adminLinks = [
    { to: "/register-cctv", label: "Register dari CCTV", icon: Cctv },
    { to: "/cameras", label: "Kamera & CCTV", icon: Cctv },
    { to: "/schedules", label: "Jadwal Multi-Shift", icon: Clock },
    { to: "/audit-logs", label: "Audit Log Trail", icon: ShieldCheck },
    { to: "/settings", label: "Pengaturan AI", icon: SettingsIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="hidden lg:flex w-64 border-r bg-zinc-900/90 border-zinc-800 text-zinc-100 flex-col min-h-screen sticky top-0 h-screen select-none">
      <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
          <ScanFace className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight text-white flex items-center gap-1.5">
            FaceGuard <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </h1>
          <p className="text-[11px] text-zinc-400">AI Attendance System</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Menu Utama
          </div>
          <nav className="space-y-1">
            {mainLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {isAuthenticated && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="px-3 mb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Sistem & Konfigurasi</span>
              <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-800/60 px-1.5 py-0.2 rounded font-mono">
                Admin
              </span>
            </div>
            <nav className="space-y-1">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Admin User Footer & Logout */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 space-y-2">
        {isAuthenticated ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                A
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate">{user?.username || "Admin"}</div>
                <div className="text-[10px] text-emerald-400 font-medium">Administrator</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 h-7 w-7"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <Link to="/login" className="block">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-300 flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Masuk Admin
            </Button>
          </Link>
        )}

        <div className="flex items-center justify-between text-[11px] px-1 text-zinc-400">
          <span>Core Engine</span>
          <span className="text-emerald-400 font-mono">SCRFD + ArcFace</span>
        </div>
      </div>
    </aside>
  );
};
