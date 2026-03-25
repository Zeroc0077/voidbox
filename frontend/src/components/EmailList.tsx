import { For, Show } from "solid-js";
import { emails } from "../stores/inbox";
import EmailCard from "./EmailCard";

interface Props {
  onSelectEmail: (id: string) => void;
}

export default function EmailList(props: Props) {
  return (
    <Show
      when={emails().length > 0}
      fallback={
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
          </svg>
          <p>No emails yet</p>
        </div>
      }
    >
      <For each={emails()}>
        {(m) => (
          <EmailCard
            id={m.id}
            from={m.from}
            subject={m.subject}
            receivedAt={m.receivedAt}
            onClick={props.onSelectEmail}
          />
        )}
      </For>
    </Show>
  );
}
