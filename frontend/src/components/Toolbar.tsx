import { createSignal, Show } from "solid-js";
import { emails, clearEmails, refreshEmails, setFilterFrom } from "../stores/inbox";
import FilterRow from "./FilterRow";

export default function Toolbar() {
  const [filterVisible, setFilterVisible] = createSignal(false);
  const [spinning, setSpinning] = createSignal(false);

  async function doRefresh() {
    setSpinning(true);
    await refreshEmails();
    setTimeout(() => setSpinning(false), 400);
  }

  function toggleFilter() {
    if (filterVisible()) {
      setFilterVisible(false);
      setFilterFrom("");
      refreshEmails();
    } else {
      setFilterVisible(true);
    }
  }

  return (
    <>
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="mail-count">
            {emails().length} email{emails().length !== 1 ? "s" : ""}
          </span>
        </div>
        <div class="toolbar-right">
          <div class="view-toggle">
            <button onClick={toggleFilter} class={filterVisible() ? "active" : ""} title="Filter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          </div>
          <button class="btn-icon btn-icon-danger" onClick={clearEmails} title="Clear all emails">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
            </svg>
          </button>
          <button class={`btn-icon ${spinning() ? "spinning" : ""}`} onClick={doRefresh} title="Refresh inbox">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>
      </div>
      <Show when={filterVisible()}>
        <FilterRow />
      </Show>
    </>
  );
}
