'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
    const searchParams = useSearchParams()
    const message = searchParams.get('message')

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="retro-window max-w-md w-full text-center p-8 border-4 border-red-600 shadow-[0_0_20px_rgba(255,0,0,0.5)]">
                <h1 className="text-3xl text-[var(--danger-color)] mb-4 font-bold">⚠️ エラー発生 ⚠️</h1>
                <p className="mb-2 text-xl font-bold">冒険の開始に失敗しました</p>
                
                <div className="bg-gray-900 border border-gray-700 p-4 mb-6 rounded text-sm text-gray-300 font-mono text-left overflow-auto max-h-40">
                    {message ? decodeURIComponent(message) : '原因不明の魔力障害（詳細なし）'}
                </div>

                <p className="mb-6 text-sm text-gray-400">
                    呪文（メール・パスワード）を確認するか、<br />
                    時間を置いてから再度挑戦してください。
                </p>

                <a href="/login" className="inline-block border-2 border-white px-6 py-3 font-bold hover:bg-white hover:text-black transition-colors active:scale-95">
                    ログイン画面へ戻る
                </a>
            </div>
        </div>
    )
}

export default function ErrorPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">鑑定中...</div>}>
            <ErrorContent />
        </Suspense>
    )
}
