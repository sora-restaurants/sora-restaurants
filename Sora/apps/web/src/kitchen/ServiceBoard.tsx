"use client";

import { useEffect, useState } from "react";

type Request = { id: string; type: string; status: string; notes: string; table: string; createdAt: string };

/** Staff service requests. Same black-and-white kitchen board colours. Does not touch kitchen SSE. */
export function ServiceBoard({ token }: { token: string }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [open, setOpen] = useState(false);

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
    <section className="fixed inset-x-0 bottom-0 z-20 bg-[oklch(13%_0_0)] font-[family-name:var(--font-manrope)] font-extrabold text-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-16 w-full items-center justify-between border-t-4 border-white px-4 text-2xl uppercase"
      >
        <span>Table requests</span>
        <span className="tabular-nums">{requests.length}</span>
      </button>
      {open && (
        <ul className="max-h-[50dvh] space-y-3 overflow-y-auto p-3">
          {requests.length === 0 && <li className="text-xl uppercase">No open requests</li>}
          {requests.map((request) => (
            <li key={request.id} className="border-4 border-white p-3">
              <p className="text-3xl uppercase">{request.table}</p>
              <p className="text-xl uppercase">{request.type} · {request.status}</p>
              <div className="mt-3 flex gap-2">
                {request.status === "open" && (
                  <button type="button" className="min-h-16 flex-1 bg-white text-2xl text-black uppercase" onClick={() => void move(request.id, "acknowledged")}>
                    Acknowledge
                  </button>
                )}
                <button type="button" className="min-h-16 flex-1 border-4 border-white text-2xl uppercase" onClick={() => void move(request.id, "completed")}>
                  Complete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
