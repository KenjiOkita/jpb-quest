'use client'

import { useFormStatus } from 'react-dom'
import { login, signup } from './actions'

function SubmitButton({ label, loadingLabel, isPrimary = true }: { label: string, loadingLabel: string, isPrimary?: boolean }) {
    const { pending } = useFormStatus()
    
    if (isPrimary) {
        return (
            <button
                type="submit"
                formAction={login}
                disabled={pending}
                className={`border-4 border-white bg-white text-black py-4 px-4 text-xl font-bold transition-all active:scale-95 ${pending ? 'opacity-50 cursor-wait' : 'hover:bg-gray-200 cursor-pointer shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]'}`}
            >
                {pending ? loadingLabel : label}
            </button>
        )
    }

    return (
        <button
            type="submit"
            formAction={signup}
            disabled={pending}
            className={`border-2 border-dashed border-gray-400 text-gray-300 py-3 px-4 mt-2 transition-all active:scale-95 ${pending ? 'opacity-50 cursor-wait' : 'hover:border-white hover:text-white cursor-pointer'}`}
        >
            {pending ? loadingLabel : label}
        </button>
    )
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center relative z-[9999] pointer-events-auto bg-black overflow-hidden">
            {/* フォームコンテナ */}
            <div className="retro-window max-w-md w-full relative z-[10000] bg-black p-8 shadow-2xl border-4 border-white mx-4">
                <h1 className="retro-title text-center text-3xl mb-6">JPB クエスト</h1>
                <p className="text-center mb-6 text-gray-300 font-bold">ギルドへのログイン（冒険者認証）</p>

                <form className="flex flex-col gap-4 relative z-[10001]">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="email" className="text-sm">📧 魔法のメールアドレス</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            placeholder="hero@example.com"
                            className="bg-black border-2 border-white p-3 text-white outline-none focus:border-blue-400 transition-colors font-inherit text-lg"
                        />
                    </div>

                    <div className="flex flex-col gap-1 mb-2">
                        <label htmlFor="password" className="text-sm">🔑 秘密の暗号（パスワード）</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            placeholder="********"
                            className="bg-black border-2 border-white p-3 text-white outline-none focus:border-blue-400 transition-colors font-inherit text-lg"
                        />
                        <a href="/reset-password" params-recovery="true" className="text-[10px] text-gray-500 hover:text-white underline mt-1 text-right">パスワードを忘れた（教会の祈り）</a>
                    </div>

                    <SubmitButton label="ログイン（冒険を再開する）" loadingLabel="詠唱中..." />

                    <div className="text-center mt-6 text-sm text-gray-400">
                        --- まだ冒険者登録をしていない場合 ---
                    </div>

                    <SubmitButton label="新規登録（ギルドに加入する）" loadingLabel="登録中..." isPrimary={false} />
                </form>
            </div>
            
            {/* 背景の遮断レイヤーを明示的に背面に送る */}
            <div className="fixed inset-0 bg-black/60 -z-10 pointer-events-none"></div>
        </div>
    )
}
