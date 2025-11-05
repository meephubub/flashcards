export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(JSON.stringify({ ok: true, t: Date.now() }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
