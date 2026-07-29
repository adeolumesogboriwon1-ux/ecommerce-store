import { useState, useEffect } from "react"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/api"

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState("")

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then(res => res.json())
      .then(data => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => {
        setProducts([])
        setLoading(false)
      })
  }, [])

  const addToCart = (product) => {
    setCart([...cart, product])
    setCheckoutMessage("")
  }

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutMessage("Your cart is empty.")
      setCartOpen(true)
      return
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0)

    try {
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, total })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Checkout failed")
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      setCheckoutMessage("Order placed successfully!")
      setCart([])
      setCartOpen(true)
    } catch (error) {
      const message = error?.message || "Could not place your order right now."
      setCheckoutMessage(message)
      setCartOpen(true)
    }
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0)

  const categories = ["all", "electronics", "jewelery", "men's clothing", "women's clothing"]

  const filtered = selectedCategory === "all"
    ? products
    : products.filter(p => p.category === selectedCategory)

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Navbar */}
      <div className="bg-white shadow px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-blue-600">🛍️ ShopEasy</h1>
        <button
          onClick={() => setCartOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium"
        >
          Cart 🛒 {cart.length}
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 px-6 py-4 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border
              ${selectedCategory === cat
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <p className="text-center text-gray-500 mt-10">Loading products...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 px-6 pb-10">
          {filtered.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow p-4 flex flex-col">
              <img
                src={product.image}
                alt={product.title}
                className="h-40 object-contain mb-4"
              />
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{product.title}</p>
              <p className="text-blue-600 font-bold mt-2">${product.price}</p>
              <button
                onClick={() => addToCart(product)}
                className="mt-3 bg-blue-600 text-white text-sm py-2 px-4 rounded-lg w-full"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="flex-1 bg-black opacity-40"
            onClick={() => setCartOpen(false)}
          />
          <div className="bg-white w-80 h-full shadow-xl flex flex-col">

            {/* Drawer Header */}
            <div className="flex justify-between items-center px-4 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">Your Cart</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="text-gray-500 text-xl"
              >✕</button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-center mt-10">Your cart is empty</p>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="flex gap-3 mb-4 items-center">
                    <img src={item.image} className="w-12 h-12 object-contain" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-700 line-clamp-2">{item.title}</p>
                      <p className="text-blue-600 font-bold text-sm">${item.price}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-red-400 text-sm"
                    >✕</button>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="border-t px-4 py-4">
              <div className="flex justify-between mb-4">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-blue-600">${total.toFixed(2)}</span>
              </div>
              {checkoutMessage && (
                <p className="mb-3 text-sm text-center text-green-600">{checkoutMessage}</p>
              )}
              <button
                onClick={handleCheckout}
                className="bg-blue-600 text-white w-full py-3 rounded-xl font-medium"
              >
                Checkout
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

export default App