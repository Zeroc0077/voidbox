import { createSignal, createMemo } from "solid-js";
import { mailDomains, selectedDomain, setSelectedDomain, register } from "../stores/inbox";
import CustomSelect from "./CustomSelect";

export default function InboxRegister() {
  const [prefix, setPrefix] = createSignal("");
  const [subdomain, setSubdomain] = createSignal("");

  const isWildcard = createMemo(() => selectedDomain().startsWith("*."));
  const wildcardSuffix = createMemo(() => selectedDomain().slice(2));

  function buildDomain() {
    if (isWildcard()) {
      const sub = subdomain().trim().toLowerCase();
      return sub ? `${sub}.${wildcardSuffix()}` : "";
    }
    return selectedDomain();
  }

  function onSubmit() {
    register(prefix(), buildDomain());
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") onSubmit();
  }

  return (
    <div class="addr-bar addr-bar-register">
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
    </div>
  );
}
