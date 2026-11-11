"use client";

import { useEffect, useState } from "react";

type Request = { id: string; type: string; status: string; notes: string; table: string; createdAt: string };

/** Staff service requests. Polls every 4 seconds. Does not touch kitchen SSE. */
export function ServiceBoard({ token }: { token: string }) {
  const [requests, setRequests] = useState<Request[]>([]);

  async function load() {
    const res = await fetch("/api/service-requests", { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const body = await res.json();
    setRequests(body.requests ?? []);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [token]);

  async function move(id: string, to: string) {
    await fetch("/api/service-requests", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id, to }),
    });
    await load();
  }

  return (
    <section className="mt-6 rounded-theme border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">Table requests</h2>
      {requests.length === 0 && <p className="mt-2 text-sm text-muted">No open requests.</p>}
      <ul className="mt-3 space-y-2">
        {requests.map((request) => (
          <li key={request.id} className="rounded-theme border border-line p-3">
            <p className="font-semibold">{request.table} · {request.type}</p>
            <p className="text-sm text-muted">{request.status}{request.notes ? ` · ${request.notes}` : ""}</p>
            <div className="mt-2 flex gap-2">
              {request.status === "open" && (
                <button type="button" className="min-h-tap rounded-full bg-accent px-4 text-sm text-on-accent" onClick={() => void move(request.id, "acknowledged")}>
                  Acknowledge
                </button>
              )}
              <button type="button" className="min-h-tap rounded-full border border-line px-4 text-sm" onClick={() => void move(request.id, "completed")}>
                Complete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
