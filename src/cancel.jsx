import { useNavigate } from 'react-router-dom'

function Cancel() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-yellow-700 mb-4">Payment Cancelled</h1>
        <p className="text-gray-600 mb-6">
          It looks like you cancelled your payment. You can return to the store and try again anytime.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-full font-semibold"
        >
          Return to Shop
        </button>
      </div>
    </div>
  )
}

export default Cancel
