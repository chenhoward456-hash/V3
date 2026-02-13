export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-7 bg-gray-200 rounded-lg w-32 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-40"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded-full w-24"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl p-4 text-center">
                <div className="h-3 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-20 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily check-in skeleton */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="h-6 bg-gray-200 rounded w-28 mb-4"></div>
          <div className="h-2.5 bg-gray-200 rounded-full w-full mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>

        {/* Wellness skeleton */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-4">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="flex gap-2">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex-1 h-11 bg-gray-100 rounded-lg"></div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Body data skeleton */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
          <div className="h-7 bg-gray-200 rounded w-36 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-4">
                <div className="h-3 bg-gray-200 rounded w-10 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    </div>
  )
}
