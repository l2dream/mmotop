/**
 * The five lists on the home page, each of which also has a page of its own
 * at /<id> (and /<locale>/<id>): the home panel shows the first few rows, the
 * section page shows them all. The id is the address, so it never changes
 * once published; the title is translated under panels.<id>.
 */
export const SECTIONS = ['top', 'soon', 'started', 'new', 'all'] as const
export type SectionId = (typeof SECTIONS)[number]

export function isSection(value: unknown): value is SectionId {
  return typeof value === 'string' && (SECTIONS as readonly string[]).includes(value)
}
