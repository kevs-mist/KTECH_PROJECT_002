"use client";

import AdminRoute from "../src/components/Routes/Admin_route";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminRoute>
            {children}
        </AdminRoute>
    );
}
