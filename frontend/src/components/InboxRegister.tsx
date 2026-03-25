import { createSignal } from "solid-js";
import { mailDomains, selectedDomain, setSelectedDomain, register } from "../stores/inbox";
import CustomSelect from "./CustomSelect";

export default function InboxRegister() {
  const [prefix, setPrefix] = createSignal("");

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") register(prefix(), selectedDomain());
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
        <CustomSelect
          options={mailDomains()}
          value={selectedDomain()}
          onChange={setSelectedDomain}
        />
        <button class="btn-primary" onClick={() => register(prefix(), selectedDomain())}>
          Register
        </button>
      </div>
    </div>
  );
}
