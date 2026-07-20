import Cookies from "js-cookie";

const TOKEN_COOKIE_NAME = "faraja_token";

export function setToken(token: string) {
  // Store token for 7 days (or adjust as needed)
  Cookies.set(TOKEN_COOKIE_NAME, token, {
    expires: 7,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE_NAME);
}

export function clearToken() {
  Cookies.remove(TOKEN_COOKIE_NAME, { path: "/" });
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
