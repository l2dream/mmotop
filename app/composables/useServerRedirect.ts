import { serverPath, type Server } from '~/data/servers'

/**
 * Sends the visitor from an address a server used to have to its page now,
 * with the query (?vote=… and the like) kept. A 301 for anything that asks the
 * server; the prerendered file is a redirect page for whatever reads the HTML
 * without running it.
 */
export async function useServerRedirect(server: Server) {
  const route = useRoute()
  const localePath = useLocalePath()
  const search = new URLSearchParams(route.query as Record<string, string>).toString()
  // A string rather than a route object: the object form dropped the
  // trailing slash the pages are served at.
  return navigateTo(`${localePath(serverPath(server))}/${search ? `?${search}` : ''}`, { redirectCode: 301, replace: true })
}
