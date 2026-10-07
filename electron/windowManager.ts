import { BrowserWindow, screen } from "electron";

export const HANDLE_WIDTH = 10;
export const PANEL_WIDTH = 790;
export const PANEL_HEIGHT = 720;

const SLIDE_DURATION_MS = 220;
const COLLAPSE_DELAY_MS = 600;

let window: BrowserWindow | null = null;
let expanded = false;
let slideTimer: ReturnType<typeof setInterval> | null = null;
let collapseTimer: ReturnType<typeof setTimeout> | null = null;

function getLayout() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(PANEL_WIDTH, workArea.width);
  const height = Math.min(PANEL_HEIGHT, workArea.height);
  const right = workArea.x + workArea.width;

  return {
    right,
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
}

export function getInitialBounds() {
  const layout = getLayout();
  return {
    x: layout.right - HANDLE_WIDTH,
    y: layout.y,
    width: layout.width,
    height: layout.height,
  };
}

function stopSlide() {
  if (slideTimer !== null) {
    clearInterval(slideTimer);
    slideTimer = null;
  }
}

export function cancelCollapse() {
  if (collapseTimer !== null) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
}

export function attachWindow(browserWindow: BrowserWindow) {
  window = browserWindow;
  expanded = false;
  browserWindow.on("closed", () => {
    stopSlide();
    cancelCollapse();
    window = null;
  });
}

export function positionWindow() {
  if (!window || window.isDestroyed()) return;
  stopSlide();
  const layout = getLayout();
  const currentX = window.getBounds().x;
  window.setBounds({ x: currentX, y: layout.y, width: layout.width, height: layout.height });
  const actualWidth = window.getBounds().width;
  window.setPosition(layout.right - (expanded ? actualWidth : HANDLE_WIDTH), layout.y);
}

function slideTo(showPanel: boolean) {
  if (!window || window.isDestroyed()) return;

  cancelCollapse();
  stopSlide();
  expanded = showPanel;

  const browserWindow = window;
  const layout = getLayout();
  const currentX = browserWindow.getBounds().x;
  browserWindow.setBounds({ x: currentX, y: layout.y, width: layout.width, height: layout.height });
  const actualWidth = browserWindow.getBounds().width;
  const targetX = layout.right - (showPanel ? actualWidth : HANDLE_WIDTH);
  const startX = browserWindow.getBounds().x;
  if (startX === targetX) return;

  const startedAt = Date.now();
  slideTimer = setInterval(() => {
    if (browserWindow.isDestroyed()) {
      stopSlide();
      return;
    }

    const progress = Math.min((Date.now() - startedAt) / SLIDE_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = Math.round(startX + (targetX - startX) * eased);
    browserWindow.setPosition(x, layout.y);

    if (progress === 1) {
      stopSlide();
      if (showPanel) {
        const finalWidth = browserWindow.getContentBounds().width;
        browserWindow.setPosition(layout.right - finalWidth, layout.y);
      }
    }
  }, 16);
}

export function expandWindow() {
  slideTo(true);
}

export function collapseWindow() {
  slideTo(false);
}

export function scheduleCollapse() {
  cancelCollapse();
  collapseTimer = setTimeout(() => {
    collapseTimer = null;
    collapseWindow();
  }, COLLAPSE_DELAY_MS);
}

export function toggleWindow() {
  slideTo(!expanded);
}
