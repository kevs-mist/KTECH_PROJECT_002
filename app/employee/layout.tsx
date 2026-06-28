"use client";

import EmployeeRoute from "../src/components/Routes/Employee_route";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return (
        <EmployeeRoute>
            <div className="min-h-screen">
                {children}
            </div>
        </EmployeeRoute>
    );
}