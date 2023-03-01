import { app, shell, Menu, BrowserWindow } from "electron";

export function createMenu(mainWindow: BrowserWindow): void {
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
            label: "File",
            submenu: [
                {
                    label: "Preference",
                    click(): void {
                        mainWindow.webContents?.send("picasa:open-preference");
                    },
                },
                {
                    label: "Import Photos from ...",
                    click(): void {
                        mainWindow.webContents?.send("picasa:import-photos");
                    },
                },

                isMac ? { role: "close" } : { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "pasteAndMatchStyle" },
                { role: "delete" },
                { role: "selectAll" },
            ],
        },
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
        { role: "window", submenu: [{ role: "minimize" }, { role: "close" }] },
        {
            role: "help",
            submenu: [
                {
                    label: "Learn More",
                    click(): void {
                        shell.openExternal("https://electron.atom.io");
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
