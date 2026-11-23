import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'

const prompt = 'You are watching silent charades. What physical action is the performer acting out? Reply with one best guess in a short English phrase. If you cannot tell, say "unclear".'
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

async function main() {
  const args = process.argv.slice(2)
  const allowHttp = args[0] === '--allow-http'
  const [profile, ...files] = allowHttp ? args.slice(1) : args
  if (!profile || files.length < 1 || files.length > 3) {
    throw new Error('Usage: node scripts/check-stage-vision.mjs [--allow-http] PROFILE IMAGE.png [IMAGE.png ...] (one to three images)')
  }
  const env = parseEnv(await readFile(profile, 'utf8'))
  const key = env.OPENAI_API_KEY || env.PLANB_AI_KEY
  const model = process.env.BAD_ACTORS_PROBE_MODEL || env.OPENAI_MODEL || env.PLANB_AI_MODEL || 'gpt-4.1'
  const url = new URL(env.OPENAI_BASE_URL || env.PLANB_AI_BASE_URL || 'https://api.openai.com/v1')
  if (!key || /[\r\n]/.test(key) || url.username || url.password || url.search || url.hash) {
    throw new Error('Check the API key and base URL in the supplied profile.')
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && allowHttp)) {
    throw new Error('The configured endpoint requires --allow-http to send a bearer token without TLS.')
  }
  url.pathname = url.pathname.replace(/\/+$/, '') + '/chat/completions'
  const images = await Promise.all(files.map(async file => {
    const bytes = await readFile(file)
    if (!bytes.subarray(0, 8).equals(signature) || bytes.length > 2_000_000) throw new Error('Supply stage PNGs under 2 MB.')
    return bytes
  }))

  for (const [i, bytes] of images.entries()) {
    const receipt = {
      sample: i + 1, utc: new Date().toISOString(), requestedModel: model,
      imageSha256: createHash('sha256').update(bytes).digest('hex'),
    }
    const start = performance.now()
    try {
      const res = await fetch(url, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model, max_completion_tokens: 512,
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,' + bytes.toString('base64') } },
          ] }],
        }),
      })
      receipt.status = res.status
      if (!res.ok) throw new Error('Provider returned HTTP ' + res.status)
      const data = await res.json()
      const guess = data.choices?.[0]?.message?.content
      if (typeof guess !== 'string' || !guess.trim()) throw new Error('Provider returned no guess.')
      receipt.guess = guess.trim().slice(0, 240)
      receipt.returnedModel = data.model
      receipt.tokens = data.usage?.total_tokens
    } catch (error) {
      receipt.error = error.message
      process.exitCode = 1
    }
    receipt.elapsedMs = Math.round(performance.now() - start)
    console.log(JSON.stringify(receipt))
    if (receipt.error) break
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
