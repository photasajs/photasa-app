import { app, shell, Menu } from "electron";

export function createMenu(): void {
    const isMac = process.platform === "darwin";
    const appMenu: Electron.MenuItemConstructorOptions[] = isMac
        ? [
              {
                  label: app.name,
                  submenu: [
                      { role: "about" },
                      { type: "separator" },
                      { role: "services" },
                      { type: "separator" },
                      { role: "hide" },
                      { role: "hideOthers" },
                      { role: "unhide" },
                      { type: "separator" },
                      { role: "quit" },
                  ],
              },
          ]
        : [];
    const template: Electron.MenuItemConstructorOptions[] = [
        ...appMenu,
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
            ],
        },
        { role: "window", submenu: [{ role: "minimize" }] },
        {
            role: "help",
            submenu: [
                {
                    label: "Learn More",
                    click(): void {
                        shell.openExternal("https://wwww.thepicasa.com");
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
