// Follows every finger on the screen separately, and stops the browser from
// answering touches with its own gestures (scrolling, zooming, text
// selection, the long-press menu).
//
// Each touch is reported as { id, order, x, y, contactSize, pressure, kind }:
// x and y in CSS pixels, contactSize the size of the finger's contact in CSS
// pixels (1 or 0 where the device gives none), order rising with each new
// touch so the earliest can be told from later ones.

export function trackTouches(element, onChange) {
  const active = new Map();
  let nextOrder = 0;

  function read(event, touch) {
    touch.x = event.clientX;
    touch.y = event.clientY;
    touch.width = event.width || 0;
    touch.height = event.height || 0;
    touch.contactSize = Math.sqrt(touch.width * touch.height);
    touch.pressure = event.pressure || 0;
    return touch;
  }

  function down(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    try {
      element.setPointerCapture(event.pointerId);
    } catch (error) {
      // The touch is still followed without capture.
    }
    const touch = read(event, {
      id: event.pointerId,
      order: nextOrder,
      kind: event.pointerType || 'unknown',
    });
    nextOrder += 1;
    active.set(touch.id, touch);
    onChange('down', touch);
  }

  function move(event) {
    const touch = active.get(event.pointerId);
    if (!touch) return;
    event.preventDefault();
    onChange('move', read(event, touch));
  }

  function up(event) {
    const touch = active.get(event.pointerId);
    if (!touch) return;
    active.delete(touch.id);
    onChange('up', touch);
  }

  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);

  // The browser's own answers to touch. `passive: false` is what allows
  // them to be refused.
  const refuse = (event) => event.preventDefault();
  const firm = { passive: false };
  element.addEventListener('touchstart', refuse, firm);
  element.addEventListener('touchmove', refuse, firm);
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(name, refuse, firm); // pinch on iPhone
  }
  element.addEventListener('contextmenu', refuse);
  element.addEventListener('dblclick', refuse);
  element.addEventListener('selectstart', refuse);
  element.addEventListener('dragstart', refuse);

  return {
    // The touches now on the screen, earliest first.
    list() {
      return Array.from(active.values()).sort((a, b) => a.order - b.order);
    },
    // Forget every touch, as if all fingers had lifted.
    clear() {
      const touches = Array.from(active.values());
      active.clear();
      for (const touch of touches) onChange('up', touch);
    },
  };
}
