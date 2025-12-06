const { app, BrowserWindow, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let frames = [];
let tray = null;
let brightness = 0.9;
let borderWidth = 50;
let keepAliveInterval = null;
let isUpdatingPositions = false;
let pendingUpdate = false;
let currentColor = { r: 255, g: 255, b: 255 }; // Default to white

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function keepFramesOnTop() {
  frames.forEach(frame => {
    if (!frame.isDestroyed()) {
      frame.setAlwaysOnTop(true, "floating", 1);
      frame.moveTop();
    }
  });
}

function updateFramePositions() {
  if (isUpdatingPositions) {
    pendingUpdate = true;
    return;
  }
  
  isUpdatingPositions = true;
  
  try {
    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const workArea = primaryDisplay.workArea;
    
    if (frames.length >= 4) {
      const updates = [
        // Top frame
        { frame: frames[0], bounds: { x: workArea.x, y: workArea.y, width: workArea.width, height: borderWidth } },
        // Bottom frame
        { frame: frames[1], bounds: { x: workArea.x, y: workArea.y + workArea.height - borderWidth, width: workArea.width, height: borderWidth } },
        // Left frame
        { frame: frames[2], bounds: { x: workArea.x, y: workArea.y, width: borderWidth, height: workArea.height } },
        // Riggt frame
        { frame: frames[3], bounds: { x: workArea.x + workArea.width - borderWidth, y: workArea.y, width: borderWidth, height: workArea.height } }
      ];
      
      updates.forEach(({ frame, bounds }) => {
        if (!frame.isDestroyed()) {
          frame.setBounds(bounds);
        }
      });
    }
    
    keepFramesOnTop();
  } finally {
    isUpdatingPositions = false;
    
    if (pendingUpdate) {
      pendingUpdate = false;
      setTimeout(() => updateFramePositions(), 50);
    }
  }
}

const debouncedUpdatePositions = debounce(updateFramePositions, 150);

function attachDisplayListeners() {
  screen.on('display-metrics-changed', debouncedUpdatePositions);
  screen.on('display-added', debouncedUpdatePositions);
  screen.on('display-removed', debouncedUpdatePositions);
}

function startKeepAliveInterval() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  keepAliveInterval = setInterval(() => {
    if (frames.length > 0 && !frames[0].isDestroyed() && frames[0].isVisible()) {
      keepFramesOnTop();
    }
  }, 1000);
}

function attachSpaceListeners() {
  const debouncedKeepTop = debounce(keepFramesOnTop, 100);
  
  app.on("browser-window-blur", debouncedKeepTop);
  app.on("browser-window-focus", debouncedKeepTop);
  
  app.on('browser-window-created', (_, window) => {
    window.on('enter-full-screen', debouncedKeepTop);
    window.on('leave-full-screen', debouncedKeepTop);
  });
  
  attachDisplayListeners();
}

function updateBrightness(value) {
  brightness = value;
  updateFrameColors();
}

function updateColor(r, g, b) {
  currentColor = { r, g, b };
  updateFrameColors();
}

function updateFrameColors() {
  const script = `document.body.style.backgroundColor = 'rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${brightness})';`;
  
  frames.forEach(frame => {
    if (!frame.isDestroyed() && frame.webContents && !frame.webContents.isDestroyed()) {
      frame.webContents.executeJavaScript(script).catch(() => {
        // Silently handle errors if webContents is not ready
      });
    }
  });
}

