export default defineI18nConfig(() => ({
  legacy: false,
  /**
   * A key with no translation yet falls through to English instead of printing
   * itself. A visitor seeing one English line in an otherwise Russian page has
   * a worse day than we would like; a visitor seeing `panels.top` has no idea
   * what happened.
   */
  fallbackLocale: 'en',
  /** These fire per missing key in dev and would drown the console otherwise. */
  missingWarn: false,
  fallbackWarn: false
}))
