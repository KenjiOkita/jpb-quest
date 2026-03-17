'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
    const router = useRouter()
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

    const getSupabase = () => {
        if (supabaseRef.current) return supabaseRef.current
        if (typeof window === 'undefined') return null
        supabaseRef.current = createClient()
        return supabaseRef.current
    }

    const [user, setUser] = useState<any>(null)
    const [displayName, setDisplayName] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // 追加：パスワード用のステート
    const [newPassword, setNewPassword] = useState('')
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

    // ユーザー情報とプロフィールの読み込み
    useEffect(() => {
        const loadProfile = async () => {
            const supabase = getSupabase()
            if (!supabase) {
                setLoading(false)
                return
            }
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)
            setDisplayName(user.email?.split('@')[0] || '')
            setNewEmail(user.email || '')

            // profilesテーブルからプロフィール情報を取得
            try {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                if (profile) {
                    if (profile.display_name) setDisplayName(profile.display_name)
                    if (profile.avatar_url) setAvatarUrl(profile.avatar_url)
                }
            } catch {
                // profilesテーブルが存在しない場合は無視
            }
            setLoading(false)
        }
        loadProfile()
    }, [router])

    // プロフィール保存
    const saveProfile = async () => {
        if (!user) return
        const supabase = getSupabase()
        if (!supabase) {
            setMessage('Supabase接続の初期化に失敗しました。')
            return
        }
        setSaving(true)
        setMessage(null)

        try {
            const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                display_name: displayName,
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString(),
            })

            if (error) {
                setMessage('保存に失敗しました: ' + error.message)
            } else {
                setMessage('プロフィールを保存しました！')
            }
        } catch (e: any) {
            setMessage('エラー: ' + e.message)
        }
        setSaving(false)
    }

    // メールアドレス変更
    const updateEmail = async () => {
        if (!newEmail || newEmail === user?.email) return
        const supabase = getSupabase()
        if (!supabase) {
            setMessage('Supabase接続の初期化に失敗しました。')
            return
        }
        setSaving(true)
        setMessage(null)
        const { error } = await supabase.auth.updateUser({ email: newEmail })
        if (error) {
            setMessage('アドレス変更エラー: ' + error.message)
        } else {
            setMessage('確認メールを送信しました。メール内のリンクをクリックしてください。')
        }
        setSaving(false)
    }

    // アバター写真のアップロード
    const uploadAvatar = async (event: any) => {
        try {
            const supabase = getSupabase()
            if (!supabase) {
                setMessage('Supabase接続の初期化に失敗しました。')
                return
            }
            setUploading(true)
            if (!event.target.files || event.target.files.length === 0) return

            const file = event.target.files[0]
            const fileExt = file.name.split('.').pop()
            const filePath = `${user.id}-${Math.random()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            setAvatarUrl(publicUrl)
            setMessage('写真をアップロードしました。下の保存ボタンを押してください。')
        } catch (error: any) {
            if (error.message.includes('Bucket not found')) {
                setMessage('【要設定】Supabaseでavatarsバケットを作成する必要があります。')
            } else {
                setMessage('アップロードエラー: ' + error.message)
            }
        } finally {
            setUploading(false)
        }
    }

    // パスワード変更
    const changePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setPasswordMessage('パスワードは最低6文字以上にしてください。')
            return
        }
        const supabase = getSupabase()
        if (!supabase) {
            setPasswordMessage('Supabase接続の初期化に失敗しました。')
            return
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
            setPasswordMessage('変更に失敗: ' + error.message)
        } else {
            setPasswordMessage('パスワードを変更しました！')
            setNewPassword('')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-white text-2xl animate-pulse">読込中...</div>
            </div>
        )
    }

    return (
        <main className="py-12 min-h-screen">
            <div className="max-w-2xl mx-auto px-4">
                {/* ヘッダー */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-widest">⚙️ 冒険者設定</h1>
                    <Link href="/" className="text-gray-400 hover:text-white underline text-sm tracking-widest">
                        ← ギルドに戻る
                    </Link>
                </div>

                {/* プロフィール写真 */}
                <div className="retro-window mb-6">
                    <h2 className="retro-title text-xl mb-4">📸 冒険者の肖像</h2>
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <img
                                src={avatarUrl || `https://i.pravatar.cc/150?u=${user?.id}`}
                                alt="Avatar"
                                className="w-24 h-24 pixelated-avatar border-4 border-white shadow-[4px_4px_0_#444] group-hover:brightness-75 transition-all cursor-pointer"
                            />
                            <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-xs text-white font-bold bg-black/60 text-center p-1">
                                {uploading ? '⬆️...' : '📷 変更'}
                                <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                            </label>
                        </div>
                        <div className="text-gray-400 text-sm">
                            <p>写真をクリックして変更できます。</p>
                            <p className="text-[10px] text-gray-600 mt-1">※ JPG / PNG推奨</p>
                        </div>
                    </div>
                </div>

                {/* 基本情報 */}
                <div className="retro-window mb-6">
                    <h2 className="retro-title text-xl mb-4">📝 基本情報</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-[#aaa] uppercase tracking-[0.2em] font-bold">メールアドレス（ログイン用）</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="bg-black border-2 border-white p-3 text-white outline-none font-inherit focus:border-yellow-400 transition-colors flex-grow"
                                />
                                <button
                                    onClick={updateEmail}
                                    disabled={saving || !newEmail || newEmail === user?.email}
                                    className="bg-black border-2 border-white py-2 px-4 text-white hover:bg-white hover:text-black transition-all font-bold text-xs whitespace-nowrap disabled:opacity-30"
                                >
                                    アドレス変更
                                </button>
                            </div>
                            <p className="text-[9px] text-gray-500 mt-1">※変更後、新旧のアドレスに確認メールが届く場合があります。</p>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-[#aaa] uppercase tracking-[0.2em] font-bold">表示名（冒険者名）</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="ここに表示名を入力"
                                className="bg-black border-2 border-white p-3 text-white outline-none font-inherit focus:border-yellow-400 transition-colors"
                            />
                        </div>
                    </div>

                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="mt-6 w-full bg-white text-black border-4 border-black py-3 text-xl hover:bg-yellow-100 transition-all font-bold shadow-[0_4px_0_#888] active:translate-y-1 active:shadow-none tracking-[0.2em] disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '💾 プロフィールを保存'}
                    </button>

                    <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-800 flex justify-center">
                        <Link href="/" className="bg-black border-2 border-white px-8 py-3 text-white hover:bg-white hover:text-black transition-all font-bold tracking-[0.2em] text-sm shadow-[4px_4px_0_#444] active:translate-y-1 active:shadow-none">
                            ← ギルド（メイン画面）に戻る
                        </Link>
                    </div>

                    {message && (
                        <p className={`mt-4 p-3 bg-black/80 border border-current text-sm text-center ${message.includes('エラー') || message.includes('失敗') ? 'text-red-500' : 'text-yellow-400'}`}>
                            {message}
                        </p>
                    )}
                </div>

                {/* パスワード変更 */}
                <div className="retro-window mb-6">
                    <h2 className="retro-title text-xl mb-4">🔑 秘密の暗号（パスワード）変更</h2>
                    <div className="flex flex-col gap-3">
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="新しいパスワード（最低6文字）"
                            className="bg-black border-2 border-white p-3 text-white outline-none font-inherit focus:border-yellow-400 transition-colors"
                        />
                        <button
                            onClick={changePassword}
                            className="bg-black border-2 border-white py-2 text-white hover:bg-white hover:text-black transition-all font-bold tracking-widest"
                        >
                            暗号を変更する
                        </button>
                        {passwordMessage && (
                            <p className={`text-sm text-center ${passwordMessage.includes('失敗') ? 'text-red-500' : 'text-yellow-400'}`}>
                                {passwordMessage}
                            </p>
                        )}
                    </div>
                </div>

                {/* アカウント情報 */}
                <div className="retro-window mb-6">
                    <h2 className="retro-title text-xl mb-4">📊 冒険者ステータス</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-gray-600 text-[10px] uppercase">User ID</span>
                            <span className="text-gray-400 font-mono text-[10px] break-all">{user?.id}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-600 text-[10px] uppercase">登録日</span>
                            <span className="text-gray-400">{user?.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-600 text-[10px] uppercase">最終ログイン</span>
                            <span className="text-gray-400">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('ja-JP') : '-'}</span>
                        </div>
                    </div>
                </div>

                {/* ログアウト */}
                <div className="text-center">
                    <button
                        onClick={async () => {
                            const supabase = getSupabase()
                            if (!supabase) {
                                return
                            }
                            await supabase.auth.signOut()
                            router.push('/login')
                        }}
                        className="text-red-900 hover:text-red-500 underline text-sm tracking-widest transition-colors"
                    >
                        ログアウト（冒険を中断する）
                    </button>
                </div>
            </div>
        </main>
    )
}
