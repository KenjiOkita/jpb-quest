import type { Metadata } from 'next'
import { DotGothic16 } from 'next/font/google'
import './globals.css'

const dotGothic = DotGothic16({ 
  weight: '400', 
  subsets: ['latin'],
  variable: '--font-dot-gothic',
})

export const metadata: Metadata = {
  title: 'JPBクエスト',
  description: 'レトロRPG風タスク管理アプリ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${dotGothic.variable} antialiased max-w-4xl mx-auto`}>
        {children}
      </body>
    </html>
  )
}
