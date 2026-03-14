import { login, signup } from './actions'

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="retro-window max-w-md w-full">
                <h1 className="retro-title text-center text-3xl mb-6">JPB クエスト</h1>
                <p className="text-center mb-6 text-gray-300">ギルドへのログイン（冒険者認証）</p>

                <form className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="email" className="text-sm">📧 魔法のメールアドレス</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="bg-black border-2 border-white p-2 text-white outline-none focus:border-[var(--active-color)] transition-colors font-inherit"
                        />
                    </div>

                    <div className="flex flex-col gap-1 mb-2">
                        <label htmlFor="password" className="text-sm">🔑 秘密の暗号（パスワード）</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="bg-black border-2 border-white p-2 text-white outline-none focus:border-[var(--active-color)] transition-colors font-inherit"
                        />
                        <a href="/reset-password" params-recovery="true" className="text-[10px] text-gray-500 hover:text-white underline mt-1 text-right">パスワードを忘れた（教会の祈り）</a>
                    </div>

                    <button
                        formAction={login}
                        className="border-4 border-white bg-white text-black py-2 px-4 text-xl hover:bg-gray-200 cursor-pointer font-bold transition-colors"
                    >
                        ログイン（冒険を再開する）
                    </button>

                    <div className="text-center mt-4 text-sm text-gray-400">
                        --- まだ冒険者登録をしていない場合 ---
                    </div>

                    <button
                        formAction={signup}
                        className="border-2 border-dashed border-gray-400 text-gray-300 py-2 px-4 mt-2 hover:border-white hover:text-white cursor-pointer transition-colors"
                    >
                        新規登録（ギルドに加入する）
                    </button>
                </form>
            </div>
        </div>
    )
}
