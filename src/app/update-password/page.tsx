'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({
            password: password,
        })

        if (error) {
            setError('新しいパスワードの授与に失敗しました: ' + error.message)
            setLoading(false)
        } else {
            alert('新しいパスワードが設定されました！冒険を再開しましょう。')
            router.push('/login')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="retro-window max-w-md w-full p-8 border-4 border-white shadow-[0_0_0_4px_#000,0_0_0_8px_#fff]">
                <h1 className="retro-title text-center text-3xl mb-8">新しい暗号の設定</h1>

                <form onSubmit={handleUpdate} className="flex flex-col gap-6">
                    <p className="text-sm text-gray-400 font-bold text-yellow-500">聖なるリンクにより認証されました。新しい秘密の暗号（パスワード）を決めてください。</p>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="password" className="text-sm">🔑 新しい秘密の暗号</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="最低6文字以上"
                            className="bg-black border-2 border-white p-3 text-white outline-none focus:border-yellow-400 transition-colors font-inherit"
                        />
                    </div>

                    {error && <p className="text-red-500 text-xs">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="border-4 border-white bg-white text-black py-3 px-4 text-xl hover:bg-gray-200 cursor-pointer font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? '書き換え中...' : '暗号を確定する'}
                    </button>
                </form>
            </div>
        </div>
    )
}
