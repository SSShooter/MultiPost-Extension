import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  webExt: {
    disabled: true,
  },
  vite: () => ({
    plugins: [
      {
        name: "dbg-write-probe",
        configResolved(c) {
          if (c.build?.rollupOptions?.input && !c.build.lib) {
            console.log(
              "[PROBE] vite=",
              c.viteVersion || "?",
              "write=",
              c.build.write,
              "outDir=",
              c.build.outDir,
              "root=",
              c.root,
              "emptyOutDir=",
              c.build.emptyOutDir,
            );
          }
        },
      },
    ],
  }),
  manifest: {
    name: "__MSG_extensionDisplayName__",
    description: "__MSG_extensionDescription__",
    default_locale: "zh_CN",
    permissions: ["storage", "activeTab", "tabs", "background", "scripting", "tabGroups", "sidePanel", "contextMenus"],
    host_permissions: ["https://*/*", "http://mp.163.com/*", "http://127.0.0.1/*", "http://localhost/*"],
    options_ui: {
      open_in_tab: true,
    },
  },
});
