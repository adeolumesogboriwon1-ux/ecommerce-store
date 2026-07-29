import 'dotenv/config'
import http from 'node:http'
import { URL } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import Stripe from 'stripe'

const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/success'
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/cancel'

// Do not initialise Stripe client at module load so tests can modify env before creating server.
function getStripeClient(requireKey = true) {
  const key = process.env.STRIPE_SECRET_KEY || ''
  if (requireKey && !key) return null
  try {
    return new Stripe(key, { apiVersion: '2022-11-15' })
  } catch (e) {
    return null
  }
}

const products = [
  {
    id: 1,
    title: 'Aurora Headphones',
    price: 129.99,
    category: 'electronics',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    description: 'Immersive sound with noise cancellation.'
  },
  {
    id: 2,
    title: 'Midnight Watch',
    price: 199.5,
    category: 'jewelery',
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=600&q=80',
    description: 'Elegant stainless steel watch for daily use.'
  },
  {
    id: 3,
    title: 'Trail Runner Jacket',
    price: 89.0,
    category: "men's clothing",
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    description: 'Weather-ready jacket with breathable fabric.'
  },
  {
    id: 4,
    title: 'Bloom Dress',
    price: 74.25,
    category: "women's clothing",
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80',
    description: 'Soft flowy dress for everyday elegance.'
  }
]

function pathModuleSafe(...parts) {
  try {
    return path.join(...parts)
  } catch (e) {
    return parts.join('/')
  }
}

const ordersFile = pathModuleSafe(process.cwd(), 'server', 'orders.json')

async function readOrdersSafe(filePath) {
  try {
    const txt = await fs.readFile(filePath, 'utf8')
    return JSON.parse(txt || '[]')
  } catch (e) {
    return []
  }
}

async function writeOrdersSafe(filePath, orders) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(orders, null, 2))
  } catch (e) {
    // ignore
  }
}

async function createStripeCheckoutSession(payload) {
  const successUrl = STRIPE_SUCCESS_URL
  const cancelUrl = STRIPE_CANCEL_URL

  const client = getStripeClient()
  const line_items = (payload.items || []).map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: { name: item.title || 'Store item' },
      unit_amount: Math.round((item.price || 0) * 100)
    },
    quantity: item.quantity || 1
  }))

  if (client) {
    try {
      const session = await client.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items
      })

      return { url: session.url, sessionId: session.id, mock: false }
    } catch (error) {
      console.error('Stripe checkout session creation failed:', error.message || error)
      throw error
    }
  }

  // fallback local mock
  return {
    url: `${successUrl}?session=mock`,
    mock: true,
    amount: Math.round((payload.total || 0) * 100)
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost')
    const reqPath = requestUrl.pathname

    console.log('Incoming request:', req.method, reqPath)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (reqPath === '/api/health') {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }

    if (reqPath === '/api/products') {
      res.writeHead(200)
      res.end(JSON.stringify(products))
      return
    }

    if (reqPath === '/api/orders' && req.method === 'GET') {
      const existing = await readOrdersSafe(ordersFile)
      res.writeHead(200)
      res.end(JSON.stringify(existing))
      return
    }

    if (reqPath === '/api/orders' && req.method === 'POST') {
      const chunks = []
      req.on('data', (c) => chunks.push(Buffer.from(c)))
      req.on('end', async () => {
        try {
          const body = Buffer.concat(chunks).toString() || '{}'
          const payload = JSON.parse(body)
          const order = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            items: payload.items || [],
            total: payload.total || 0
          }
          try {
            const all = await readOrdersSafe(ordersFile)
            all.push(order)
            await writeOrdersSafe(ordersFile, all)
          } catch (e) {
            // ignore persist errors
          }
          res.writeHead(201)
          res.end(JSON.stringify(order))
        } catch (error) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
        }
      })
      return
    }

    if (reqPath === '/api/create-checkout-session' && req.method === 'POST') {
      const chunks = []
      req.on('data', (c) => chunks.push(Buffer.from(c)))
      req.on('end', async () => {
        try {
          const body = Buffer.concat(chunks).toString() || '{}'
          const payload = JSON.parse(body)
          const session = await createStripeCheckoutSession(payload)
          res.writeHead(200)
          res.end(JSON.stringify(session))
        } catch (error) {
          const message = error && error.message ? error.message : 'Stripe checkout session creation failed'
          console.error('Create checkout session error:', message)
          res.writeHead(500)
          res.end(JSON.stringify({ error: message }))
        }
      })
      return
    }

    if (reqPath === '/api/webhook' && req.method === 'POST') {
      const chunks = []
      req.on('data', (c) => chunks.push(Buffer.from(c)))
      req.on('end', async () => {
        const rawBody = Buffer.concat(chunks)
        let event

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
        const client = getStripeClient(false)
        if (webhookSecret) {
          const sig = req.headers['stripe-signature'] || req.headers['Stripe-Signature'] || ''
          try {
            event = client.webhooks.constructEvent(rawBody, sig, webhookSecret)
          } catch (err) {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'Webhook signature verification failed' }))
            return
          }
        } else {
          try {
            event = JSON.parse(rawBody.toString() || '{}')
          } catch (err) {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'Invalid webhook payload' }))
            return
          }
        }

        try {
          if (event.type === 'checkout.session.completed' || event.type === 'mock.checkout.completed') {
            const session = event.data && event.data.object ? event.data.object : event
            const order = {
              id: session.id || Date.now(),
              createdAt: new Date().toISOString(),
              items: session.display_items || session.items || [],
              total: (session.amount_total || session.total || 0) / 100
            }
            try {
              const all = await readOrdersSafe(ordersFile)
              all.push(order)
              await writeOrdersSafe(ordersFile, all)
            } catch (e) {
              // ignore
            }
          }

          res.writeHead(200)
          res.end(JSON.stringify({ received: true }))
        } catch (err) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid webhook payload' }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  })
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const server = createServer()
  server.listen(3001, '127.0.0.1', () => {
    console.log('Backend running on http://127.0.0.1:3001')
  })
}

export default null
