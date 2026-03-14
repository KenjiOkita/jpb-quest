'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        setError(null)

        const supabase = createClient()
        // 本番環境では redirectUrl を正しく設定する必要があります
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        })

        if (error) {
            setError('エラーが発生しました: ' + error.message)
        } else {
            setMessage('教会の祈りが届きました！メールを確認して、パスワードを授かり直してください。')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="retro-window max-w-md w-full p-8 border-4 border-white shadow-[0_0_0_4px_#000,0_0_0_8px_#fff]">
                <h1 className="retro-title text-center text-3xl mb-8">パスワードの救済</h1>

                {message ? (
                    <div className="flex flex-col gap-6 text-center">
                        <p className="text-yellow-400 leading-relaxed">{message}</p>
                        <Link href="/login" className="border-4 border-white bg-white text-black py-2 px-4 font-bold hover:bg-gray-200 transition-colors">
                            ログイン画面に戻る
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="flex flex-col gap-6">
                        <p className="text-sm text-gray-400">登録済みのメールアドレスを入力してください。復活の呪文（リセットリンク）を送信します。</p>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="email" className="text-sm">📧 魔法のメールアドレス</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="hero@example.com"
                                className="bg-black border-2 border-white p-3 text-white outline-none focus:border-yellow-400 transition-colors font-inherit"
                            />
                        </div>

                        {error && <p className="text-red-500 text-xs">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="border-4 border-white bg-white text-black py-3 px-4 text-xl hover:bg-gray-200 cursor-pointer font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? '祈祷中...' : '復活の呪文を送る'}
                        </button>

                        <Link href="/login" className="text-center text-gray-500 hover:text-white text-sm underline">
                            やっぱり戻る
                        </Link>
                    </form>
                )}
            </div>
        </div>
    )
}
