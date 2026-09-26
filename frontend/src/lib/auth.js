const CREDENTIALS = {
  username: "masala",
  password: "dosa",
};

const SESSION_KEY = "gst_invoice_auth";

export function login(username, password) {
  if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}
