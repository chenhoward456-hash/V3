import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn/ui 的 class 合併工具：clsx 條件組合 + tailwind-merge 去衝突。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
