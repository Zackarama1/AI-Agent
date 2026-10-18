// Full-screen workspace: no studio sidebar.
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ivory">{children}</div>;
}
