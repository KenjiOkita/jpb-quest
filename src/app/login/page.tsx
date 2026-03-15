'use client'

import { useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { login, signup } from './actions'
import { Suspense } from 'react'

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

function LoginContent() {
    const searchParams = useSearchParams()
    const isSuccess = searchParams.get('success') === 'true'
    const loginError = searchParams.get('error')
    const signupError = searchParams.get('signup_error')

    const getErrorMessage = (code: string | null, mode: 'login' | 'signup') => {
        if (!code) return null
        if (code === 'invalid_credentials') {
            return mode === 'login'
                ? 'メールアドレスが未登録、またはパスワードが違います。'
                : '登録に失敗しました。入力情報を確認してください。'
        }
        if (code === 'email_not_confirmed') return 'メール認証が未完了です。受信メールの認証リンクを開いてください。'
        if (code === 'too_many_requests') return '試行回数が多すぎます。少し待ってから再試行してください。'
        if (code === 'network') return '通信エラーが発生しました。電波状況を確認して再試行してください。'
        if (code === 'weak_password') return 'パスワードが弱すぎます。より長く複雑なものを設定してください。'
        if (code === 'user_exists') return 'このメールアドレスはすでに登録済みです。ログインをお試しください。'
        return mode === 'login'
            ? 'ログインに失敗しました。入力情報を確認して再試行してください。'
            : '新規登録に失敗しました。入力情報を確認して再試行してください。'
    }

    const loginErrorMessage = getErrorMessage(loginError, 'login')
    const signupErrorMessage = getErrorMessage(signupError, 'signup')

    return (
        <div className="min-h-screen flex items-center justify-center relative pointer-events-auto overflow-hidden">
            {/* 背景の遮断レイヤー（背景画像を見せつつ文字を読みやすくする） */}
            <div className="fixed inset-0 bg-black/40 z-0"></div>

            {/* フォームコンテナ */}
            <div className="retro-window max-w-md w-full relative z-10 bg-black p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-white mx-4 my-8">
                <h1 className="retro-title text-center text-3xl mb-6">JPB クエスト</h1>
                
                {isSuccess && (
                    <div className="bg-green-900 border-2 border-green-400 p-4 mb-6 text-green-100 text-sm animate-bounce text-center">
                        ✨ 冒険者登録に成功しました！ ✨<br />
                        そのままログインして冒険を開始してください。
                    </div>
                )}
                {loginErrorMessage && (
                    <div className="bg-red-950/80 border-2 border-red-500 p-3 mb-4 text-red-100 text-sm text-left">
                        <p className="font-bold mb-1">ログインできませんでした</p>
                        <p>{loginErrorMessage}</p>
                    </div>
                )}
                {signupErrorMessage && (
                    <div className="bg-yellow-950/80 border-2 border-yellow-600 p-3 mb-4 text-yellow-100 text-sm text-left">
                        <p className="font-bold mb-1">新規登録に失敗しました</p>
                        <p>{signupErrorMessage}</p>
                    </div>
                )}

                <p className="text-center mb-6 text-gray-300 font-bold">ギルドへのログイン（冒険者認証）</p>

                <form className="flex flex-col gap-4 relative z-20">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="email" className="text-sm">📧 魔法のメールアドレス</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            inputMode="email"
                            enterKeyHint="next"
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
                            autoComplete="current-password"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="done"
                            placeholder="********"
                            className="bg-black border-2 border-white p-3 text-white outline-none focus:border-blue-400 transition-colors font-inherit text-lg"
                        />
                        <a href="/reset-password" params-recovery="true" className="text-[10px] text-gray-500 hover:text-white underline mt-1 text-right">パスワードを忘れた（教会の祈り）</a>
                    </div>

                    <div className="mt-4 flex flex-col gap-6">
                        <SubmitButton label="ログイン（冒険を再開する）" loadingLabel="詠唱中..." />

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-700"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-black px-2 text-gray-500">はじめての方はこちら</span>
                            </div>
                        </div>

                        <SubmitButton label="新規登録（ギルドに加入する）" loadingLabel="登録中..." isPrimary={false} />
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white font-bold">鑑定中...</div>}>
            <LoginContent />
        </Suspense>
    )
}
