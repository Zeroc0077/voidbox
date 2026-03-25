import { createSignal, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { api } from "../lib/api";
import { currentInbox, refreshEmails } from "../stores/inbox";
import { showToast } from "../stores/toast";
import { avatarColor, avatarInitial, formatDate, formatHeaders } from "../lib/utils";

interface MailDetail {
  id: string;
  from: string;
  forwardFrom?: string;
  inbox: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  receivedAt: number;
}

interface Props {
  emailId: string;
  onClose: () => void;
}

export default function EmailDetail(props: Props) {
  const [mail, setMail] = createSignal<MailDetail | null>(null);
  const [view, setView] = createSignal<"html" | "text">("html");
  const [headersVisible, setHeadersVisible] = createSignal(false);

  onMount(async () => {
    try {
      const m = await api<MailDetail>(
        "GET",
        "/mail/" + encodeURIComponent(currentInbox()) + "/" + encodeURIComponent(props.emailId)
      );
      setMail(m);
      setView(m.html ? "html" : "text");
    } catch {
      showToast("Failed to load email", "error");
      props.onClose();
    }
  });

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") props.onClose();
  }

  onMount(() => document.addEventListener("keydown", onKeyDown));
  onCleanup(() => document.removeEventListener("keydown", onKeyDown));

  async function doDelete() {
    const m = mail();
    if (!m) return;
    try {
      await api<any>(
        "DELETE",
        "/mail/" + encodeURIComponent(currentInbox()) + "/" + encodeURIComponent(m.id)
      );
      props.onClose();
      refreshEmails();
      showToast("Email deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
  }

  function renderBody() {
    const m = mail();
    if (!m) return null;

    if (view() === "html" && m.html) {
      const darkWrapper =
        '<style>html,body{background:#161822;color:#e8e6e1;font-family:system-ui,sans-serif;margin:0;padding:12px}a{color:#d4a53c}img{max-width:100%;height:auto}</style>';
      return <iframe sandbox="" srcdoc={darkWrapper + m.html} />;
    }
    if (m.text) {
      return <pre>{m.text}</pre>;
    }
    return <pre style={{ color: "var(--text-muted)", "font-style": "italic" }}>(empty body)</pre>;
  }

  return (
    <Portal>
      <Show when={mail()}>
        {(m) => {
          const color = () => avatarColor(m().from);
          const initial = () => avatarInitial(m().from);
          const headerStr = () => formatHeaders(m().headers);

          return (
            <div class="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
              <div class="detail-panel">
                <div class="detail-header">
                  <div class="detail-subject">{m().subject || "(no subject)"}</div>
                  <button class="btn-icon" onClick={props.onClose} title="Close (ESC)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div class="detail-sender">
                  <div class="sender-avatar" style={{ background: color() }}>{initial()}</div>
                  <div class="sender-details">
                    <div class="sender-name">{m().from.split("@")[0] || "?"}</div>
                    <div class="sender-addr">{m().from}</div>
                  </div>
                </div>
                <div class="detail-meta">
                  <div class="detail-meta-item">
                    <span class="label">To:</span> <span>{m().inbox}</span>
                  </div>
                  <div class="detail-meta-item">
                    <span class="label">Date:</span> <span>{formatDate(m().receivedAt)}</span>
                  </div>
                  {m().forwardFrom && m().forwardFrom !== m().from && (
                    <div class="detail-meta-item">
                      <span class="label">Via:</span> <span>{m().forwardFrom}</span>
                    </div>
                  )}
                </div>
                <Show when={!!m().html && !!m().text}>
                  <div class="detail-view-tabs">
                    <button
                      class={`detail-view-tab ${view() === "html" ? "active" : ""}`}
                      onClick={() => setView("html")}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={{ "vertical-align": "-2px", "margin-right": "4px" }}>
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                      HTML
                    </button>
                    <button
                      class={`detail-view-tab ${view() === "text" ? "active" : ""}`}
                      onClick={() => setView("text")}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={{ "vertical-align": "-2px", "margin-right": "4px" }}>
                        <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" />
                        <line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                      </svg>
                      Text
                    </button>
                  </div>
                </Show>
                <div class="detail-body">
                  {renderBody()}
                  <Show when={headerStr()}>
                    <button class="detail-headers-toggle" onClick={() => setHeadersVisible(!headersVisible())}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      Raw headers
                    </button>
                    <Show when={headersVisible()}>
                      <pre class="detail-headers-pre">{headerStr()}</pre>
                    </Show>
                  </Show>
                </div>
                <div class="detail-actions">
                  <button class="btn-ghost" onClick={props.onClose}>Close</button>
                  <button class="btn-danger" onClick={doDelete}>Delete</button>
                </div>
              </div>
            </div>
          );
        }}
      </Show>
    </Portal>
  );
}
