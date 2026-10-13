// Keep the deployment path in one place. Set VITE_BASE_PATH at build time when deploying to a subpath.
export const normalizeBasePath = (path = "/") => {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
};
const configuredBasePath = typeof process !== "undefined" ? process.env.VITE_BASE_PATH : import.meta.env.VITE_BASE_PATH;
export const APP_META = {
  basePath: normalizeBasePath(configuredBasePath || "/"),
  name: "하루 배터리",
};
