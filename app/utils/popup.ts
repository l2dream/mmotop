/**
 * Where a fixed-position popup should sit under the control that opened it.
 *
 * The page had three popups — filters, the More menu, languages — each doing
 * this arithmetic its own way, and each had grown its own subset of the same
 * three bugs. One place now, so fixing a bug fixes all three:
 *
 * Direction. Positions computed in JavaScript inherit nothing from the
 * stylesheet's logical properties, so in Arabic and Hebrew every popup
 * measured from the wrong side. `align` names an edge in reading order —
 * 'start' is the left in English and the right in Arabic.
 *
 * Scrollbars. The old code measured against window.innerWidth, which includes
 * the page's own scrollbar, so on desktops with visible scrollbars every
 * popup sat about ten pixels left of its button. clientWidth excludes it.
 *
 * Width. Callers pass the popup's rendered width, measured after it exists,
 * rather than a constant that can drift from the stylesheet.
 *
 * Height. A popup taller than the room below its button is capped, and the
 * stylesheet lets it scroll. The filter popup is about 430px tall, and on a
 * landscape phone its Apply button used to sit below the bottom of the screen
 * with no way to reach it.
 */
export interface PopupPlacement {
  top: number
  left: number
  maxHeight: number
}

const EDGE = 10

export function placePopup(
  anchor: DOMRect,
  width: number,
  align: 'start' | 'end',
  gap = 8
): PopupPlacement {
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const rtl = document.documentElement.dir === 'rtl'

  // Which physical edge "start" and "end" mean on this page.
  const alignLeft = (align === 'start') !== rtl
  const preferred = alignLeft ? anchor.left : anchor.right - width

  const left = Math.max(EDGE, Math.min(preferred, vw - width - EDGE))
  const top = anchor.bottom + gap

  return { top, left, maxHeight: Math.max(160, vh - top - EDGE) }
}
