# Ambient Light

Ambient Light is a lightweight Electron-based utility that creates a soft white frame around your screen to provide additional ambient illumination.  
It is particularly useful when working late at night or in low-light environments.

Tested on **macOS Thaoe 26.1**.

---

## Features

- Full-screen transparent overlay  
- White ambient light frame on all screen edges  
- Non-intrusive (mouse events pass through to underlying applications)  
- Can be packaged as a standalone macOS application

## Running the Project Locally
To run the application in development mode:

```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

## Packaging as a Desktop Application
You can build a distributable macOS application using:

```bash
rm -rf node_modules package-lock.json
npm install

npx electron-packager . "Ambient Light" \
  --platform=darwin \
  --arch=x64,arm64 \
  --icon=icon.png \
  --out=dist \
  --overwrite
```

The packaged application will be generated inside the `dist/` directory.