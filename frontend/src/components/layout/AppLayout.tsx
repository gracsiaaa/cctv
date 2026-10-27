import React from "react";
import { Outlet, Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Toaster } from "@/components/ui/toaster";
import { ScanFace, Settings, ShieldCheck, LogIn, LogOut, User } from "lucide-react";
import { LiveClock } from "@/components/common/LiveClock";
import { NotificationBell } from "@/components/common/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="flex bg-zinc-950 text-zinc-100 min-h-screen antialiased">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header with Live Clock & Notification & Login button */}
        <header className="lg:hidden sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <ScanFace className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-xs tracking-tight text-white flex items-center gap-1">
                FaceGuard <ShieldCheck className="w-3 h-3 text-emerald-400" />
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <LiveClock size="sm" showDate={false} />

            {isAuthenticated ? (
              <button
                onClick={logout}
                title="Keluar Admin"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/login"
                title="Masuk Admin"
                className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-950/60 transition-colors"
              >
                <LogIn className="w-4 h-4" />
              </Link>
            )}

            {isAuthenticated && (
              <Link
                to="/settings"
                title="Pengaturan AI"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </Link>
            )}
          </div>
        </header>

        {/* Desktop Top Header Bar with Live Clock, Notifications & Admin Status */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-8 py-3.5 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-zinc-400">
              Sistem CCTV & Attendance Engine: <strong className="text-emerald-400">ONLINE</strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <LiveClock size="md" />

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-3 border-l border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-white">{user?.username || "Admin"}</span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-1 rounded">
                    Admin
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 text-xs h-8"
                  title="Keluar dari akun admin"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Keluar
                </Button>
              </div>
            ) : (
              <Link to="/login" className="pl-3 border-l border-zinc-800">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl h-8 px-3 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <LogIn className="w-3.5 h-3.5" /> Masuk Admin
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
};
