const { app, BrowserWindow, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let frames = [];
let tray = null;
let brightness = 0.9;

function updateBrightness(value) {
  brightness = value;
  frames.forEach(frame => {
    if (!frame.isDestroyed()) {
      frame.webContents.executeJavaScript(`
        document.body.style.backgroundColor = 'rgba(255, 255, 255, ${brightness})';
      `);
    }
  });
}

function createAmbientLight() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];
  const { width, height, x, y } = primaryDisplay.bounds;
  
  const borderWidth = 40;
  
  const commonOptions = {
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };
  
  const topFrame = new BrowserWindow({
    ...commonOptions,
    x: x,
    y: y,
    width: width,
    height: borderWidth
  });

  topFrame.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  topFrame.setAlwaysOnTop(true, 'floating', 1);
  
  const bottomFrame = new BrowserWindow({
    ...commonOptions,
    x: x,
    y: y + height - borderWidth,
    width: width,
    height: borderWidth
  });

  bottomFrame.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bottomFrame.setAlwaysOnTop(true, 'floating', 1);
  
  const leftFrame = new BrowserWindow({
    ...commonOptions,
    x: x,
    y: y,
    width: borderWidth,
    height: height
  });
  leftFrame.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  leftFrame.setAlwaysOnTop(true, 'floating', 1);
  
  const rightFrame = new BrowserWindow({
    ...commonOptions,
    x: x + width - borderWidth,
    y: y,
    width: borderWidth,
    height: height
  });
  rightFrame.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  rightFrame.setAlwaysOnTop(true, 'floating', 1);
  
  frames = [topFrame, bottomFrame, leftFrame, rightFrame];
  
  frames.forEach(frame => {
    frame.loadFile('index.html');
    frame.setIgnoreMouseEvents(true);

    frame.webContents.on('did-finish-load', () => {
      frame.webContents.executeJavaScript(`
        document.body.style.backgroundColor = 'rgba(255, 255, 255, ${brightness})';
      `);
    });
  });
}

function createTray() {
  let icon;
  
  const iconPath = path.join(__dirname, 'icon.png');
  const fs = require('fs');
  
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 24, height: 24 });
    icon.setTemplateImage(true);
  } else {
    console.log('No icon.png found, using default system icon.');
    icon = nativeImage.createFromNamedImage('NSStatusAvailable', [16, 16]);
  }
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '💡 On',
      click: () => {
        frames.forEach(frame => frame.show());
      }
    },
    {
      label: '🌑 Off',
      click: () => {
        frames.forEach(frame => frame.hide());
      }
    },
    {
      label: '☀️ Brightness',
      submenu: [
        {
          label: '100%',
          type: 'radio',
          checked: brightness === 1.0,
          click: () => updateBrightness(1.0)
        },
        {
          label: '90%',
          type: 'radio',
          checked: brightness === 0.9,
          click: () => updateBrightness(0.9)
        },
        {
          label: '80%',
          type: 'radio',
          checked: brightness === 0.8,
          click: () => updateBrightness(0.8)
        },
        {
          label: '70%',
          type: 'radio',
          checked: brightness === 0.7,
          click: () => updateBrightness(0.7)
        },
        {
          label: '60%',
          type: 'radio',
          checked: brightness === 0.6,
          click: () => updateBrightness(0.6)
        },
        {
          label: '50%',
          type: 'radio',
          checked: brightness === 0.5,
          click: () => updateBrightness(0.5)
        },
        {
          label: '40%',
          type: 'radio',
          checked: brightness === 0.4,
          click: () => updateBrightness(0.4)
        },
        {
          label: '30%',
          type: 'radio',
          checked: brightness === 0.3,
          click: () => updateBrightness(0.3)
        },
        {
          label: '20%',
          type: 'radio',
          checked: brightness === 0.2,
          click: () => updateBrightness(0.2)
        },
        {
          label: '10%',
          type: 'radio',
          checked: brightness === 0.1,
          click: () => updateBrightness(0.1)
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'info',
          title: 'Ambient Light',
          message: 'Ambient Light v1.0',
          detail: 'Screen surround lighting application.'
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Ambient Light - Screen Surround Lighting');
  tray.setContextMenu(contextMenu);
}

// app.dock.show();

app.whenReady().then(() => {
  createAmbientLight();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  frames.forEach(frame => {
    if (!frame.isDestroyed()) {
      frame.destroy();
    }
  });
});

app.on('activate', () => {
  if (frames.length === 0) {
    createAmbientLight();
  }
});
