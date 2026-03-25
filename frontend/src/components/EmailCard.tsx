import { avatarColor, avatarInitial, timeAgo } from "../lib/utils";

interface Props {
  id: string;
  from: string;
  subject: string;
  receivedAt: number;
  forwardFrom?: string;
  onClick: (id: string) => void;
}

export default function EmailCard(props: Props) {
  return (
    <div class="email-card" onClick={() => props.onClick(props.id)}>
      <div class="email-card-avatar" style={{ background: avatarColor(props.from) }}>
        {avatarInitial(props.from)}
      </div>
      <div class="email-card-content">
        <div class="email-card-subject">{props.subject || "(no subject)"}</div>
        <div class="email-card-meta">
          <span class="email-card-from">{props.from}</span>
          <span class="email-card-time">{timeAgo(props.receivedAt)}</span>
        </div>
        {props.forwardFrom && props.forwardFrom !== props.from && (
          <div class="email-card-fwd">via {props.forwardFrom}</div>
        )}
      </div>
    </div>
  );
}
