import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children, search }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar />
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onMenu={() => setMobileOpen(true)}
          query={search?.value}
          setQuery={search?.setValue}
        />
        <main className="flex-1 px-4 md:px-8 lg:px-10 py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
