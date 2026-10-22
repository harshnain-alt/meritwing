"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { controlState, ErrorText, FieldLabel, Hint } from "@/components/Field";
import { filterOptions, normalise, type SearchOption } from "@/lib/options";

type SearchSelectProps = {
  /** Rows rendered at once; long lists ask the student to type to narrow them. */
  maxResults?: number;
  /** Offer a “Use ‘…’” row so values missing from the list can be entered. */
  allowCustom?: boolean;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[] | (() => Promise<SearchOption[]>);
  placeholder?: string;
  searchPlaceholder: string;
  /** Plural noun used in status messages, e.g. "cities". */
  noun: string;
  footer?: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

type Row = { kind: "option"; option: SearchOption } | { kind: "custom"; value: string };

/**
 * A searchable dropdown styled like the native selects. The trigger is a button;
 * the panel holds a search box (ARIA combobox) and a listbox of results, plus a
 * “Use ‘…’” row so any value can be entered.
 */
export function SearchSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder,
  noun,
  footer,
  error,
  hint,
  optional,
  maxResults = 50,
  allowCustom = true,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<SearchOption[] | null>(Array.isArray(options) ? options : null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const all = useMemo(() => loaded ?? [], [loaded]);
  const matches = useMemo(() => {
    const found = filterOptions(all, query);
    // With no search text, show the current selection first so it's easy to see.
    const selected = query.trim() ? -1 : found.findIndex((o) => o.value === value);
    return selected > 0 ? [found[selected], ...found.slice(0, selected), ...found.slice(selected + 1)] : found;
  }, [all, query, value]);
  const trimmed = query.trim();
  const exact = trimmed && all.some((o) => normalise(o.value) === normalise(trimmed) || normalise(o.label) === normalise(trimmed));
  const rows: Row[] = [
    ...matches.slice(0, maxResults).map((option) => ({ kind: "option" as const, option })),
    ...(allowCustom && trimmed && !exact ? [{ kind: "custom" as const, value: trimmed }] : []),
  ];

  function openPanel(initialQuery = "") {
    setQuery(initialQuery);
    // The current selection is listed first, so the first row is the right starting point.
    setActive(0);
    setOpen(true);
    if (!loaded && typeof options === "function") {
      options().then(setLoaded, () => setLoaded([]));
    }
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(row: Row) {
    onChange(row.kind === "option" ? row.option.value : row.value);
    close(true);
  }

  // Focus the search box when the panel opens, and bring the panel into view on small screens.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  // Close when clicking or tapping outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row visible while moving with the keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onListClick(e: MouseEvent<HTMLUListElement>) {
    const index = (e.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index;
    if (index !== undefined && rows[Number(index)]) choose(rows[Number(index)]);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openPanel();
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing on the closed field starts a search.
      e.preventDefault();
      openPanel(e.key);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(Math.max(rows.length - 1, 0));
        break;
      case "Enter":
        // Never let Enter submit the step form from here.
        e.preventDefault();
        if (rows[active]) choose(rows[active]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const loading = open && !loaded;
  const total = matches.length;

  return (
    <div ref={rootRef} className="relative">
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      {hint && <Hint id={id}>{hint}</Hint>}
      <div className="relative mt-2">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-describedby={describedBy}
          onClick={() => (open ? close(false) : openPanel())}
          onKeyDown={onTriggerKeyDown}
          className={`block w-full truncate rounded-lg border bg-surface py-2.5 pl-3.5 pr-10 text-left text-[15px] leading-relaxed shadow-xs transition-colors focus:outline-none focus:ring-3 ${controlState(Boolean(error))} ${
            value ? "text-ink" : "text-faint"
          } ${open ? "border-accent ring-3 ring-accent/15" : ""}`}
        >
          {value || placeholder}
        </button>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 fill-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
        </svg>

        {open && (
          <div
            ref={panelRef}
            className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_4px_6px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.10)]">
            <div className="border-b border-line p-2">
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-label={`Search ${noun}`}
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={rows[active] ? optionId(active) : undefined}
                autoComplete="off"
                spellCheck={false}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                className="block w-full rounded-md border border-line bg-canvas px-3 py-2 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:text-[15px]"
              />
            </div>

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              onClick={onListClick}
              className="max-h-[min(18rem,45vh)] overflow-y-auto overscroll-contain py-1"
            >
              {loading && <li className="px-3.5 py-3 text-sm text-muted">Loading {noun}…</li>}
              {!loading && matches.length === 0 && (
                <li role="presentation" className="px-3.5 pb-1 pt-3 text-sm text-muted">
                  {trimmed ? `No ${noun} match “${trimmed}”.` : `No ${noun} available.`}
                  {trimmed && allowCustom && " You can use what you typed:"}
                </li>
              )}
              {!loading &&
                rows.map((row, i) => {
                  const isActive = i === active;
                  if (row.kind === "custom") {
                    return (
                      <li
                        key="__custom"
                        id={optionId(i)}
                        data-index={i}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActive(i)}
                        className={`mx-1 cursor-pointer rounded-md px-2.5 py-2.5 text-[15px] text-accent sm:py-2 ${
                          isActive ? "bg-accent-soft" : ""
                        } ${matches.length ? "mt-1 border-t border-line" : ""}`}
                      >
                        Use “<span className="font-semibold">{row.value}</span>”
                      </li>
                    );
                  }
                  const selected = row.option.value === value;
                  return (
                    <li
                      key={row.option.value}
                      id={optionId(i)}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(i)}
                      className={`mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2.5 sm:py-2 ${
                        isActive ? "bg-accent-soft" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-[15px] leading-snug ${selected ? "font-semibold text-accent" : "text-ink"}`}>
                          {row.option.label}
                        </span>
                        {row.option.detail && (
                          <span className="block text-[13px] leading-snug text-muted">{row.option.detail}</span>
                        )}
                      </span>
                      {selected && (
                        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 fill-accent">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      )}
                    </li>
                  );
                })}
            </ul>

            <div className="border-t border-line bg-canvas px-3.5 py-2 text-xs text-muted">
              <p role="status">
                {!loading &&
                  (total > maxResults
                    ? `Showing ${maxResults} of ${total.toLocaleString()} ${noun}. Type to narrow the list.`
                    : trimmed
                      ? `${total} ${total === 1 ? "match" : "matches"}`
                      : `${total.toLocaleString()} ${noun}`)}
              </p>
              {footer && <p className="mt-0.5 text-faint">{footer}</p>}
            </div>
          </div>
        )}
      </div>
      <ErrorText id={id}>{error}</ErrorText>
    </div>
  );
}
