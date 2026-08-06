"use client";

import React, { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface CronLog {
  id: string;
  functionName: string;
  startTime: string;
  endTime?: string;
  status: "running" | "success" | "failed";
  totalSynced?: number;
  cantons?: string[];
  error?: string;
}

interface VaudStats {
  totalCompanies: number;
  lastSyncedAt?: string;
}

export default function AdminDashboard() {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [stats, setStats] = useState<VaudStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const { success, error } = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/cron-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    const interval = setInterval(() => {
      // Skip polling while the tab is hidden to avoid wasted requests
      if (document.hidden) return;
      fetchLogs();
      fetchStats();
    }, 15000); // Refresh every 15s

    // Refresh immediately when the tab becomes visible again
    const onVisible = () => {
      if (!document.hidden) {
        fetchLogs();
        fetchStats();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const handleTriggerSync = async () => {
    setConfirmOpen(false);
    setTriggering(true);

    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      if (res.status === 202) {
        success("Sync started — this runs in the background for a while");
        fetchLogs();
        fetchStats();
      } else if (res.status === 409) {
        error("A sync is already running");
      } else {
        error("Failed to trigger sync");
      }
    } catch (err) {
      console.error("Trigger error:", err);
      error("Error triggering sync");
    } finally {
      setTriggering(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-8 bg-red-600"></div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Administration
            </span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic">
            Dashboard
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Sync Job Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Sync Schedule</CardTitle>
              <Badge variant="active">Active</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <span className="block text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-1">Schedule</span>
                    <span className="font-mono">Daily 02:15 Zurich</span>
                  </div>
                  <div>
                    <span className="block text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-1">Last Job Status</span>
                    {logs.length > 0 ? (
                      <Badge variant={logs[0].status === "success" ? "active" : logs[0].status === "running" ? "accent" : "cancelled"}>
                        {logs[0].status}
                      </Badge>
                    ) : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vaud registry stats & manual trigger */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Canton Vaud</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={triggering}
                className="h-9 px-3 text-[10px]"
              >
                {triggering ? "..." : "Sync Now"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
                <div>
                  <span className="block text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-1">Records</span>
                  <span className="font-mono text-3xl font-black tracking-tighter">
                    {loadingStats ? "..." : (stats?.totalCompanies ?? 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-1">Last Sync</span>
                  <span className="font-mono">
                    {loadingStats ? "..." : formatDate(stats?.lastSyncedAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  <th className="px-4 py-3">Start Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Synced</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading logs...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No logs found</td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const duration = log.endTime 
                      ? `${Math.round((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000)}s` 
                      : "-";
                    
                    return (
                      <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors">
                        <td className="px-4 py-4 font-mono whitespace-nowrap">{formatFullDate(log.startTime)}</td>
                        <td className="px-4 py-4">
                          <span className="font-medium font-mono">{log.functionName}</span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={log.status === "success" ? "active" : log.status === "running" ? "accent" : "cancelled"}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 font-mono text-zinc-500">{duration}</td>
                        <td className="px-4 py-4 font-bold">{log.totalSynced ?? "-"}</td>
                        <td className="px-4 py-4 text-xs text-zinc-500 truncate max-w-[200px]">
                          {log.error ? <span className="text-red-500">{log.error}</span> : log.cantons?.join(", ")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleTriggerSync}
        title="Sync Canton Vaud"
        description="This will trigger a manual search and sync of all companies in Canton Vaud from the official Zefix Registry. This process may take several minutes."
        confirmLabel="Start Sync"
      />
    </Shell>
  );
}
