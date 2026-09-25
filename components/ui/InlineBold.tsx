/**
 * 教練手寫的文字裡常有 **粗體**（從筆記貼過來），直接渲染學員會看到星號。
 * 只處理 **…** 一種，其他照原文顯示；不用 dangerouslySetInnerHTML。
 */
export default function InlineBold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return <>{parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}</>
}
