export interface ScreenshotOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxDataLength?: number;
}

export interface ScreenshotPayload {
  data: string;
  contentType: string;
  width: number;
  height: number;
  capturedAt: string;
}

/**
 * Captures a viewport screenshot as a JPEG data URL.
 *
 * Uses a canvas DOM-paint approach (rects + text + colors from getComputedStyle).
 * This avoids the "tainted canvas" SecurityError that SVG foreignObject causes
 * when exporting with toDataURL.
 */
export async function captureScreenshot(
  options: ScreenshotOptions = {}
): Promise<ScreenshotPayload | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }

  const quality = options.quality ?? 0.6;
  const maxWidth = options.maxWidth ?? 1280;
  const maxHeight = options.maxHeight ?? 720;
  const maxDataLength = options.maxDataLength ?? 400_000;

  try {
    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    if (!viewportW || !viewportH) return undefined;

    const scale = Math.min(1, maxWidth / viewportW, maxHeight / viewportH);
    const width = Math.max(1, Math.floor(viewportW * scale));
    const height = Math.max(1, Math.floor(viewportH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const bodyBg = safeColor(
      window.getComputedStyle(document.body).backgroundColor,
      '#ffffff'
    );
    ctx.fillStyle = bodyBg;
    ctx.fillRect(0, 0, width, height);
    ctx.scale(scale, scale);

    paintDom(ctx, viewportW, viewportH);

    // Status bar with page context (always readable)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawInfoBar(ctx, width, {
      url: location.href,
      title: document.title || 'Untitled',
      at: new Date().toISOString(),
    });

    let data = canvas.toDataURL('image/jpeg', quality);
    if (data.length > maxDataLength) {
      data = canvas.toDataURL('image/jpeg', Math.max(0.3, quality * 0.5));
    }
    if (data.length > maxDataLength) {
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.floor(width * 0.5));
      small.height = Math.max(1, Math.floor(height * 0.5));
      const sctx = small.getContext('2d');
      if (!sctx) return undefined;
      sctx.drawImage(canvas, 0, 0, small.width, small.height);
      data = small.toDataURL('image/jpeg', 0.4);
      if (data.length > maxDataLength) return undefined;
      return {
        data,
        contentType: 'image/jpeg',
        width: small.width,
        height: small.height,
        capturedAt: new Date().toISOString(),
      };
    }

    return {
      data,
      contentType: 'image/jpeg',
      width,
      height,
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

function paintDom(ctx: CanvasRenderingContext2D, viewportW: number, viewportH: number) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const nodes: Element[] = [];
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Element) nodes.push(node);
    node = walker.nextNode();
  }

  // Paint backgrounds / borders first (parents before children is natural tree order)
  for (const el of nodes) {
    if (!isPaintable(el)) continue;
    const rect = el.getBoundingClientRect();
    if (!intersectsViewport(rect, viewportW, viewportH)) continue;

    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor;
    if (bg && isOpaqueColor(bg)) {
      ctx.fillStyle = bg;
      roundRect(ctx, rect.left, rect.top, rect.width, rect.height, parseRadius(style.borderRadius));
      ctx.fill();
    }

    const borderW = parseFloat(style.borderTopWidth || '0');
    if (borderW > 0 && style.borderTopStyle !== 'none') {
      ctx.strokeStyle = safeColor(style.borderTopColor, '#cccccc');
      ctx.lineWidth = borderW;
      roundRect(ctx, rect.left, rect.top, rect.width, rect.height, parseRadius(style.borderRadius));
      ctx.stroke();
    }
  }

  // Paint text for leaf-ish elements
  for (const el of nodes) {
    if (!isPaintable(el)) continue;
    if (shouldSkipText(el)) continue;

    const rect = el.getBoundingClientRect();
    if (!intersectsViewport(rect, viewportW, viewportH)) continue;
    if (rect.width < 4 || rect.height < 4) continue;

    const style = window.getComputedStyle(el);
    const text = getDirectText(el);
    if (!text) continue;

    const fontSize = Math.max(10, parseFloat(style.fontSize) || 14);
    const fontWeight = style.fontWeight || '400';
    const fontFamily = style.fontFamily || 'sans-serif';
    ctx.fillStyle = safeColor(style.color, '#1a1a1a');
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const maxTextWidth = Math.max(8, rect.width - paddingLeft - (parseFloat(style.paddingRight) || 0));
    wrapText(
      ctx,
      maskSensitiveText(el, text),
      rect.left + paddingLeft,
      rect.top + paddingTop,
      maxTextWidth,
      fontSize * 1.25,
      rect.height
    );
  }
}

function drawInfoBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  info: { url: string; title: string; at: string }
) {
  const barH = 36;
  ctx.fillStyle = 'rgba(11, 61, 46, 0.92)';
  ctx.fillRect(0, 0, width, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 12px sans-serif';
  ctx.textBaseline = 'middle';
  const label = `${info.title} — ${info.url}`;
  ctx.fillText(truncate(label, Math.floor(width / 7)), 10, barH / 2 - 6);
  ctx.font = '400 10px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(info.at, 10, barH / 2 + 8);
}

function isPaintable(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'meta', 'link', 'head', 'br', 'wbr'].includes(tag)) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity || '1') === 0) return false;
  return true;
}

function shouldSkipText(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (['input', 'textarea', 'select', 'button', 'svg', 'img', 'canvas', 'video', 'audio'].includes(tag)) {
    // Still allow button text via textContent if leaf
    if (tag === 'button') return false;
    return true;
  }
  // Prefer painting on elements that directly contain text
  return false;
}

function getDirectText(el: Element): string {
  let text = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    }
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (text) return text;

  // Buttons / labels often wrap text in a single child
  if (['BUTTON', 'A', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'TD', 'TH', 'SPAN'].includes(el.tagName)) {
    const onlyElementChildren = Array.from(el.children).length <= 1;
    if (onlyElementChildren) {
      return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    }
  }
  return '';
}

function maskSensitiveText(el: Element, text: string): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const input = el as HTMLInputElement;
    if (input.type === 'password') return '••••••••';
  }
  if (el.getAttribute('type') === 'password' || el.getAttribute('autocomplete') === 'current-password') {
    return '••••••••';
  }
  return text;
}

function intersectsViewport(
  rect: DOMRect,
  viewportW: number,
  viewportH: number
): boolean {
  return !(rect.bottom < 0 || rect.right < 0 || rect.top > viewportH || rect.left > viewportW);
}

function isOpaqueColor(color: string): boolean {
  if (!color || color === 'transparent') return false;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color !== 'transparent';
  const parts = m[1].split(',').map((p) => p.trim());
  if (parts.length === 4 && parseFloat(parts[3]) === 0) return false;
  return true;
}

function safeColor(color: string | null | undefined, fallback: string): string {
  if (!color || color === 'transparent') return fallback;
  return color;
}

function parseRadius(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.min(n, 16) : 0;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  const bottom = y + maxHeight;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(truncate(line, 120), x, cy);
      line = word;
      cy += lineHeight;
      if (cy + lineHeight > bottom) return;
    } else {
      line = test;
    }
  }
  if (line && cy + lineHeight <= bottom) {
    ctx.fillText(truncate(line, 120), x, cy);
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
