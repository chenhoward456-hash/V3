'use client'

import { useState } from 'react'

interface FaqItem {
  q: string
  a: string
}

const faqs: FaqItem[] = [
  {
    q: '\u9019\u8ddf\u4e00\u822c\u7684\u98f2\u98df App \u6709\u4ec0\u9ebc\u4e0d\u540c\uff1f',
    a: '\u4e00\u822c App \u53ea\u8b93\u4f60\u8a18\u9304\u71b1\u91cf\uff0c\u4f46\u4e0d\u6703\u544a\u8a34\u4f60\u300c\u65b9\u5411\u5c0d\u4e0d\u5c0d\u300d\u3002Howard Protocol \u7684\u667a\u80fd\u5f15\u64ce\u6703\u6839\u64da\u4f60\u7684\u771f\u5be6\u9ad4\u91cd\u8da8\u52e2\uff0c\u81ea\u52d5\u6821\u6b63 TDEE\u3001\u6bcf\u9031\u5206\u6790\u9032\u5ea6\u3001\u5224\u65b7\u4f60\u8a72\u4e0d\u8a72\u8abf\u6574 \u2014 \u662f\u4e00\u5957\u6703\u300c\u601d\u8003\u300d\u7684\u7cfb\u7d71\u3002',
  },
  {
    q: '\u6211\u4e0d\u6703\u8a08\u7b97\u71b1\u91cf\uff0c\u53ef\u4ee5\u7528\u55ce\uff1f',
    a: '\u53ef\u4ee5\uff01\u521d\u671f\u4e0d\u7528\u592a\u7cbe\u78ba\uff0c\u7528\u300c\u624b\u638c\u6cd5\u300d\u4f30\u7b97\u4efd\u91cf\u5c31\u597d\u3002\u7cfb\u7d71\u6703\u6839\u64da\u4f60\u7684\u9ad4\u91cd\u8da8\u52e2\u81ea\u52d5\u6821\u6b63\uff0c\u5c31\u7b97\u8a18\u9304\u4e0d\u5b8c\u7f8e\uff0c14 \u5929\u5f8c\u7cfb\u7d71\u4e5f\u80fd\u7b97\u51fa\u4f60\u5be6\u969b\u71c3\u71d2\u591a\u5c11\u3002',
  },
  {
    q: '\u8981\u7d81\u7d04\u55ce\uff1f\u53ef\u4ee5\u96a8\u6642\u53d6\u6d88\u55ce\uff1f',
    a: '\u5168\u90e8\u6708\u7e73\u5236\uff0c\u4e0d\u7d81\u7d04\uff0c\u96a8\u6642\u53ef\u53d6\u6d88\u3002\u7576\u6708\u4e0d\u9000\u8cbb\uff0c\u4e0b\u500b\u6708\u505c\u6b62\u6263\u6b3e\u3002\u514d\u8cbb\u7248\u6c38\u4e45\u514d\u8cbb\uff0c\u96a8\u6642\u53ef\u5347\u7d1a\u4ed8\u8cbb\u65b9\u6848\u3002',
  },
  {
    q: '\u514d\u8cbb\u7248\u53ef\u4ee5\u7528\u591a\u4e45\uff1f\u6709\u4ec0\u9ebc\u9650\u5236\uff1f',
    a: '\u514d\u8cbb\u7248\u6c38\u4e45\u514d\u8cbb\uff0c\u5305\u542b\u9ad4\u91cd\u8da8\u52e2\u8ffd\u8e64\u3001\u98f2\u98df\u7d00\u9304\u3001TDEE \u81ea\u52d5\u8a08\u7b97\u3001\u548c 14 \u5929\u5f8c\u81ea\u52d5\u6821\u6b63\u71df\u990a\u76ee\u6a19\u3002\u4ed8\u8cbb\u7248\u984d\u5916\u89e3\u9396\u8eab\u5fc3\u72c0\u614b\u8ffd\u8e64\u3001AI \u98f2\u98df\u9867\u554f\u3001\u6559\u7df4\u6bcf\u9031 review \u7b49\u529f\u80fd\u3002',
  },
  {
    q: '\u9700\u8981\u4ec0\u9ebc\u8a2d\u5099\uff1f',
    a: '\u53ea\u9700\u8981\u624b\u6a5f\u548c\u4e00\u53f0\u9ad4\u91cd\u8a08\u5c31\u597d\u3002\u7cfb\u7d71\u900f\u904e LINE \u548c\u7db2\u9801\u904b\u4f5c\uff0c\u4e0d\u9700\u8981\u5b89\u88dd\u984d\u5916 App\u3002\u5efa\u8b70\u4f7f\u7528\u667a\u6167\u578b\u9ad4\u91cd\u8a08\uff08\u80fd\u6e2c\u9ad4\u8102\uff09\uff0c\u4f46\u666e\u901a\u9ad4\u91cd\u8a08\u4e5f\u53ef\u4ee5\u3002',
  },
]

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="space-y-3">
      {faqs.map((item, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <button
            onClick={() => toggle(index)}
            className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50/50 transition-colors"
            aria-expanded={openIndex === index}
          >
            <span className="text-sm font-semibold text-navy pr-4">{item.q}</span>
            <span
              className={`text-gray-400 text-xl shrink-0 transition-transform duration-300 ${
                openIndex === index ? 'rotate-45' : ''
              }`}
            >
              +
            </span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              openIndex === index ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <p className="px-6 pb-5 text-sm text-gray-600 leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
