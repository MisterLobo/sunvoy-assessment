import { writeFileSync } from 'fs'
import { parse } from 'node-html-parser'
import { createHmac } from 'crypto'

const domain = 'challenge.sunvoy.com'

type User = {
  id: string,
  email: string,
  firstName: string,
  lastName: string,
}
async function listUsers(headers: Headers): Promise<User[]> {
  const response = await fetch(`https://${domain}/api/users`, {
    method: 'POST',
    headers,
  })
  if (response.status !== 200) {
    return []
  }
  const users = await response.json()
  return users
}

async function getUserSettings(params: Map<string, any>): Promise<User | undefined> {
  const timestamp = Math.floor(Date.now() / 1e3)
  params.set('timestamp', timestamp.toString())

  let searchParams = Array.from(params.
    keys()).
    sort().
    map(k => `${k}=${encodeURIComponent(params.get(k))}`).
    join('&')

  const checkcode = createHmac('sha1', 'mys3cr3t')
    .update(searchParams)
    .digest('hex')
    .toUpperCase()

  searchParams = `${searchParams}&checkcode=${checkcode}`
  const url = new URL(`/api/settings`, `https://api.${domain}`)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: searchParams,
  })
  if (response.status !== 200) {
    console.error('error response from server:', response.status, response.statusText)
    return
  }
  const data = await response.json()
  return data as User
}

async function getTokens(headers: Headers): Promise<Map<string, any>> {
  const url = new URL(`https://${domain}/settings/tokens`)
  const response = await fetch(url, {
    method: 'GET',
    headers,
  })
  const urlSearchParams = new Map<string, any>()
  if (response.status !== 200) {
    return urlSearchParams
  }
  const responseText = await response.text()
  const root = parse(responseText)
  const inputs = root.querySelectorAll('input[type="hidden"]')
  inputs.forEach(input => {
    urlSearchParams.set(input.id, input.attrs['value'])
  })
  return urlSearchParams
}

async function main() {
  const headers = new Headers({
    Cookie: 'JSESSIONID=de3c7d63-4dc9-45a1-bbf0-7629ab1aa7dd; _csrf_token=4714a84a6229eaf13a472df067a58368055528111803ea861a684b7874b7fd09; user_preferences=eyJ0aGVtZSI6ImxpZ2h0IiwibGFuZ3VhZ2UiOiJlbiIsInRpbWV6b25lIjoiVVRDIiwibm90aWZpY2F0aW9ucyI6dHJ1ZX0%3D; analytics_id=analytics_9cc98d58db0ee38b56f739372cf2762d; session_fingerprint=ace720ec696ae6bbc48a76f311e7779ed5abb3e939f723c96c9ccacd76b22e98; feature_flags=eyJuZXdEYXNoYm9hcmQiOnRydWUsImJldGFGZWF0dXJlcyI6ZmFsc2UsImFkdmFuY2VkU2V0dGluZ3MiOnRydWUsImV4cGVyaW1lbnRhbFVJIjpmYWxzZX0%3D; tracking_consent=accepted; device_id=device_34b8abaa5dbc25d0f6759a4f',
  })

  const tokens = await getTokens(headers)

  const users = await listUsers(headers)

  writeFileSync('users.json', JSON.stringify(users, null, 2))

  const user = await getUserSettings(tokens)
  users.push(user as User)

  writeFileSync('users.json', JSON.stringify(users, null, 2))
}
main().catch(console.error)