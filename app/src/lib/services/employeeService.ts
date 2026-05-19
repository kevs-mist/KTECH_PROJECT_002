import { auth } from "../firebase";
import { getEmployeesAction, EmployeeProfile, setEmployeeOnlineStatusAction } from "../actions/employeeActions";

export type { EmployeeProfile };

export const employeeService = {
    async getIdToken() {
        const token = await auth.currentUser?.getIdToken(true);
        if (!token) throw new Error("Unauthorized: Please log in again.");
        return token;
    },

    async getEmployees(): Promise<EmployeeProfile[]> {
        const token = await this.getIdToken();
        return getEmployeesAction(token);
    },

    async setOnlineStatus(isOnline: boolean) {
        const token = await this.getIdToken();
        return setEmployeeOnlineStatusAction(token, isOnline);
    }
};
