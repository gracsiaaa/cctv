import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw, UserCheck, Key, Settings } from "lucide-react";

interface AuditLogItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/audit-logs");
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const renderActionBadge = (action: string) => {
    if (action.includes("OVERRIDE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
          <UserCheck className="w-3 h-3" /> Koreksi Status
        </span>
      );
    }
    if (action.includes("DELETE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800/60">
          Penghapusan
        </span>
      );
    }
    if (action.includes("LOGIN")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
          <Key className="w-3 h-3" /> Login Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300">
        <Settings className="w-3 h-3" /> {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" /> Audit Log & Jejak Aktivitas
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Rekam jejak seluruh tindakan administratif, perubahan status absensi manual, dan manajemen sistem
          </p>
        </div>

        <Button
          variant="outline"
          onClick={fetchLogs}
          className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs h-10 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh Log
        </Button>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-zinc-800 bg-zinc-950/50">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-14">No</TableHead>
                <TableHead>Waktu & Tanggal</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Rincian Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                    Memuat riwayat audit...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                    Belum ada catatan audit log tersimpan
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, index) => (
                  <TableRow key={log.id || index} className="border-zinc-800 hover:bg-zinc-800/40">
                    <TableCell className="font-medium text-zinc-400">{index + 1}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300">
                      {new Date(log.timestamp).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </TableCell>
                    <TableCell className="font-semibold text-white text-xs">
                      {log.actor}
                    </TableCell>
                    <TableCell>{renderActionBadge(log.action)}</TableCell>
                    <TableCell className="font-mono text-xs text-indigo-300">
                      {log.target}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300 max-w-md">
                      {log.details}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
