import { createSignal, createMemo, Show, For } from "solid-js";
import { mailDomains, selectedDomain, setSelectedDomain, register, relayEnabled, relayDomains, relayInboxes, registerRelay } from "../stores/inbox";
import CustomSelect from "./CustomSelect";

export default function InboxRegister() {
  const [prefix, setPrefix] = createSignal("");
  const [subdomain, setSubdomain] = createSignal("");
  const [relayPrefix, setRelayPrefix] = createSignal("");
  const [selectedRelayDomain, setSelectedRelayDomain] = createSignal("");
  const [mode, setMode] = createSignal<"direct" | "relay">("direct");
  const [showRelayInboxes, setShowRelayInboxes] = createSignal(false);

  const isWildcard = createMemo(() => selectedDomain().startsWith("*."));
  const wildcardSuffix = createMemo(() => selectedDomain().slice(2));

  function switchMode(m: "direct" | "relay") {
    setMode(m);
    if (m === "relay" && !selectedRelayDomain() && relayDomains().length > 0) {
      setSelectedRelayDomain(relayDomains()[0]);
    }
  }

  function buildDomain() {
    if (isWildcard()) {
      const sub = subdomain().trim().toLowerCase();
      return sub ? `${sub}.${wildcardSuffix()}` : "";
    }
    return selectedDomain();
  }

  function onSubmit() {
    if (mode() === "relay") {
      const addr = relayPrefix().trim() + (selectedRelayDomain() ? "@" + selectedRelayDomain() : "");
      registerRelay(addr);
    } else {
      register(prefix(), buildDomain());
    }
  }

  function onQuickRegister(addr: string) {
    setShowRelayInboxes(false);
    const [prefix, domain] = addr.split("@");
    register(prefix, domain);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") onSubmit();
  }

  return (
    <div class="addr-bar addr-bar-register">
      <Show when={relayEnabled()}>
        <div class="register-mode-bar">
          <div class="view-toggle register-mode-toggle">
            <button class={mode() === "direct" ? "active" : ""} onClick={() => switchMode("direct")}>Direct</button>
            <button class={mode() === "relay" ? "active" : ""} onClick={() => switchMode("relay")}>Relay</button>
          </div>
          <Show when={mode() === "relay" && relayInboxes().length > 0}>
            <button class="btn-relay-inboxes" onClick={() => setShowRelayInboxes(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Inboxes
              <span class="relay-inbox-count">{relayInboxes().length}</span>
            </button>
          </Show>
        </div>
      </Show>

      <Show when={mode() === "relay"} fallback={
        <div class="row">
          <input
            placeholder="prefix"
            autocomplete="off"
            value={prefix()}
            onInput={(e) => setPrefix(e.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <span class="at">@</span>
          {isWildcard() ? (
            <>
              <input
                class="subdomain-input"
                placeholder="subdomain"
                autocomplete="off"
                value={subdomain()}
                onInput={(e) => setSubdomain(e.currentTarget.value)}
                onKeyDown={onKeyDown}
              />
              <span class="at">.</span>
            </>
          ) : null}
          <CustomSelect
            options={mailDomains()}
            value={selectedDomain()}
            onChange={(v) => { setSelectedDomain(v); setSubdomain(""); }}
            displayFn={(v) => v.startsWith("*.") ? v.slice(1) : v}
          />
          <button class="btn-primary" onClick={onSubmit}>
            Register
          </button>
        </div>
      }>
        <div class="row">
          <input
            placeholder="prefix"
            autocomplete="off"
            value={relayPrefix()}
            onInput={(e) => setRelayPrefix(e.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <span class="at">@</span>
          <CustomSelect
            options={relayDomains()}
            value={selectedRelayDomain()}
            onChange={(v) => setSelectedRelayDomain(v)}
          />
          <button class="btn-primary" onClick={onSubmit}>
            Register
          </button>
        </div>
      </Show>

      <Show when={showRelayInboxes()}>
        <div class="relay-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRelayInboxes(false); }}>
          <div class="relay-panel">
            <div class="relay-panel-header">
              <span class="relay-panel-title">Relay Inboxes</span>
              <button class="btn-icon" onClick={() => setShowRelayInboxes(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="relay-panel-list">
              <For each={relayInboxes()}>
                {(addr) => (
                  <div class="relay-inbox-item">
                    <span class="relay-inbox-addr">{addr}</span>
                    <button class="btn-relay-register" onClick={() => onQuickRegister(addr)}>
                      Register
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
