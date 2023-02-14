import sharp from 'sharp'
import type { IpcMain, BrowserWindow, IpcMainEvent } from 'electron'
import type { Logger } from 'log4js'

export function initThumbnailService(
  ipc: IpcMain,
  mainWindow: BrowserWindow,
  logger: Logger
): void {
  ipc.on('picasa-create-thumbnail', function (_event: IpcMainEvent, arg) {
    sharp(arg.path)
      .resize(arg.width, arg.height, {
        fit: sharp.fit.inside,
        withoutEnlargement: arg.withoutEnlargement
      })
      .toFormat('jpeg')
      .toFile(arg.thumbnail)
      .then((i) => {
        logger.info(i)
        return arg.thumbnail
      })
      .catch((err) => {
        logger.error(err)
        return arg.thumbnail
      })
      .then(() => {
        // Notify render process
        mainWindow && mainWindow.webContents.send('picasa-thumbnail-ready', arg)
      })
  })
}
