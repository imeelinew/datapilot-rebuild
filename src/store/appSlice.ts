import { createSlice } from '@reduxjs/toolkit'

export type ThemeMode = 'light' | 'dark'

const systemTheme: ThemeMode = window.matchMedia(
  '(prefers-color-scheme: dark)',
).matches
  ? 'dark'
  : 'light'

const appSlice = createSlice({
  name: 'app',
  initialState: {
    theme: systemTheme,
  },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light'
    },
  },
})

export const { toggleTheme } = appSlice.actions
export default appSlice.reducer
