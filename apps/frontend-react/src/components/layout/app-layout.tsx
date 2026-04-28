import { Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/layout/sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="bg-background flex flex-1 flex-col overflow-auto p-6 has-[.layout-full-bleed]:overflow-hidden has-[.layout-full-bleed]:p-0">
        <Outlet />
      </main>
    </div>
  );
}
