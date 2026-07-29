import http from 'node:http'

const data = JSON.stringify({items:[{title:'Test item',price:10,quantity:1}]})

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/create-checkout-session',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}

const req = http.request(options, res => {
  console.log('STATUS', res.statusCode)
  console.log('HEADERS', res.headers)
  res.on('data', chunk => process.stdout.write(chunk))
})

req.on('error', err => console.error('ERROR', err.message))
req.write(data)
req.end()
