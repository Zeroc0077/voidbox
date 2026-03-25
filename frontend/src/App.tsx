import { Show, onMount } from "solid-js";
import { authenticated, token, setTokenValue, initSession } from "./stores/auth";
import { currentInbox, refreshStatus, refreshEmails } from "./stores/inbox";
import AuthScreen from "./components/AuthScreen";
import MainScreen from "./components/MainScreen";
import Toast from "./components/Toast";

export default function App() {
  onMount(async () => {
    const t = token();
    if (!t) return;
    try {
      await initSession();
      if (currentInbox()) {
        await Promise.all([refreshStatus(), refreshEmails()]);
      }
    } catch {
      setTokenValue("");
    }
  });

  return (
    <>
      <Show when={authenticated()} fallback={<AuthScreen />}>
        <MainScreen />
      </Show>
      <Toast />
    </>
  );
}
