import "dockview-react/dist/styles/dockview.css";

import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import { useEffect, useMemo, useRef } from "react";

import { FunctionView, panelTitle } from "../functions/FunctionView";
import { useRegistry } from "../terminal/registry";
import type { Registry } from "../terminal/types";
import { LinkSwatch } from "./LinkSwatch";
import { useWorkspace } from "./store";

const theme: DockviewTheme = {
  name: "quarry",
  className: "dockview-theme-quarry",
  colorScheme: "dark",
  gap: 4,
};

interface Props {
  registry: Registry;
  run: (command: string, opts?: { newPanel?: boolean }) => void;
}

/** Desktop: freely dockable panels (split, tab, drag), geometry saved with the workspace. */
export function DesktopWorkspace({ registry, run }: Props) {
  const apiRef = useRef<DockviewApi | null>(null);
  // While rebuilding from a snapshot, dockview's remove events must not delete panels.
  const restoring = useRef(false);
  const revision = useWorkspace((s) => s.revision);
  const registryRef = useRef(registry);
  useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  const sync = (api: DockviewApi) => {
    const st = useWorkspace.getState();
    for (const id of st.order) {
      if (!api.getPanel(id)) {
        // New panels split the screen (right, then below) instead of stacking as tabs.
        const last = api.panels.at(-1);
        api.addPanel({
          id,
          component: "fn",
          title: panelTitle(st.panels[id]!.command, registryRef.current),
          ...(last
            ? {
                position: {
                  referencePanel: last.id,
                  direction: api.panels.length === 1 ? ("right" as const) : ("below" as const),
                },
              }
            : {}),
        });
      }
    }
    for (const panel of [...api.panels]) {
      if (!st.panels[panel.id]) panel.api.close();
    }
    if (st.focusedId) api.getPanel(st.focusedId)?.api.setActive();
  };

  const restore = (api: DockviewApi) => {
    const dock = useWorkspace.getState().dock;
    restoring.current = true;
    try {
      api.clear();
      if (dock) {
        try {
          api.fromJSON(dock as SerializedDockview);
        } catch {
          api.clear(); // geometry from an older layout version: rebuild from panels
        }
      }
      sync(api);
    } finally {
      restoring.current = false;
    }
  };

  const onReady = (event: DockviewReadyEvent) => {
    const api = event.api;
    apiRef.current = api;
    restore(api);
    api.onDidActivePanelChange((e) => {
      if (e.panel) useWorkspace.getState().focus(e.panel.id);
    });
    api.onDidRemovePanel((panel) => {
      if (!restoring.current) useWorkspace.getState().closePanel(panel.id);
    });
    api.onDidLayoutChange(() => useWorkspace.getState().setDock(api.toJSON()));
  };

  // Rebuild when a different workspace snapshot is loaded.
  useEffect(() => {
    if (apiRef.current) restore(apiRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  // Keep dockview in step with store-driven changes (new panels, focus).
  useEffect(
    () =>
      useWorkspace.subscribe((st, prev) => {
        const api = apiRef.current;
        if (!api || st.revision !== prev.revision) return;
        if (st.order !== prev.order || st.focusedId !== prev.focusedId) sync(api);
      }),
    [],
  );

  const components = useMemo(
    () => ({
      fn: (props: IDockviewPanelProps) => <DockPanel {...props} registry={registry} run={run} />,
    }),
    [registry, run],
  );

  return (
    <DockviewReact
      className="h-full"
      theme={theme}
      components={components}
      defaultTabComponent={DockTab}
      onReady={onReady}
    />
  );
}

function DockPanel({
  api,
  registry,
  run,
}: IDockviewPanelProps & { registry: Registry; run: Props["run"] }) {
  const command = useWorkspace((s) => s.panels[api.id]?.command ?? "");
  const focused = useWorkspace((s) => s.focusedId === api.id);
  useEffect(() => {
    api.setTitle(panelTitle(command, registry));
  }, [api, command, registry]);
  return (
    <div
      className={`h-full overflow-auto ${focused ? "shadow-[inset_0_0_0_1px_var(--color-amber)]" : ""}`}
      onPointerDown={() => useWorkspace.getState().focus(api.id)}
    >
      <FunctionView
        command={command}
        registry={registry}
        run={(c) => {
          useWorkspace.getState().focus(api.id);
          run(c);
        }}
      />
    </div>
  );
}

function DockTab({ api }: IDockviewPanelHeaderProps) {
  const command = useWorkspace((s) => s.panels[api.id]?.command ?? "");
  const { registry } = useRegistry();
  const title = panelTitle(command, registry);
  const index = useWorkspace((s) => s.order.indexOf(api.id));
  return (
    <div className="flex h-full items-center gap-2 px-2 font-mono text-xs">
      <LinkSwatch panelId={api.id} />
      {index >= 0 && index < 9 && <span className="text-dim">{index + 1}</span>}
      <span className="max-w-56 truncate">{title}</span>
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="ml-1 flex h-5 w-5 items-center justify-center rounded text-dim hover:bg-edge hover:text-bright"
        onClick={(e) => {
          e.stopPropagation();
          api.close();
        }}
      >
        ×
      </button>
    </div>
  );
}
