import { currentInbox, renewInbox, deleteInbox, copyAddress } from "../stores/inbox";
import TTLBadge from "./TTLBadge";

export default function InboxActive() {
  return (
    <div class="addr-bar">
      <div class="addr-bar-active">
        <div class="addr-display">{currentInbox()}</div>
        <div class="addr-meta">
          <TTLBadge />
          <button class="btn-icon" onClick={renewInbox} title="Extend 1 hour">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button class="btn-icon" onClick={copyAddress} title="Copy address">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button class="btn-icon btn-icon-danger" onClick={deleteInbox} title="Delete inbox">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
