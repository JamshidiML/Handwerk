"use client";

import { CloudOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectivityNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <CloudOff size={18} aria-hidden="true" />
      <span>
        <strong>Keine Verbindung.</strong> Gespeicherte Demodaten bleiben
        sichtbar; neue Eingaben werden erst nach Wiederherstellung übernommen.
      </span>
    </div>
  );
}
