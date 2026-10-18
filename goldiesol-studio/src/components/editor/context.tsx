'use client';

import { createContext, useContext, useState } from 'react';
import { useStore } from 'zustand';
import type { CanvasState } from '@/lib/garment/types';
import type { Colour, DesignNote, Material, Shape } from '@/lib/types';
import { createEditorStore, type EditorStore, type VersionEntry } from './store';

export interface EditorLibrary {
  shapes: Shape[];
  colours: Colour[];
  materials: Material[];
  colourHex: Record<string, string>;
}

const StoreContext = createContext<EditorStore | null>(null);
const LibraryContext = createContext<EditorLibrary | null>(null);

export function EditorProvider({
  canvas,
  versions,
  notes,
  library,
  children,
}: {
  canvas: CanvasState;
  versions: VersionEntry[];
  notes: DesignNote[];
  library: EditorLibrary;
  children: React.ReactNode;
}) {
  const [store] = useState(() => createEditorStore(canvas, versions, notes));
  return (
    <StoreContext.Provider value={store}>
      <LibraryContext.Provider value={library}>{children}</LibraryContext.Provider>
    </StoreContext.Provider>
  );
}

export function useEditorStore(): EditorStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useEditor must be used inside <EditorProvider>');
  return store;
}

export function useEditor<T>(selector: (s: ReturnType<EditorStore['getState']>) => T): T {
  return useStore(useEditorStore(), selector);
}

export function useLibrary(): EditorLibrary {
  const lib = useContext(LibraryContext);
  if (!lib) throw new Error('useLibrary must be used inside <EditorProvider>');
  return lib;
}
