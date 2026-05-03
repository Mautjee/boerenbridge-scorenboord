import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'

const COOKIE_NAME = 'bb_session_game_id'

export function getSessionGameId(): string | undefined {
  return getCookie(COOKIE_NAME)
}

export function setSessionGameId(gameId: string) {
  setCookie(COOKIE_NAME, gameId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

export function clearSessionGameId() {
  deleteCookie(COOKIE_NAME)
}
