// Where the app finds its API.
//   ""  -> same origin (when the FastAPI server serves this page — the default).
// In the native app build, this file is overwritten with the deployed API URL,
// e.g. window.APP_CONFIG = { apiBase: "https://your-app.fly.dev" };
window.APP_CONFIG = { apiBase: "" };
