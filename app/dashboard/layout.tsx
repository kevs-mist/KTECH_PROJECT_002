"use client";

import AuthRoute from "../src/components/Routes/Auth_route";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthRoute>
            {children}
        </AuthRoute>
    );
}
