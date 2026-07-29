import { useNavigate } from 'react-router-dom'

function Success() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-green-700 mb-4">Payment Successful</h1>
        <p className="text-gray-600 mb-6">
          Your order has been completed successfully. Thank you for shopping with us!
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-3 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full font-semibold"
        >
          Back to Shop
        </button>
      </div>
    </div>
  )
}

export default Success
