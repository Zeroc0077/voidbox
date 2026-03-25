import { createSignal } from "solid-js";

const [toastMessage, setToastMessage] = createSignal("");
const [toastType, setToastType] = createSignal<"success" | "error">("success");
const [toastVisible, setToastVisible] = createSignal(false);

export { toastMessage, toastType, toastVisible };

let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(msg: string, type: "success" | "error" = "success") {
  clearTimeout(timer);
  setToastMessage(msg);
  setToastType(type);
  setToastVisible(true);
  timer = setTimeout(() => setToastVisible(false), 2500);
}
