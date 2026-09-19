"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProgressButtonsProps {
  lessonId: number;
  currentStatus: string | null;
}

export default function ProgressButtons({
  lessonId,
  currentStatus,
}: ProgressButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function updateProgress(status: "in_progress" | "completed") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lessonId,
          event: "manual",
          status,
          positionSeconds: 0,
          furthestPositionSeconds: 0,
          durationSeconds: null,
          watchedSeconds: 0,
          percentComplete: status === "completed" ? 100 : 0,
          activelyPlaying: false,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Progress could not be updated");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Progress could not be updated");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-[var(--danger)] mb-2">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        {currentStatus !== "in_progress" && (
          <button
            className="btn small secondary"
            onClick={() => updateProgress("in_progress")}
            disabled={loading}
          >
            Mark In Progress
          </button>
        )}
        {currentStatus !== "completed" && (
          <button
            className="btn small ok"
            onClick={() => updateProgress("completed")}
            disabled={loading}
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
