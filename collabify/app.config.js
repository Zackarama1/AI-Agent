// Extends app.json. PREVIEW_BUILD=1 bundles every screen up front (no lazy route chunks),
// so the web export can be inlined into one self-contained preview page.
module.exports = ({ config }) => {
  if (!process.env.PREVIEW_BUILD) return config;
  return {
    ...config,
    plugins: config.plugins.map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: { web: false, default: false } }] : p)),
  };
};
