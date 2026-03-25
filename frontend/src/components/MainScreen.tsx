import { createSignal, Show } from "solid-js";
import { logout } from "../stores/auth";
import { currentInbox } from "../stores/inbox";
import Logo from "./Logo";
import InboxRegister from "./InboxRegister";
import InboxActive from "./InboxActive";
import Toolbar from "./Toolbar";
import EmailList from "./EmailList";
import EmailDetail from "./EmailDetail";

export default function MainScreen() {
  const [selectedEmailId, setSelectedEmailId] = createSignal<string | null>(null);

  // Note: inbox data loading (refreshStatus + refreshEmails) is triggered
  // by App.tsx on auto-login, not here, to avoid double API calls.

  return (
    <>
      <div class="shell">
        <Logo />
        <button class="logout-btn" onClick={logout}>
          Logout
        </button>

        <Show when={currentInbox()} fallback={<InboxRegister />}>
          <InboxActive />
          <Toolbar />
          <EmailList onSelectEmail={(id) => setSelectedEmailId(id)} />
        </Show>
      </div>

      <Show when={selectedEmailId()}>
        {(id) => (
          <EmailDetail
            emailId={id()}
            onClose={() => setSelectedEmailId(null)}
          />
        )}
      </Show>
    </>
  );
}
