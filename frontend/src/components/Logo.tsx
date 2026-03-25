export default function Logo(props: { large?: boolean }) {
  return (
    <div class="logo" style={props.large ? { "justify-content": "center", "margin-bottom": "1.5rem", "font-size": "1.3rem" } : undefined}>
      VOIDBOX{" "}
      {!props.large && (
        <a href="/llms.txt" target="_blank" class="llms-badge">
          llms.txt
        </a>
      )}
    </div>
  );
}
