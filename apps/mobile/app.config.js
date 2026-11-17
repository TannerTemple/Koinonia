// The phone app's name and identifiers come from the same file as everything else
// (packages/shared/brand.json), layered over the fixed settings in app.json.
const brand = require("../../packages/shared/brand.json");

module.exports = ({ config }) => ({
  ...config,
  name: brand.name,
  slug: brand.slug,
  scheme: brand.urlScheme,
  ios: { ...config.ios, bundleIdentifier: brand.bundleId },
  android: { ...config.android, package: brand.bundleId },
  plugins: (config.plugins ?? []).map((plugin) =>
    // Permission wording shown by iOS mentions the app by name.
    Array.isArray(plugin) && plugin[1] && typeof plugin[1] === "object"
      ? [plugin[0], Object.fromEntries(Object.entries(plugin[1]).map(([k, v]) => [k, typeof v === "string" ? v.replaceAll("{name}", brand.name) : v]))]
      : plugin,
  ),
});
