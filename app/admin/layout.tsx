"use client";

import AdminRoute from "../src/components/Routes/Admin_route";
import AdminSidebar from "../src/components/Admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminRoute>
            <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
                <AdminSidebar />
                <main className="flex-1 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </AdminRoute>
    );
}
