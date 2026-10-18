import { useWorkspace, type LinkGroup } from "./store";

const SWATCH: Record<LinkGroup, string> = {
  none: "border border-dim bg-transparent",
  amber: "bg-amber",
  cyan: "bg-cyan",
  violet: "bg-violet",
};

/** Link-colour square: panels sharing a colour follow the same security. Tap to cycle. */
export function LinkSwatch({ panelId, large = false }: { panelId: string; large?: boolean }) {
  const link = useWorkspace((s) => s.panels[panelId]?.link ?? "none");
  return (
    <button
      type="button"
      aria-label={`Link group ${link}. Change link group`}
      title={`Link group: ${link}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        useWorkspace.getState().cycleLink(panelId);
      }}
      className={`flex shrink-0 items-center justify-center bg-transparent p-0 ${large ? "h-11 w-11" : "h-5 w-5"}`}
    >
      <span className={`block h-2.5 w-2.5 rounded-[2px] ${SWATCH[link]}`} />
    </button>
  );
}
