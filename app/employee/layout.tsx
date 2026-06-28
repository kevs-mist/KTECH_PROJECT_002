"use client";

import EmployeeRoute from "../src/components/Routes/Employee_route";
import BottomNavigation from "../src/components/common/BottomNavigation";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return (
        <EmployeeRoute>
            <div className="min-h-screen pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
                {children}
                <BottomNavigation />
            </div>
        </EmployeeRoute>
    );
}
