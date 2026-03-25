import { createSignal, For, onMount, onCleanup } from "solid-js";

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  displayFn?: (value: string) => string;
}

export default function CustomSelect(props: Props) {
  const display = (v: string) => props.displayFn ? props.displayFn(v) : v;
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) setOpen(false);
  };

  onMount(() => document.addEventListener("click", handleClickOutside));
  onCleanup(() => document.removeEventListener("click", handleClickOutside));

  return (
    <div class={`custom-select ${open() ? "open" : ""}`} ref={ref}>
      <div class="custom-select-trigger" onClick={() => setOpen(!open())}>
        {display(props.value) || "\u00A0"}
      </div>
      <div class="custom-select-options">
        <For each={props.options}>
          {(d) => (
            <div
              class={`custom-select-option ${d === props.value ? "selected" : ""}`}
              onClick={() => {
                props.onChange(d);
                setOpen(false);
              }}
            >
              {display(d)}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
