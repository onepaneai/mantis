# Icons and Favicons

## Frontend Favicon
- **Location**: `frontend/public/favicon.svg`
- **Design**: Blue shield with red warning circle and exclamation mark
- **Format**: SVG (scalable, works in all modern browsers)
- **Referenced in**: `frontend/index.html`

## Chrome Extension Icons
- **Location**: `extension/icons/`
- **Sizes**:
  - `icon16.svg` - Toolbar and context menus
  - `icon48.svg` - Extension management page
  - `icon128.svg` - Chrome Web Store and installation
- **Design**: Consistent shield design with security warning theme
- **Referenced in**: `extension/manifest.json`

## Design Theme
The icon represents:
- **Blue Shield**: Security and protection
- **Red Warning Circle**: Vulnerability detection
- **Exclamation Mark**: Alert/testing in progress
- **Colors**: `#3498db` (blue), `#e74c3c` (red), `#2c3e50` (dark outline)

## Converting to PNG (Optional)
If you need PNG versions for better compatibility:
```bash
# Using ImageMagick or online tools
convert favicon.svg -resize 32x32 favicon.ico
convert icon128.svg -resize 128x128 icon128.png
```

## Testing
- **Frontend**: Refresh `localhost:5173` and check browser tab
- **Extension**: Reload extension in `chrome://extensions/` and check toolbar icon
