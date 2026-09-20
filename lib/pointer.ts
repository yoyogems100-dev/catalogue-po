/**
 * True only on a device that has a real pointer -- a mouse or trackpad.
 *
 * Used to decide whether a dropdown should focus its search box the moment it
 * opens. On a desktop that is a convenience: the list is open, start typing.
 * On a phone it is not, because focusing a text input summons the on-screen
 * keyboard, which covers half the options the person just opened the list to
 * look at, and dismissing it again is its own small puzzle. On touch the
 * search box waits until it is tapped.
 *
 * Deliberately called from an effect rather than during render: the server has
 * no window, so branching on it while rendering would mean the server and the
 * browser disagree about the markup.
 */
export function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
