import { toastMessage, toastType, toastVisible } from "../stores/toast";

export default function Toast() {
  return (
    <div
      class={`toast ${toastType()} ${toastVisible() ? "show" : ""}`}
    >
      {toastMessage()}
    </div>
  );
}
