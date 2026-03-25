import { filterFrom, filterFwd, setFilterFrom, setFilterFwd, refreshEmails } from "../stores/inbox";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
function debouncedRefresh() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshEmails, 300);
}

export default function FilterRow() {
  return (
    <div class="filter-row">
      <input
        placeholder="Filter by sender..."
        value={filterFrom()}
        onInput={(e) => {
          setFilterFrom(e.currentTarget.value);
          debouncedRefresh();
        }}
      />
      <input
        placeholder="Filter by forward source..."
        value={filterFwd()}
        onInput={(e) => {
          setFilterFwd(e.currentTarget.value);
          debouncedRefresh();
        }}
      />
    </div>
  );
}
