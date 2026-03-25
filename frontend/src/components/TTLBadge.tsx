import { createSignal, createEffect, onCleanup } from "solid-js";
import { expiresAt, expireInbox } from "../stores/inbox";

export default function TTLBadge() {
  const [display, setDisplay] = createSignal("--:--");
  const [warn, setWarn] = createSignal(false);

  createEffect(() => {
    const exp = expiresAt();
    if (!exp) {
      setDisplay("--:--");
      return;
    }

    const update = () => {
      const remaining = Math.max(0, exp * 1000 - Date.now());
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDisplay(String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"));
      setWarn(remaining < 300000);

      if (remaining <= 0) {
        setDisplay("EXPIRED");
        setWarn(true);
        if (interval) clearInterval(interval);
        expireInbox();
      }
    };

    update();
    let interval: ReturnType<typeof setInterval> | undefined = setInterval(update, 1000);
    onCleanup(() => { if (interval) clearInterval(interval); });
  });

  return <span class={`ttl-badge ${warn() ? "warn" : ""}`}>{display()}</span>;
}
