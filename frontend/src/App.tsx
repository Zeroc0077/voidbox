import { Show, createSignal, onMount } from "solid-js";
import { authenticated, token, setTokenValue, initSession } from "./stores/auth";
import { currentInbox, refreshStatus, refreshEmails } from "./stores/inbox";
import AuthScreen from "./components/AuthScreen";
import MainScreen from "./components/MainScreen";
import Toast from "./components/Toast";

const [loading, setLoading] = createSignal(true);

export default function App() {
  onMount(async () => {
    const t = token();
    if (!t) {
      setLoading(false);
      return;
    }
    try {
      await initSession();
      if (currentInbox()) {
        await Promise.all([refreshStatus(), refreshEmails()]);
      }
    } catch {
      setTokenValue("");
    }
    setLoading(false);
  });

  return (
    <>
      <Show when={!loading()} fallback={<LoadingScreen />}>
        <Show when={authenticated()} fallback={<AuthScreen />}>
          <MainScreen />
        </Show>
      </Show>
      <Toast />
    </>
  );
}

function LoadingScreen() {
  return (
    <div class="loading-screen">
      <div class="loading-logo">VOIDBOX</div>
      <div class="loading-bar">
        <div class="loading-bar-fill" />
      </div>
    </div>
  );
}
