import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "../store";
import type { GuardProps } from "../types/auth";

function RequireAuth({ children }: GuardProps) {
    const token = useSelector(
        (state: RootState) => state.auth.token
    )
    if (!token) {
        return <Navigate to="/login" replace />
    }
    return children
}

export function GuestOnly({ children }: GuardProps) {
    const token = useSelector(
        (state: RootState) => state.auth.token
    )
    if (token) {
        return <Navigate to="/dashboard" replace />
    }
    return children
}

export default RequireAuth