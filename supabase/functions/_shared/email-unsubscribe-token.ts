/** Existing unsubscribe token precedence, isolated for synthetic request tests.
 * The caller remains responsible for method/configuration and database validation.
 */
export async function readUnsubscribeToken(req: Request): Promise<string | null> {
  const url = new URL(req.url)
  let token: string | null = url.searchParams.get('token')

  if (req.method === 'POST') {
    // Detect RFC 8058 one-click unsubscribe: POST with form-encoded body
    // containing "List-Unsubscribe=One-Click". Email clients (Gmail, Apple Mail,
    // etc.) send this when the user clicks "Unsubscribe" in the mail UI.
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formText = await req.text()
      const params = new URLSearchParams(formText)
      // For one-click, token comes from query param (already set above).
      // Otherwise, token may be in the form body.
      if (!params.get('List-Unsubscribe')) {
        const formToken = params.get('token')
        if (formToken) {
          token = formToken
        }
      }
    } else {
      // JSON body (from the app's unsubscribe page)
      try {
        const body = await req.json()
        if (body.token) {
          token = body.token
        }
      } catch {
        // Fall through — token stays from query param
      }
    }
  }

  return token
}
