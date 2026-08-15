import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState } from '../types/auth'
import type { User } from '../types/auth'

const initialState: AuthState = {
    token: '',
    user: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setAuth(
            state,
            action: PayloadAction<{
                token: string
                user: User
            }>
        ) {
            state.token = action.payload.token
            state.user = action.payload.user
        },
        clearAuth(state) {
            state.token = ''
            state.user = null
        }
    }
})
export const { setAuth, clearAuth } = authSlice.actions

export default authSlice.reducer