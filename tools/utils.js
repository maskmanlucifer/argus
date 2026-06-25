/**
 * Returns true if `el` is part of the Argus toolbar UI (host element or
 * anything inside the shadow root), so tools can skip their own nodes.
 *
 * @param {Element|null} el - Element to test.
 * @param {ShadowRoot} shadow - The toolbar's shadow root.
 * @returns {boolean}
 */
export function isArgus(el, shadow) {
  return !!(el?.closest?.('#argus-host') || el?.getRootNode?.() === shadow);
}
