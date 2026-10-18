import { forwardRef, useId, useImperativeHandle, useRef, useState } from "react";

import { applyCompletion, completions, parse } from "./parser";
import type { Registry } from "./types";

export interface CommandLineHandle {
  focus(): void;
}

interface Props {
  registry: Registry;
  history: string[];
  onRun: (command: string, opts: { newPanel: boolean }) => void;
  touch?: boolean;
}

/**
 * The terminal command line: `<SECURITY> <FUNCTION> [args]` with fuzzy completion,
 * Tab to complete, ↑/↓ for history or suggestions, Enter / Shift+Enter to run.
 */
export const CommandLine = forwardRef<CommandLineHandle, Props>(function CommandLine(
  { registry, history, onRun, touch = false },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [histIdx, setHistIdx] = useState(-1);
  const listId = useId();

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  }));

  const suggestions = value.trim() ? completions(value, registry) : [];
  const showList = open && suggestions.length > 0;
  const preview = value.trim() ? parse(value, registry) : null;

  const submit = (newPanel: boolean) => {
    const text = value.trim();
    if (!text) return;
    onRun(text, { newPanel });
    setValue("");
    setOpen(false);
    setHistIdx(-1);
  };

  const complete = (code: string) => {
    setValue(applyCompletion(value, code));
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(e.shiftKey);
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      complete(suggestions[Math.min(active, suggestions.length - 1)]!.code);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showList) setActive((a) => Math.min(a + 1, suggestions.length - 1));
      else if (histIdx > 0) {
        setHistIdx(histIdx - 1);
        setValue(history[histIdx - 1] ?? "");
      } else if (histIdx === 0) {
        setHistIdx(-1);
        setValue("");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showList && active > 0) setActive(active - 1);
      else if (histIdx < history.length - 1) {
        setOpen(false);
        setHistIdx(histIdx + 1);
        setValue(history[histIdx + 1] ?? "");
      }
    } else if (e.key === "Escape") {
      if (showList) setOpen(false);
      else inputRef.current?.blur();
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Command line
      </label>
      <div
        className={`flex items-center gap-2 border border-amber bg-[#050607] px-2.5 ${
          touch ? "h-11 rounded-[10px]" : "h-8 rounded-[3px]"
        }`}
      >
        <span aria-hidden="true" className="font-mono font-bold text-amber">
          &gt;
        </span>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={value}
          placeholder={
            touch ? "Ticker or command — VOD LN DES" : "VOD LN DES · AAPL US GP 1Y · WEI · HELP"
          }
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(0);
            setHistIdx(-1);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className={`min-w-0 flex-1 border-0 bg-transparent font-mono uppercase text-bright outline-none placeholder:normal-case placeholder:text-dim ${
            touch ? "text-base" : "text-sm"
          }`}
        />
        {!touch && <span className="font-mono text-[11px] text-dim">Ctrl+K</span>}
      </div>
      {preview?.kind === "error" && !showList && value.trim().length > 1 && (
        <div className="absolute left-0 top-full z-20 mt-1 text-[11px] text-dim">
          {preview.message}
        </div>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 m-0 mt-1 max-h-80 list-none overflow-auto rounded border border-edge bg-[#1c1f25] p-0 shadow-xl"
        >
          {suggestions.map((f, i) => (
            <li
              key={f.code}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                complete(f.code);
              }}
              className={`flex cursor-pointer items-baseline gap-3 px-3 ${touch ? "min-h-11 py-2.5" : "py-1.5"} ${
                i === active ? "bg-amber-wash" : ""
              }`}
            >
              <span className="w-12 font-mono font-bold text-amber">{f.code}</span>
              <span className="text-bright">{f.title}</span>
              <span className="ml-auto truncate text-xs text-dim">
                {f.available ? f.summary : `Phase ${f.phase}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
