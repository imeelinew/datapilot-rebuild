import type { ReactNode } from "react";
export interface User {
    id?: number | string
    username?: string
    roleCode?: string
    role?: Role
    avatar?: string
}
export interface AuthState {
    token: string
    user: User | null
}
export interface Role {
    id?: number
    name?: string
    code?: string
}
export interface LoginFormValues {
    username: string
    password: string
    captchaCode: string
}
export interface LoginParams {
    username: string
    password: string
    captchaId: string
    captchaCode: string
}
export interface CaptchaData {
    captchaId: string
    svg: string
}

export interface LoginData {
    token: string
    user: User
}

export interface ApiResult<T> {
    code: number
    message: string
    data: T
}
export type GuardProps = {
    children: ReactNode
}