import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import type { RootState } from "../store";
import type { GuardProps } from "../types/auth";
import { canAccessPage, getRoleCode } from '@/utils/permission'

function RequireAuth({ children }: GuardProps) {
    const token = useSelector(
        (state: RootState) => state.auth.token
    )
    const user = useSelector((state: RootState) => state.auth.user)
    const location = useLocation()

    if (!token || !user) {
        return <Navigate to="/login" replace />
    }
    if (!canAccessPage(location.pathname, getRoleCode(user))) {
        return <Navigate to="/dashboard" replace />
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
