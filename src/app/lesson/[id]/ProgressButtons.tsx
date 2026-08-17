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

  async function updateProgress(status: string) {
    setLoading(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, status }),
      });
      router.refresh();
    } catch {
      alert("Failed to update progress");
    }
    setLoading(false);
  }

  return (
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
  );
}
