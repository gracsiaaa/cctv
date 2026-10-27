import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ScanFace, CalendarCheck2, Cctv, Users, Camera } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const items = [
    { to: "/", label: "Beranda", icon: LayoutDashboard },
    { to: "/live-snapshot", label: "Snapshot", icon: Camera },
    { to: "/recognize", label: "Absensi", icon: ScanFace, highlight: true },
    { to: "/attendance", label: "Log", icon: CalendarCheck2 },
    isAuthenticated
      ? { to: "/cameras", label: "CCTV", icon: Cctv }
      : { to: "/people", label: "Karyawan", icon: Users },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 px-2 py-1.5 flex justify-around items-center">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to;

        if (item.highlight) {
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div
                className={`p-3 rounded-full shadow-lg transition-transform active:scale-95 ${
                  isActive
                    ? "bg-indigo-500 text-white ring-4 ring-zinc-950"
                    : "bg-indigo-600 text-white"
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-medium text-zinc-300 mt-1">{item.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors ${
              isActive ? "text-indigo-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
