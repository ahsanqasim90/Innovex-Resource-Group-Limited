import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";

export default function AdminCommandPalette({ items, recent, onNavigate, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const dialog = useRef(null);
  const input = useRef(null);
  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/);
    const matches = items.filter((item) => words.every((word) => `${item.label} ${item.groupLabel}`.toLowerCase().includes(word)));
    return (query.trim() ? matches : [...recent.map((href) => items.find((item) => item.href === href)).filter(Boolean), ...items.filter((item) => !recent.includes(item.href))]).slice(0, 12);
  }, [items, query, recent]);
  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; input.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  useEffect(() => { dialog.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [selected]);
  function keyDown(event) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((value) => results.length ? (value + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);
    }
    if (event.key === "Enter" && document.activeElement === input.current && results[selected]) { event.preventDefault(); onNavigate(results[selected]); }
    if (event.key === "Tab") {
      const nodes = [...dialog.current.querySelectorAll('input, button:not([tabindex="-1"])')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  return <div className="admin-command-palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="admin-command-palette" ref={dialog} role="dialog" aria-modal="true" aria-label="Find a workspace module" onKeyDown={keyDown}>
      <header><Search size={20} /><input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} role="combobox" aria-label="Search modules" aria-autocomplete="list" aria-expanded="true" aria-controls="workspace-search-results" aria-activedescendant={results[selected] ? `workspace-result-${selected}` : undefined} placeholder="Where would you like to go?" /><button type="button" onClick={onClose} aria-label="Close search"><X size={18} /></button></header>
      <div className="admin-command-results"><span className="admin-command-results-label">{query ? "Matching modules" : "Recent & quick access"}</span><div id="workspace-search-results" role="listbox" aria-label="Workspace modules">{results.map((item, index) => { const Icon = item.Icon; return <div role="option" id={`workspace-result-${index}`} aria-selected={index === selected} key={item.href}><button type="button" tabIndex={-1} onMouseMove={() => setSelected(index)} onClick={() => onNavigate(item)}><span className="admin-command-result-icon"><Icon size={18} /></span><span><strong>{item.label}</strong><small>{item.groupLabel}</small></span><ChevronRight size={16} /></button></div>; })}</div>{!results.length && <div className="admin-command-empty" role="status"><Search size={24} /><strong>No matching module</strong><span>Try a service name such as training, finance or recruitment.</span></div>}</div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></footer>
    </section>
  </div>;
}
