type PointerDownOutsideEvent = CustomEvent<{
  originalEvent: PointerEvent;
}>;
type FocusOutsideEvent = CustomEvent<{
  originalEvent: FocusEvent;
}>;

export function disableClosingOnNetworkInspector(
  e: FocusOutsideEvent | PointerDownOutsideEvent
) {
  const target = e.target as HTMLElement;
  const isInsideNetworkInspector = target.closest(
    '.network-inspector',
  );

  if (isInsideNetworkInspector) {
    e.preventDefault();
    e.stopPropagation()
    return false;
  }

  return e;
}
