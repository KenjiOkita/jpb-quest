export default function ErrorPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="retro-window max-w-md w-full text-center">
                <h1 className="text-3xl text-[var(--danger-color)] mb-4">⚠️ エラー発生 ⚠️</h1>
                <p className="mb-6">冒険者の認証に失敗しました。<br />呪文（メールアドレスまたはパスワード）が間違っているようです。</p>
                <a href="/login" className="inline-block border-2 border-white px-4 py-2 hover:bg-white hover:text-black transition-colors">
                    ログイン画面へ戻る
                </a>
            </div>
        </div>
    )
}
