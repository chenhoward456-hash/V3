import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const DOC_MAP: Record<string, { file: string; title: string }> = {
  terms: { file: 'terms-v1.md', title: '服務條款' },
  privacy: { file: 'privacy-v1.md', title: '隱私政策' },
  disclaimer: { file: 'health-disclaimer-v1.md', title: '健康免責聲明' },
}

// 簡易 markdown → HTML（避免加 dep）
function mdToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // headings
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-8 mb-3 border-b border-gray-200 pb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
    // blockquote (single line)
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-amber-400 bg-amber-50 pl-3 py-1 my-2 text-sm text-amber-900">$1</blockquote>')
    // bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // bullets
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc">$1</li>')
    // hr
    .replace(/^---$/gm, '<hr class="my-6 border-gray-200" />')
    // paragraphs (double newline)
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<') || block.trim() === '') return block
      return `<p class="my-2 leading-relaxed text-sm">${block.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n\n')
}

export default async function LegalDocPage({ params }: { params: { doc: string } }) {
  const meta = DOC_MAP[params.doc]
  if (!meta) notFound()

  let content = ''
  try {
    const filepath = resolve(process.cwd(), 'content/legal', meta.file)
    content = await readFile(filepath, 'utf-8')
  } catch {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">← 返回首頁</Link>
          <div className="flex gap-3 text-xs text-gray-500">
            <Link href="/legal/terms" className={params.doc === 'terms' ? 'underline font-medium' : 'hover:underline'}>服務條款</Link>
            <Link href="/legal/privacy" className={params.doc === 'privacy' ? 'underline font-medium' : 'hover:underline'}>隱私政策</Link>
            <Link href="/legal/disclaimer" className={params.doc === 'disclaimer' ? 'underline font-medium' : 'hover:underline'}>免責聲明</Link>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <article
          className="bg-white p-6 sm:p-10 rounded-xl shadow-sm text-gray-800"
          dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
        />
      </div>
    </div>
  )
}

export async function generateStaticParams() {
  return Object.keys(DOC_MAP).map(doc => ({ doc }))
}