function createAmbientLight() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];
  
  const workArea = primaryDisplay.workArea;
  const { width, height, x, y } = workArea;
  
  const commonOptions = {
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    fullscreen: false,
    kiosk: false,
    fullscreenable: false,
    show: false, // Don't show immediately
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false // Prevent throttling when not focused
    }
  };
  
  const topFrame = new BrowserWindow({
    ...commonOptions,
    x: x,
    y: y,
    width: width,
    height: borderWidth
  });
  
  const bottomFrame = new BrowserWindow({
    ...commonOptions,
    x: x,
    y: y + height - borderWidth,
    width: width,
    height: borderWidth
  });
  
  const leftFrame = new BrowserWindow({
    ...commonOptions,
    x: x,
    y: y,
    width: borderWidth,
    height: height
  });
  
  const rightFrame = new BrowserWindow({
    ...commonOptions,
    x: x + width - borderWidth,
    y: y,
    width: borderWidth,
    height: height
  });
  
  frames = [topFrame, bottomFrame, leftFrame, rightFrame];
  
  let loadedCount = 0;
  const totalFrames = frames.length;
  
  frames.forEach((frame, index) => {
    frame.setAlwaysOnTop(true, 'floating', 1);
    frame.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    if (process.platform === 'darwin') {
      frame.setWindowButtonVisibility(false);
    }
    
    frame.setIgnoreMouseEvents(true);
    
    frame.webContents.on('did-finish-load', () => {
      frame.webContents.executeJavaScript(`
        document.body.style.backgroundColor = 'rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${brightness})';
      `).then(() => {
        loadedCount++;
        
        // Show all frames together once all are loaded
        if (loadedCount === totalFrames) {
          frames.forEach(f => {
            if (!f.isDestroyed()) {
              f.show();
              f.moveTop();
            }
          });
        }
      });
    });
    
    frame.loadFile('index.html');
  });

  attachSpaceListeners();
  startKeepAliveInterval();
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
    icon = nativeImage.createFromNamedImage('NSStatusAvailable', [16, 16]);
  }
  
  tray = new Tray(icon);
  
  function buildMenu() {
    return Menu.buildFromTemplate([
      {
        label: '💡 On',
        click: () => {
          frames.forEach(frame => {
            if (!frame.isDestroyed()) {
              frame.show();
              frame.moveTop();
            }
          });
        }
      },
      {
        label: '🌑 Off',
        click: () => {
          frames.forEach(frame => {
            if (!frame.isDestroyed()) {
              frame.hide();
            }
          });
        }
      },
      { type: 'separator' },
      {
        label: '🎨 Colors',
        submenu: [
          {
            label: '⚪ White',
            click: () => {
              updateColor(255, 255, 255);
            }
          },
          {
            label: '🟡 Warm White',
            click: () => {
              updateColor(255, 214, 170);
            }
          },
          {
            label: '🟠 Orange',
            click: () => {
              updateColor(255, 150, 50);
            }
          },
          {
            label: '🔴 Red',
            click: () => {
              updateColor(255, 100, 100);
            }
          },
          {
            label: '🔵 Blue',
            click: () => {
              updateColor(200, 220, 255);
            }
          },
          {
            label: '🟢 Green',
            click: () => {
              updateColor(200, 255, 200);
            }
          }
        ]
      },
      {
        label: '☀️ Brightness',
        submenu: [
          {
            label: '100%',
            type: 'radio',
            checked: brightness === 1.0,
            click: () => {
              updateBrightness(1.0);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '90%',
            type: 'radio',
            checked: brightness === 0.9,
            click: () => {
              updateBrightness(0.9);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '80%',
            type: 'radio',
            checked: brightness === 0.8,
            click: () => {
              updateBrightness(0.8);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '70%',
            type: 'radio',
            checked: brightness === 0.7,
            click: () => {
              updateBrightness(0.7);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '60%',
            type: 'radio',
            checked: brightness === 0.6,
            click: () => {
              updateBrightness(0.6);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '50%',
            type: 'radio',
            checked: brightness === 0.5,
            click: () => {
              updateBrightness(0.5);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '40%',
            type: 'radio',
            checked: brightness === 0.4,
            click: () => {
              updateBrightness(0.4);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '30%',
            type: 'radio',
            checked: brightness === 0.3,
            click: () => {
              updateBrightness(0.3);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '20%',
            type: 'radio',
            checked: brightness === 0.2,
            click: () => {
              updateBrightness(0.2);
              tray.setContextMenu(buildMenu());
            }
          },
          {
            label: '10%',
            type: 'radio',
            checked: brightness === 0.1,
            click: () => {
              updateBrightness(0.1);
              tray.setContextMenu(buildMenu());
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: '🔄 Force to Top',
        click: () => {
          keepFramesOnTop();
        }
      },
      {
        label: '📐 Recalculate Position',
        click: () => {
          updateFramePositions();
        }
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
  }
  
  tray.setToolTip('Ambient Light');
  tray.setContextMenu(buildMenu());
}

app.whenReady().then(() => {
  createAmbientLight();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
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
