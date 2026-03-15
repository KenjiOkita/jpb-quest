'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import PixelAvatar from '@/components/PixelAvatar'

export default function DashboardClient({ initialProjects, initialTasks, user }: any) {
    const [projects, setProjects] = useState(initialProjects)
    const [tasks, setTasks] = useState(initialTasks)
    const [activeTab, setActiveTab] = useState('all')
    const [newProjectName, setNewProjectName] = useState('')
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [newTaskAssignee, setNewTaskAssignee] = useState('')
    const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null)
    const [editAssigneeValue, setEditAssigneeValue] = useState('')
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [comments, setComments] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [newCommentImageUrl, setNewCommentImageUrl] = useState<string | null>(null)
    const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [editCommentText, setEditCommentText] = useState('')
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
    const [editTaskTitle, setEditTaskTitle] = useState('')
    const [newTaskPriority, setNewTaskPriority] = useState('normal') // normal, elite, boss
    const [userRole, setUserRole] = useState<string | null>(null) // 'owner', 'admin', 'member'
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState<string>('')
    const [uploading, setUploading] = useState(false)
    const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
    const [isJoining, setIsJoining] = useState(false)
    const [inviteCodeInput, setInviteCodeInput] = useState('')
    const [activeProject, setActiveProject] = useState<any>(null)
    const [projectInviteCode, setProjectInviteCode] = useState<string | null>(null)
    const [projectMembers, setProjectMembers] = useState<any[]>([])
    const [isQuestClearing, setIsQuestClearing] = useState(false)
    const [userProfiles, setUserProfiles] = useState<Record<string, { display_name: string, avatar_url: string }>>({})
    const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null)

    const supabase = createClient()
    const router = useRouter()

    const generateInviteCode = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        let code = ''
        for (let i = 0; i < 8; i++) {
            code += chars[Math.floor(Math.random() * chars.length)]
        }
        return code
    }

    const ensureProjectInviteCode = async (projectId: string, currentInviteCode?: string | null) => {
        if (currentInviteCode) return currentInviteCode

        for (let i = 0; i < 5; i++) {
            const code = generateInviteCode()
            const { error } = await supabase
                .from('projects')
                .update({ invite_code: code })
                .eq('id', projectId)
                .is('invite_code', null)

            if (!error) {
                setProjectInviteCode(code)
                setActiveProject((prev: any) => prev ? { ...prev, invite_code: code } : prev)
                setProjects((prev: any[]) => prev.map((p: any) => p.id === projectId ? { ...p, invite_code: code } : p))
                return code
            }

            // unique制約エラーの場合は再生成して再試行
            if (error.code !== '23505') {
                console.error('[JPBQuest] 招待コード発行エラー:', error.message)
                break
            }
        }

        return null
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
    }

    // 招待コードを使用してプロジェクトに参加
    const joinProject = async () => {
        if (!inviteCodeInput) return
        setIsJoining(true)
        const normalizedCode = inviteCodeInput.trim().toLowerCase()
        const { error } = await supabase.rpc('join_project_by_code', { target_invite_code: normalizedCode })
        if (error) {
            alert('参加エラー: ' + error.message)
        } else {
            alert('プロジェクトに参加しました！')
            setInviteCodeInput('')
            fetchLatestData()
        }
        setIsJoining(false)
    }

    // 最新データを再取得して永続性を確保する（エラー時は既存データを保持）
    const fetchLatestData = async () => {
        try {
            const { data: projData, error: projError } = await supabase.from('projects').select('*')
            if (projError) {
                console.error('[JPBQuest] プロジェクト取得エラー:', projError.message)
            } else {
                // データが空（0件）であってもステートを更新する
                setProjects(projData || [])
            }

            const { data: taskData, error: taskError } = await supabase.from('tasks').select('*').order('order_index', { ascending: true })
            if (taskError) {
                console.error('[JPBQuest] タスク取得エラー:', taskError.message)
            } else {
                // データが空（0件）であってもステートを更新する
                setTasks(taskData || [])
            }

            // 全コメントの件数を取得してタスクIDごとに集計
            const { data: countData, error: commentError } = await supabase.from('comments').select('task_id')
            if (commentError) {
                console.error('[JPBQuest] コメント取得エラー:', commentError.message)
            } else if (countData) {
                const counts: Record<string, number> = {}
                countData.forEach(c => {
                    counts[c.task_id] = (counts[c.task_id] || 0) + 1
                })
                setCommentCounts(counts)
            }

            // アバターと表示名の取得
            try {
                const { data: profile, error: profileError } = await supabase.from('profiles').select('avatar_url, display_name').eq('id', user.id).maybeSingle()
                
                if (profileError) {
                    console.warn('[JPBQuest] プロフィール取得スキップ（未作成）:', profileError.message)
                }
                
                // プロフィールがある場合はそれを使うが、ない場合は名前からDiceBearを生成
                const currentName = profile?.display_name || user.email?.split('@')[0] || 'hero'
                setDisplayName(currentName)
                
                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url)
                } else {
                    setAvatarUrl(`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(currentName)}`)
                }

                // 全メンバーのプロフィール情報を取得して userId -> { name, avatar } のマップを作成
                const { data: allProfiles } = await supabase.from('profiles').select('id, display_name, avatar_url')
                const profileMap: Record<string, { display_name: string, avatar_url: string }> = {}
                
                if (allProfiles) {
                    allProfiles.forEach((p: any) => {
                        profileMap[p.id] = {
                            display_name: p.display_name || '冒険者',
                            avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(p.display_name || p.id)}`
                        }
                    })
                }
                
                // 自分の情報がまだmapにない場合（初回など）の補完
                if (!profileMap[user.id]) {
                    profileMap[user.id] = {
                        display_name: currentName,
                        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(currentName)}`
                    }
                }
                
                setUserProfiles(profileMap)
            } catch (e) {
                console.error('[JPBQuest] プロフィール処理エラー:', e)
            }
        } catch (e) {
            console.error('[JPBQuest] データ取得中の予期せぬエラー:', e)
        }
    }

    // 🖼️ 画像をブラウザ側で圧縮するヘルパー
    const compressImage = (file: File): Promise<Blob | File> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // 最大横幅を 1200px に制限（十分な高画質を保ちつつ容量削減）
                    const MAX_WIDTH = 1200;
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // JPEG形式、画質0.7で書き出し（劇的に軽くなります）
                    canvas.toBlob((blob) => {
                        resolve(blob || file);
                    }, 'image/jpeg', 0.7);
                };
            };
        });
    }

    // 現在のプロジェクトでの自分の権限を確認する
    const fetchMyRole = async () => {
        if (activeTab === 'all') {
            setUserRole('admin') // 全体マップでは全表示
            setActiveProject(null)
            setProjectInviteCode(null)
            setProjectMembers([])
            return
        }

        const { data: projData, error: projError } = await supabase.from('projects').select('*').eq('id', activeTab).maybeSingle()
        if (projError) {
            console.error('[JPBQuest] プロジェクト取得エラー:', projError.message)
        }
        if (projData) {
            setActiveProject(projData)
            if (projData.invite_code) {
                setProjectInviteCode(projData.invite_code)
            } else {
                const generatedCode = await ensureProjectInviteCode(activeTab, projData.invite_code)
                setProjectInviteCode(generatedCode)
            }
        }

        const { data } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', activeTab)
            .eq('user_id', user.id)
            .single()
        if (data) setUserRole(data.role)

        // プロジェクトの全メンバーを取得（軍師以上なら管理できるように）
        const { data: members } = await supabase
            .from('project_members')
            .select('user_id, role')
            .eq('project_id', activeTab)
        if (members) {
            // ここでは簡易的にメールアドレスを想定（本来は profiles と結合）
            setProjectMembers(members)
        }
    }

    useEffect(() => {
        fetchLatestData()
    }, [])

    useEffect(() => {
        fetchMyRole()
    }, [activeTab])

    const isOwner = userRole === 'owner'
    const isManager = userRole === 'owner' || userRole === 'admin' // adminを軍師として扱う

    // ユーザーIDからプロフィール情報を取得するヘルパー
    const getProfile = (userId: string) => {
        return userProfiles[userId] || {
            display_name: '冒険者',
            avatar_url: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(userId)}`
        }
    }

    // 名前（テキスト）からフォールバック用のアバターURLを取得
    const getFallbackAvatar = (name: string) => {
        // 名前が一致するプロフィールを探す
        const found = Object.values(userProfiles).find(p => p.display_name === name)
        return found?.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name)}`
    }

    const cleanCommentContent = (content: string, imageUrl?: string | null) => {
        if (!content) return ''
        let cleaned = content
        if (imageUrl) {
            cleaned = cleaned.replaceAll(imageUrl, '')
        }
        return cleaned.replace(/\n{3,}/g, '\n\n').trim()
    }

    const canDeleteComment = (comment: any) => {
        return comment.user_id === user.id || isManager
    }

    const canEditComment = (comment: any) => {
        return comment.user_id === user.id
    }

    const beginTaskTitleEdit = (task: any) => {
        setEditingTaskId(task.id)
        setEditTaskTitle(task.title || '')
    }

    const cancelTaskTitleEdit = () => {
        setEditingTaskId(null)
        setEditTaskTitle('')
    }

    const saveTaskTitle = async (taskId: string) => {
        const trimmedTitle = editTaskTitle.trim()
        if (!trimmedTitle) {
            alert('タスク名は空にできません。')
            return
        }

        const { error } = await supabase
            .from('tasks')
            .update({ title: trimmedTitle })
            .eq('id', taskId)

        if (error) {
            alert('タスク名の更新エラー: ' + error.message)
            return
        }

        setTasks((prev: any[]) => prev.map((task: any) => (
            task.id === taskId ? { ...task, title: trimmedTitle } : task
        )))
        cancelTaskTitleEdit()
    }

    const renderTaskItem = (task: any, index: number) => {
        const isProgress = task.status === 'progress';
        const isBoss = task.priority === 'boss';
        const isElite = task.priority === 'elite';
        const isEditingTaskTitle = editingTaskId === task.id;

        // Priority specific styling
        let priorityClasses = "border-b-2 border-dotted border-[#333]";
        if (isBoss) priorityClasses = "border-4 border-solid !border-[#ff3333] shadow-[0_0_40px_rgba(255,51,51,0.7)] my-8 scale-[1.02] z-10 relative bg-[#050505]";
        else if (isElite) priorityClasses = "border-4 border-solid !border-[#ffaa00] shadow-[0_0_30px_rgba(255,170,0,0.5)] my-8 scale-[1.01] z-10 relative bg-[#050505]";

        const getYouTubeEmbedUrl = (content: string) => {
            const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            const match = content.match(regExp);
            return match ? `https://www.youtube.com/embed/${match[1]}` : null;
        }

        return (
            <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided) => (
                    <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-black transition-all ${priorityClasses}`}
                    >
                        <div className={`flex items-center p-5 gap-4 transition-colors hover:bg-[#111]
                 ${isProgress ? 'border-l-8 border-l-[var(--progress-color)] bg-[rgba(255,68,68,0.05)] text-white' : 'text-[var(--muted-color)]'}`}>

                            <div {...provided.dragHandleProps} className="text-yellow-400 hover:text-yellow-200 cursor-grab active:cursor-grabbing px-2 text-4xl select-none leading-none hover:scale-110 transition-all">
                                ⠿
                            </div>

                            <div className="relative shrink-0 flex items-center">
                                <input type="checkbox" checked={false} onChange={(e) => markCompleted(task, e.target.checked)} className={`appearance-none w-6 h-6 border-2 bg-black cursor-pointer align-middle ${isProgress ? 'border-white' : 'border-[var(--muted-color)]'}`} />
                            </div>

                            <div className="grow text-lg flex items-center flex-wrap gap-4">
                                {isEditingTaskTitle ? (
                                    <div className="flex items-center gap-2 mr-2 min-w-[280px] flex-1">
                                        <input
                                            type="text"
                                            value={editTaskTitle}
                                            onChange={(e) => setEditTaskTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    saveTaskTitle(task.id)
                                                }
                                                if (e.key === 'Escape') {
                                                    cancelTaskTitleEdit()
                                                }
                                            }}
                                            autoFocus
                                            className="min-w-0 flex-1 bg-[#1a1200] border-2 border-[var(--active-color)] px-3 py-2 text-white outline-none shadow-[0_0_0_1px_rgba(255,204,0,0.2)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => saveTaskTitle(task.id)}
                                            className="shrink-0 px-3 py-2 text-xs font-bold bg-[var(--active-color)] text-black border border-yellow-200 hover:brightness-110"
                                        >
                                            保存
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelTaskTitleEdit}
                                            className="shrink-0 px-3 py-2 text-xs font-bold border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
                                        >
                                            戻す
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center mr-2 min-w-0">
                                        <span
                                            className={`cursor-pointer hover:underline decoration-[var(--active-color)] underline-offset-4 
                                                ${isBoss ? 'text-[#ff4444] font-bold text-2xl tracking-tighter' : isElite ? 'text-[#ffaa00] font-bold text-xl' : ''}`}
                                            onClick={() => toggleTaskExpansion(task.id)}
                                            title="クリックで作戦会議（コメント）を開く"
                                        >
                                            {task.title}
                                        </span>
                                    </div>
                                )}
                                <div className="flex gap-2 items-center">
                                    <div className="cursor-pointer select-none" onClick={() => toggleProgress(task)} title="クリックで進行状態を変更">
                                        {isProgress ? (
                                            <span className="text-sm px-1.5 py-0.5 border border-[var(--progress-color)] text-[var(--progress-color)] rounded inline-flex items-center gap-1 hover:bg-[var(--progress-color)] hover:text-black transition-colors">⚔️ 冒険中</span>
                                        ) : (
                                            <span className="text-sm px-1.5 py-0.5 border border-[var(--muted-color)] text-[var(--muted-color)] rounded inline-flex items-center gap-1 hover:border-[var(--muted-color)] hover:text-white transition-colors">📜 受注待ち</span>
                                        )}
                                    </div>
                                    <select
                                        value={task.priority || 'normal'}
                                        onChange={(e) => updateTaskPriority(task, e.target.value)}
                                        className="bg-transparent border border-[#444] text-[10px] text-gray-500 outline-none hover:border-gray-400 cursor-pointer"
                                    >
                                        <option value="normal">雑魚敵</option>
                                        <option value="elite">中ボス</option>
                                        <option value="boss">大ボス</option>
                                    </select>
                                </div>
                                {activeTab === 'all' && <span className="text-sm ml-2 bg-gray-800 px-2 py-0.5 rounded text-gray-300">({projects.find((p: any) => p.id === task.project_id)?.name})</span>}
                                {!isEditingTaskTitle && (
                                    <button
                                        type="button"
                                        onClick={() => beginTaskTitleEdit(task)}
                                        className="ml-auto inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold border border-[#9d7b3b] bg-[#231b0c] text-[#f2d78f] hover:bg-[#2e2411] transition-colors"
                                        title="タスク名を編集"
                                    >
                                        <span>✎</span>
                                        <span>題名変更</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="text-xs text-gray-200 bg-[#221400] border border-yellow-700 cursor-pointer flex items-center gap-1 px-2.5 py-1.5 shadow-[0_0_10px_rgba(234,179,8,0.18)] hover:bg-[#3a2400] transition-colors"
                                    onClick={() => toggleTaskExpansion(task.id)}
                                    title="作戦会議"
                                >
                                    <span>💬</span>
                                    <span>コメント</span>
                                    {commentCounts[task.id] > 0 && (
                                        <span className="bg-yellow-400 text-black px-1.5 rounded min-w-[1.6em] text-center font-bold border border-yellow-200">
                                            {commentCounts[task.id]}
                                        </span>
                                    )}
                                </button>
                                {isOwner && (
                                    <button
                                        className="text-gray-700 hover:text-red-500 text-xs p-1 border border-transparent hover:border-red-900 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                        title="クエストを破棄（大魔王のみ）"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-col items-center w-[80px] shrink-0 border-l border-white/10 ml-4 pl-4 pt-1">
                                <div className="text-[9px] text-gray-500 uppercase tracking-tighter mb-2">担当冒険者</div>
                                {isManager ? (
                                    <div className="flex flex-col items-center w-full gap-2">
                                        <div className="flex -space-x-1">
                                            {(() => {
                                                const profile = task.assignee_id ? userProfiles[task.assignee_id] : null;
                                                const avatar = profile?.avatar_url || getFallbackAvatar(task.assignee_name || 'unknown');
                                                return <img src={avatar} className="w-8 h-8 pixelated-avatar border border-black shadow-sm object-cover" />;
                                            })()}
                                        </div>
                                        <select
                                            value={task.assignee_name || ''}
                                            onChange={(e) => updateAssignee(task.id, e.target.value)}
                                            className="bg-black border border-gray-600 text-[10px] text-gray-300 outline-none w-full p-1 cursor-pointer hover:border-[var(--active-color)]"
                                        >
                                            <option value="">未定</option>
                                            {partyMembers.map((name, i) => (
                                                <option key={i} value={name as string}>{name as string}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="group/assignee flex flex-col items-center w-full">
                                        <div className="flex -space-x-1 mb-1">
                                            {(() => {
                                                const profile = task.assignee_id ? userProfiles[task.assignee_id] : null;
                                                const avatar = profile?.avatar_url || getFallbackAvatar(task.assignee_name || 'unknown');
                                                const name = profile?.display_name || task.assignee_name || '担当未定';
                                                return <img src={avatar} alt={name} className="w-8 h-8 pixelated-avatar border border-black object-cover" title={name} />;
                                            })()}
                                        </div>
                                        <span className="text-[10px] text-center text-gray-400 truncate w-full">
                                            {task.assignee_id ? (userProfiles[task.assignee_id]?.display_name || task.assignee_name || '担当未定') : (task.assignee_name || '担当未定')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 💬 作戦会議（コメント）エリア展開 */}
                        {expandedTaskId === task.id && (
                            <div className="bg-[#111] p-4 border-t border-[#333] ml-11 mr-4 mb-4 rounded-sm border-2 border-dashed border-[#555]">
                                <h4 className="text-[var(--active-color)] mb-3 text-sm flex items-center gap-2 font-bold px-2 border-l-4 border-[var(--active-color)]">
                                    <span>💬 作戦会議（指令・報告）</span>
                                </h4>

                                <div className="flex flex-col gap-4 mb-5 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                                    {comments.length === 0 ? (
                                        <div className="text-gray-500 text-sm text-center py-6 border border-dashed border-[#333]">まだ英雄たちの記録はありません。</div>
                                    ) : (
                                        comments.map((comment: any) => {
                                            const profile = getProfile(comment.user_id)
                                            const isEditing = editingCommentId === comment.id
                                            return (
                                                <div key={comment.id} className="flex gap-3 mb-2">
                                                    <img 
                                                        src={profile.avatar_url} 
                                                        alt="Avatar" 
                                                        className="w-10 h-10 pixelated-avatar shrink-0 border-2 border-[#555] object-cover" 
                                                    />
                                                    <div className="bg-black border-2 border-[#444] p-3 rounded-sm relative grow shadow-sm">
                                                        <div className="absolute top-4 -left-2.5 w-0 h-0 border-t-6 border-t-transparent border-r-10 border-r-[#444] border-b-6 border-b-transparent"></div>
                                                        <div className="flex justify-between items-baseline mb-2 border-b border-[#222] pb-1">
                                                            <span className="text-[10px] text-[var(--active-color)] uppercase tracking-widest font-bold">
                                                                {profile.display_name}
                                                            </span>
                                                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                                                <span className="text-[8px] text-gray-500">
                                                                    {new Date(comment.created_at).toLocaleString('ja-JP')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {!isEditing && cleanCommentContent(comment.content, comment.image_url) && (
                                                            <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap mb-2">
                                                                {cleanCommentContent(comment.content, comment.image_url)}
                                                            </p>
                                                        )}
                                                        {isEditing && (
                                                            <div className="mb-2">
                                                                <textarea
                                                                    value={editCommentText}
                                                                    onChange={(e) => setEditCommentText(e.target.value)}
                                                                    rows={3}
                                                                    className="w-full bg-black border border-[#666] p-2 text-white text-sm outline-none"
                                                                />
                                                                <div className="flex justify-end gap-2 mt-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingCommentId(null)
                                                                            setEditCommentText('')
                                                                        }}
                                                                        className="text-xs px-3 py-1 border border-gray-600 text-gray-400 hover:text-white"
                                                                    >
                                                                        キャンセル
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => saveEditedComment(comment.id)}
                                                                        className="text-xs px-3 py-1 border border-yellow-500 text-yellow-300 hover:bg-yellow-500 hover:text-black"
                                                                    >
                                                                        保存
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* 🖼️ 画像表示 */}
                                                        {comment.image_url && (
                                                            <div className="mt-2 mb-3 border-2 border-[#333] inline-block">
                                                                <img 
                                                                    src={comment.image_url} 
                                                                    alt="添付画像" 
                                                                    className="max-w-full max-h-[300px] object-contain cursor-zoom-in" 
                                                                    onClick={() => setZoomImageUrl(comment.image_url)}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* 📺 YouTube埋め込み */}
                                                        {(() => {
                                                            const embedUrl = getYouTubeEmbedUrl(comment.content);
                                                            if (embedUrl) {
                                                                return (
                                                                    <div className="aspect-video mt-2 border-2 border-[#333]">
                                                                        <iframe 
                                                                            width="100%" 
                                                                            height="100%" 
                                                                            src={embedUrl} 
                                                                            title="YouTube video player" 
                                                                            frameBorder="0" 
                                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                                                            allowFullScreen
                                                                        ></iframe>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {!isEditing && (canEditComment(comment) || canDeleteComment(comment)) && (
                                                            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[#2a2a2a] pt-3">
                                                                {canEditComment(comment) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingCommentId(comment.id)
                                                                            setEditCommentText(cleanCommentContent(comment.content, comment.image_url))
                                                                        }}
                                                                        className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold border border-yellow-600 bg-[#362c12] text-yellow-200 hover:bg-[#463816] transition-colors"
                                                                        title="このコメントを編集"
                                                                    >
                                                                        <span>✎</span>
                                                                        <span>編集</span>
                                                                    </button>
                                                                )}
                                                                {canDeleteComment(comment) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteComment(comment.id)}
                                                                        className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold border border-red-600 bg-[#351616] text-red-200 hover:bg-[#451c1c] transition-colors"
                                                                        title="このコメントを削除"
                                                                    >
                                                                        <span>×</span>
                                                                        <span>削除</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>

                                <form onSubmit={(e) => submitComment(e, task.id)} className="flex flex-col gap-2 mt-2 px-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="cursor-pointer flex items-center gap-1 text-[10px] text-yellow-300 hover:text-yellow-200 bg-[#2b2300] px-2 py-1 rounded border-2 border-yellow-500 shadow-[0_0_0_1px_rgba(255,204,0,0.2)]">
                                            <span>📷 写真を添付</span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={async (e) => {
                                                    if (!e.target.files?.[0]) return;
                                                    const originalFile = e.target.files[0];
                                                    
                                                    setUploading(true);
                                                    
                                                    // 1. 画像を圧縮
                                                    const compressedBlob = await compressImage(originalFile);
                                                    
                                                    // TODO: Replace with actual Xserver upload API URL
                                                    const UPLOAD_API_URL = 'https://jp-branding.com/jpb-quest/upload.php'; 
                                                    
                                                    const formData = new FormData();
                                                    // 圧縮後のBlobを送信（ファイル名は継承）
                                                    formData.append('image', compressedBlob, originalFile.name);

                                                    try {
                                                        const response = await fetch(UPLOAD_API_URL, {
                                                            method: 'POST',
                                                            body: formData
                                                        });
                                                        const result = await response.json();
                                                        
                                                        if (result.url) {
                                                            setNewCommentImageUrl(result.url);
                                                        } else {
                                                            alert('アップロード失敗: ' + (result.error || '不明なエラー'));
                                                        }
                                                    } catch (err) {
                                                        alert('通信エラー: エックスサーバーへのアップロードに失敗しました。');
                                                    } finally {
                                                        setUploading(false);
                                                    }
                                                }}
                                            />
                                        </label>
                                        <span className="text-[9px] text-gray-600 italic">※YouTubeのURLを貼ると自動で動画が表示されます</span>
                                    </div>
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="具体的な作戦や進捗をここに記せ..."
                                        rows={4}
                                        className="w-full bg-black border-2 border-[#555] p-3 text-white text-sm outline-none focus:border-[var(--active-color)] transition-all resize-none font-inherit leading-relaxed"
                                    />
                                    {newCommentImageUrl && (
                                        <div className="flex items-center justify-between text-xs border border-[#444] bg-black/70 px-3 py-2">
                                            <span className="text-gray-300 truncate">📷 画像を添付済み</span>
                                            <button
                                                type="button"
                                                onClick={() => setNewCommentImageUrl(null)}
                                                className="text-gray-400 hover:text-red-400"
                                            >
                                                削除
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex justify-end mt-1">
                                        <button
                                            type="submit"
                                            disabled={!newComment.trim() && !newCommentImageUrl}
                                            className="px-8 py-2 bg-[#222] border-2 border-[#555] text-white text-sm font-bold hover:bg-[var(--active-color)] hover:text-black hover:scale-105 transition-all shadow-[0_4px_0_#000]"
                                        >
                                            書き込む
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </li>
                )}
            </Draggable>
        );
    }

    const createProject = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newProjectName) return

        // RLS prevents us from selecting a project immediately after insert because 
        // the project_members row doesn't exist yet. So we generate the ID client-side.
        const newProjectId = crypto.randomUUID();
        const inviteCode = generateInviteCode();

        const { error } = await supabase
            .from('projects')
            .insert({ id: newProjectId, name: newProjectName, invite_code: inviteCode })

        if (!error) {
            // Insert membership so RLS allows viewing
            const { error: memError } = await supabase.from('project_members').insert({
                project_id: newProjectId,
                user_id: user.id,
                role: 'owner'
            })

            if (memError) {
                alert('メンバー追加エラー: ' + memError.message)
            } else {
                setProjects([...projects, { id: newProjectId, name: newProjectName, invite_code: inviteCode }])
                setNewProjectName('')
                router.refresh()
            }
        } else {
            alert('プロジェクト作成エラー: ' + error.message)
        }
    }

    const createTask = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTaskTitle || activeTab === 'all') return

        const newTaskId = crypto.randomUUID();

        const { error } = await supabase
            .from('tasks')
            .insert({
                id: newTaskId,
                title: newTaskTitle,
                project_id: activeTab,
                assignee_id: user.id,
                assignee_name: newTaskAssignee || displayName || user.email?.split('@')[0] || '勇者',
                priority: newTaskPriority,
                order_index: activeTasks.length // New tasks go to the end
            })

        if (!error) {
            const newTask = {
                id: newTaskId,
                title: newTaskTitle,
                project_id: activeTab,
                assignee_id: user.id,
                assignee_name: newTaskAssignee || displayName || user.email?.split('@')[0] || '勇者',
                status: 'unstarted',
                priority: newTaskPriority,
                order_index: activeTasks.length
            };
            setTasks([newTask, ...tasks])
            setNewTaskTitle('')
            setNewTaskAssignee('')
            setNewTaskPriority('normal')
        } else if (error) {
            alert('クエスト（タスク）作成エラー: ' + error.message)
        }
    }

    const updateTaskPriority = async (task: any, newPriority: string) => {
        const { error } = await supabase.from('tasks').update({ priority: newPriority }).eq('id', task.id)
        if (!error) {
            setTasks(tasks.map((t: any) => t.id === task.id ? { ...t, priority: newPriority } : t))
        }
    }

    const onDragEnd = async (result: any) => {
        if (!result.destination) return

        const items = Array.from(activeTasks)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        // Update local state immediately for snappy UI
        const newTasks = tasks.map((t: any) => {
            const indexInActive = items.findIndex((item: any) => item.id === t.id)
            if (indexInActive !== -1) {
                return { ...t, order_index: indexInActive }
            }
            return t
        })
        setTasks(newTasks)

        // Persist all changes to DB
        for (let i = 0; i < items.length; i++) {
            await supabase.from('tasks').update({ order_index: i }).eq('id', (items[i] as any).id)
        }
    }

    const updateAssignee = async (taskId: string, newValue?: string) => {
        const finalValue = newValue !== undefined ? newValue : editAssigneeValue
        const { error } = await supabase
            .from('tasks')
            .update({ assignee_name: finalValue })
            .eq('id', taskId)

        if (!error) {
            setTasks(tasks.map((t: any) => t.id === taskId ? { ...t, assignee_name: finalValue } : t))
        }
        setEditingAssigneeId(null)
    }

    const canEditMemberRole = (targetUserId: string, targetRole: string) => {
        if (activeTab === 'all') return false
        if (targetUserId === user.id) return false
        if (targetRole === 'owner') return false
        if (userRole === 'owner') return true
        if (userRole === 'admin') return targetRole === 'member'
        return false
    }

    const updateMemberRole = async (targetUserId: string, nextRole: string) => {
        if (activeTab === 'all') return
        if (!canEditMemberRole(targetUserId, projectMembers.find((m: any) => m.user_id === targetUserId)?.role || 'member')) return
        setChangingRoleUserId(targetUserId)

        const { error } = await supabase.rpc('set_project_member_role', {
            target_project_id: activeTab,
            target_user_id: targetUserId,
            new_role: nextRole
        })

        if (error) {
            alert('役職変更エラー: ' + error.message)
        } else {
            setProjectMembers((prev: any[]) => prev.map((m: any) => (
                m.user_id === targetUserId ? { ...m, role: nextRole } : m
            )))
        }

        setChangingRoleUserId(null)
    }

    const playLevelUpSound = () => {
        // レベルアップ効果音のURL（DQ風のフリー音源などを想定）
        // 一旦ブラウザで再生可能なサンプル音源を設定しますが、必要に応じて差し替え可能です。
        const audioData = "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"; // 短い成功音
        const audio = new Audio(audioData);
        audio.play().catch(e => console.log('Audio play blocked:', e));
    }

    const markCompleted = async (task: any, isCompleted: boolean) => {
        if (isCompleted) {
            // クエスト完了演出
            setIsQuestClearing(true)
            playLevelUpSound()

            // 2秒後に実際に完了処理を行う
            setTimeout(async () => {
                const newStatus = 'completed';
                const updateData: any = {
                    status: newStatus,
                    completed_at: new Date().toISOString(),
                    completed_by_user_id: user.id
                }

                const { error } = await supabase.from('tasks').update(updateData).eq('id', task.id)
                if (!error) {
                    setTasks(tasks.map((t: any) => t.id === task.id ? { ...t, status: newStatus, completed_at: updateData.completed_at, completed_by_user_id: user.id } : t))
                }
                setIsQuestClearing(false)
            }, 2500)
        } else {
            // 未完了に戻す場合
            const newStatus = 'unstarted';
            const { error } = await supabase.from('tasks').update({ status: newStatus, completed_at: null, completed_by_user_id: null }).eq('id', task.id)
            if (!error) {
                setTasks(tasks.map((t: any) => t.id === task.id ? { ...t, status: newStatus, completed_at: null, completed_by_user_id: null } : t))
            }
        }
    }

    const toggleProgress = async (task: any) => {
        if (task.status === 'completed') return;
        const newStatus = task.status === 'unstarted' ? 'progress' : 'unstarted';
        const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
        if (!error) {
            setTasks(tasks.map((t: any) => t.id === task.id ? { ...t, status: newStatus } : t))
        }
    }

    const deleteTask = async (taskId: string) => {
        if (!confirm('このクエスト（タスク）を本当に破棄しますか？\n（この操作は取り消せません）')) return

        const { error } = await supabase.from('tasks').delete().eq('id', taskId)
        if (!error) {
            setTasks(tasks.filter((t: any) => t.id !== taskId))
        } else {
            alert('削除エラー: ' + error.message)
        }
    }

    const deleteProject = async (projectId: string) => {
        if (projectId === 'all') return
        if (!isOwner) {
            alert('拠点の放棄（削除）は「大魔王（オーナー）」のみ可能です。')
            return
        }
        const project = projects.find((p: any) => p.id === projectId)
        if (!project) return

        if (!confirm(`拠点「${project.name}」を完全に放棄しますか？\nこの拠点に属する全てのクエストも消失します。\nよろしいですか？`)) return
        if (!confirm(`【最終確認】本当に "${project.name}" を消去しますか？`)) return

        const { error } = await supabase.from('projects').delete().eq('id', projectId)
        if (!error) {
            setProjects(projects.filter((p: any) => p.id !== projectId))
            setTasks(tasks.filter((t: any) => t.project_id !== projectId))
            setActiveTab('all')
        } else {
            alert('プロジェクト削除エラー: ' + error.message)
        }
    }

    const uploadAvatar = async (event: any) => {
        try {
            setUploading(true)
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('画像を選択してください。')
            }

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

            // profilesテーブルを更新（なければ作成）
            const { error: upsertError } = await supabase
                .from('profiles')
                .upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() })

            if (upsertError) throw upsertError

            setAvatarUrl(publicUrl)
            alert('プロフィール写真を変更しました！')
        } catch (error: any) {
            alert('アップロードエラー: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const toggleTaskExpansion = async (taskId: string) => {
        if (expandedTaskId === taskId) {
            setExpandedTaskId(null)
            setComments([])
            setNewCommentImageUrl(null)
            return
        }

        setExpandedTaskId(taskId)
        setNewCommentImageUrl(null)
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true })

        if (!error && data) {
            setComments(data)
        }
    }

    const submitComment = async (e: React.FormEvent, taskId: string) => {
        e.preventDefault()
        if (!newComment.trim() && !newCommentImageUrl) return

        const { data, error } = await supabase
            .from('comments')
            .insert({
                task_id: taskId,
                user_id: user.id,
                user_email: user.email,
                content: newComment,
                image_url: newCommentImageUrl || null
            })
            .select()

        if (!error && data) {
            setComments([...comments, data[0]])
            setNewComment('')
            setNewCommentImageUrl(null)
            // コメント件数を即座にカウントアップ
            setCommentCounts((prev: Record<string, number>) => ({
                ...prev,
                [taskId]: (prev[taskId] || 0) + 1
            }))
        }
    }

    const saveEditedComment = async (commentId: string) => {
        const updatedContent = editCommentText.trim()
        if (!updatedContent) {
            alert('コメント本文は空にできません。')
            return
        }

        const { error } = await supabase
            .from('comments')
            .update({ content: updatedContent })
            .eq('id', commentId)

        if (error) {
            alert('編集エラー: ' + error.message)
            return
        }

        setComments((prev: any[]) => prev.map((c: any) => (
            c.id === commentId ? { ...c, content: updatedContent } : c
        )))
        setEditingCommentId(null)
        setEditCommentText('')
    }

    const deleteComment = async (commentId: string) => {
        if (!confirm('このコメントを削除しますか？')) return

        const targetComment = comments.find((c: any) => c.id === commentId)
        const { error } = await supabase.from('comments').delete().eq('id', commentId)

        if (error) {
            alert('削除エラー: ' + error.message)
            return
        }

        setComments((prev: any[]) => prev.filter((c: any) => c.id !== commentId))
        if (expandedTaskId && targetComment?.task_id) {
            setCommentCounts((prev: Record<string, number>) => ({
                ...prev,
                [targetComment.task_id]: Math.max((prev[targetComment.task_id] || 1) - 1, 0)
            }))
        }
    }

    // タスクを未完了と完了済みに分ける
    const visibleTasks = useMemo(() => {
        const filtered = activeTab === 'all' ? tasks : tasks.filter((t: any) => t.project_id === activeTab)
        // Sort by order_index primarily
        return filtered.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
    }, [tasks, activeTab])

    const activeTasks = visibleTasks.filter((t: any) => t.status !== 'completed')
    const completedTasks = visibleTasks.filter((t: any) => t.status === 'completed')

    // ボトルネック（緊急）は priority: 'boss' かつ status: 'blocked' か status: 'progress' 的なものを想定
    const bottleneckTasks = activeTasks.filter((t: any) => t.priority === 'boss')

    // 🌟 タスク担当ドロップダウン用のメンバー名
    const partyMembers = useMemo(() => {
        if (activeTab !== 'all') {
            const names = projectMembers
                .map((m: any) => userProfiles[m.user_id]?.display_name)
                .filter(Boolean) as string[]

            const currentUserName = displayName || user.email?.split('@')[0] || '勇者'
            if (projectMembers.some((m: any) => m.user_id === user.id)) {
                names.push(currentUserName)
            }
            return Array.from(new Set(names)).sort()
        }

        // 全体マップでは、assignee_id があるタスクは最新プロフィール名を優先して使う
        const namesFromProfiles = tasks
            .map((t: any) => {
                if (!t.assignee_id) return null
                return userProfiles[t.assignee_id]?.display_name || null
            })
            .filter(Boolean) as string[]

        // assignee_id が無い古いタスクだけ従来の文字列を使う
        const legacyNames = tasks
            .filter((t: any) => !t.assignee_id)
            .flatMap((t: any) => (t.assignee_name || '').split(/[,、\s]+/).filter(Boolean))

        const currentUser = displayName || user.email?.split('@')[0] || '勇者';
        return Array.from(new Set([currentUser, ...namesFromProfiles, ...legacyNames])).sort();
    }, [activeTab, projectMembers, userProfiles, displayName, user.email, user.id, tasks]);

    const partyRoster = useMemo(() => {
        const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 }

        if (activeTab === 'all') {
            return partyMembers.map((name) => ({
                user_id: name,
                display_name: name,
                avatar_url: getFallbackAvatar(name),
                role: 'member'
            }))
        }

        return projectMembers
            .map((m: any) => {
                const profile = userProfiles[m.user_id]
                const fallbackName = m.user_id === user.id ? (displayName || user.email?.split('@')[0] || '冒険者') : '冒険者'
                const displayNameResolved = profile?.display_name || fallbackName
                return {
                    user_id: m.user_id,
                    display_name: displayNameResolved,
                    avatar_url: profile?.avatar_url || getFallbackAvatar(displayNameResolved),
                    role: m.role || 'member'
                }
            })
            .sort((a, b) => {
                const roleDiff = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
                if (roleDiff !== 0) return roleDiff
                return a.display_name.localeCompare(b.display_name, 'ja')
            })
    }, [activeTab, projectMembers, userProfiles, user.id, user.email, displayName, partyMembers])

    const getDisplayNameByUserId = (userId?: string | null) => {
        if (!userId) return '不明'
        if (userId === user.id) return displayName || user.email?.split('@')[0] || '冒険者'
        return userProfiles[userId]?.display_name || '冒険者'
    }

    return (
        <main className="py-12 min-h-screen relative max-w-4xl mx-auto px-4">
            {zoomImageUrl && (
                <div
                    className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setZoomImageUrl(null)}
                >
                    <div className="max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={zoomImageUrl}
                            alt="拡大画像"
                            className="max-w-full max-h-[90vh] object-contain border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                        />
                    </div>
                </div>
            )}

            {/* 🌟 クエスト完了演出オーバーレイ */}
            {isQuestClearing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="text-center transform animate-in zoom-in spin-in duration-700">
                        <h2 className="text-6xl md:text-8xl font-black text-yellow-400 tracking-[0.2em] mb-4"
                            style={{ textShadow: '0 0 20px #facc15, 0 0 40px #eab308, 4px 4px 0 #000' }}>
                            QUEST CLEAR!
                        </h2>
                        <p className="text-2xl text-white font-bold tracking-widest animate-pulse">
                            EXPERIENCE POINTS UP!
                        </p>
                        <div className="mt-8 flex justify-center gap-2">
                            {[...Array(5)].map((_, i) => (
                                <span key={i} className="text-4xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>⭐</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mb-10 border-b-4 border-double border-white pb-6 bg-black p-6 shadow-[0_0_0_4px_#000,0_0_0_8px_#fff] mx-4 relative overflow-hidden">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <img
                            src={avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(displayName || user.email || 'hero')}`}
                            alt="Avatar"
                            className="w-20 h-20 pixelated-avatar border-4 border-white shadow-[4px_4px_0_#444] group-hover:brightness-75 transition-all cursor-pointer object-cover"
                        />
                        <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-[10px] text-white font-bold bg-black/50 text-center p-1 leading-tight">
                            {uploading ? '⬆️...' : '📷 変更'}
                            <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                        </label>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-white uppercase tracking-wider mb-1" style={{ textShadow: '2px 2px 0 #000, 4px 4px 0 #444' }}>
                            {displayName}
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--muted-color)] uppercase tracking-tighter">LV 99 LEGENDARY HERO</span>
                            <span className="text-[10px] bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-600 font-bold uppercase tracking-widest">{userRole || 'Loading...'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <a href="/settings" className="text-gray-500 hover:text-white text-xl transition-colors" title="冒険者設定">⚙️</a>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-white underline text-sm tracking-widest uppercase transition-colors">Sign Out</button>
                </div>
            </div>

            {/* ドロップダウン用データリスト（共通） */}
            <datalist id="party-members">
                {partyMembers.map((name, i) => (
                    <option key={i} value={name as string} />
                ))}
            </datalist>

            {bottleneckTasks.length > 0 && (
                <div className="retro-window border-[var(--danger-color)] shadow-[0_0_20px_rgba(255,51,51,0.2)]">
                    <h2 className="retro-title text-[var(--danger-color)] border-[var(--danger-color)] bg-[rgba(255,51,51,0.1)]">🚨 緊急クエスト（BOSS ENCOUNTER）</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bottleneckTasks.map((task: any) => (
                            <div key={task.id} className="border-2 border-[var(--danger-color)] p-3 flex items-center gap-4 bg-[rgba(255,51,51,0.1)] cursor-pointer hover:translate-x-1 hover:bg-[rgba(255,51,51,0.2)] transition-all">
                                <img 
                                    src={getFallbackAvatar(task.assignee_name || 'unknown')} 
                                    alt="担当者" 
                                    className="w-12 h-12 pixelated-avatar object-cover" 
                                />
                                <div className="flex-grow">
                                    <div className="text-xl mb-1">{task.title}</div>
                                    <div className="text-[var(--danger-color)] text-sm">▶︎ HP: 進行停止中 (SOS!)</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">

                {/* 左カラム：メインタスクエリア（広め）*/}
                <div className="w-full lg:w-3/4 flex flex-col gap-6">
                    {/* プロジェクト作成エリア (簡易) */}
                    <div className="flex gap-2">
                        <form onSubmit={createProject} className="flex gap-2 w-full">
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="新しいプロジェクト（ギルド拠点の作成）"
                                className="bg-black border-2 border-white p-2 text-white outline-none flex-grow text-sm font-inherit placeholder:text-gray-400 focus:bg-[#111]"
                            />
                            <button type="submit" className="border-2 border-white px-4 text-sm font-bold bg-black text-white hover:bg-white hover:text-black transition-all shrink-0">設立</button>
                        </form>
                    </div>

                    <div className="retro-window">
                        {/* 選択中のプロジェクトタイトル */}
                        <div className="flex flex-col gap-4 mb-4 border-b-2 border-dashed border-[#555] pb-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl text-[var(--active-color)]">
                                    {activeTab === 'all' ? '🌐 全体マップ' : `🏰 ${projects.find((p: any) => p.id === activeTab)?.name || '不明な拠点'}`}
                                </h2>
                                <div className="flex gap-2">
                                    {activeTab !== 'all' && isOwner && (
                                        <button
                                            onClick={() => deleteProject(activeTab)}
                                            className="text-[10px] border border-red-900 text-red-900 px-2 py-1 hover:bg-red-900 hover:text-white transition-all tracking-tighter"
                                        >
                                            この拠点を完全に破壊（削除）する
                                        </button>
                                    )}
                                </div>
                            </div>

                            {activeTab !== 'all' && (
                                <div className="bg-yellow-900/10 p-4 border-2 border-dashed border-yellow-600/30 rounded-sm">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl animate-bounce">📜</span>
                                            <div>
                                                <div className="text-[10px] text-yellow-500/70 uppercase tracking-[0.2em] font-bold mb-1">Secret Invite Spell (招待の呪文)</div>
                                                <div className="text-xl text-yellow-400 font-mono font-bold select-all tracking-wider shadow-yellow-500/20 drop-shadow-sm">
                                                    {activeProject?.invite_code || projectInviteCode || '未発行'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-yellow-600/80 italic glass-panel p-2 border border-yellow-600/20 bg-black/40">
                                            この「呪文」を仲間に伝えてパーティ（拠点）に招待せよ。<br />
                                            仲間が右側の欄にこのコードを入力すれば、パーティに加わることができる。
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 特定のプロジェクト内ならタスク追加フォームを表示（軍師以上） */}
                        {activeTab !== 'all' && isManager && (
                            <form onSubmit={createTask} className="mb-10 p-6 bg-black border-4 border-white shadow-[0_0_0_4px_#000,0_0_0_8px_#fff]">
                                <div className="flex flex-col gap-5">
                                    <h3 className="text-xl border-b-2 border-dashed border-[#555] pb-3 text-white tracking-widest">📜 新規クエスト発行</h3>

                                    {/* クエスト名（縦積み&全幅） */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] text-[#aaa] uppercase tracking-[0.2em] font-bold">クエスト名</label>
                                        <input
                                            type="text"
                                            value={newTaskTitle}
                                            onChange={e => setNewTaskTitle(e.target.value)}
                                            placeholder="例: スライムを3匹倒す"
                                            className="bg-black border-4 border-white p-4 text-white outline-none text-xl font-inherit placeholder:text-gray-700 focus:bg-[#111] w-full"
                                        />
                                    </div>

                                    {/* 担当者（縦積み&全幅） */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] text-[#aaa] uppercase tracking-[0.2em] font-bold">担当者</label>
                                        <select
                                            value={newTaskAssignee}
                                            onChange={e => setNewTaskAssignee(e.target.value)}
                                            className="bg-black border-4 border-white p-4 text-white outline-none text-lg font-inherit focus:bg-[#111] w-full cursor-pointer"
                                        >
                                            <option value="">-- パーティメンバーを選択 --</option>
                                            {partyMembers.map((name, i) => (
                                                <option key={i} value={name as string}>{name as string}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 強さ選択（縦積み） */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] text-[#aaa] uppercase tracking-[0.2em] font-bold">強さ（敵ランク）</label>
                                        <select
                                            value={newTaskPriority}
                                            onChange={e => setNewTaskPriority(e.target.value)}
                                            className="bg-black border-4 border-white p-4 text-white outline-none text-lg focus:bg-[#111] w-full cursor-pointer"
                                        >
                                            <option value="normal">⚔️ 雑魚敵 — 通常タスク</option>
                                            <option value="elite">🟠 中ボス — 重要タスク</option>
                                            <option value="boss">🔴 大ボス — 最優先・緊急</option>
                                        </select>
                                    </div>

                                    {/* 送信ボタン */}
                                    <button
                                        type="submit"
                                        className="w-full bg-white text-black border-4 border-black py-5 text-2xl hover:bg-yellow-100 transition-all font-bold shadow-[0_8px_0_#888] active:translate-y-2 active:shadow-none tracking-[0.2em]"
                                    >
                                        💡 クエストを依頼する
                                    </button>
                                </div>
                            </form>
                        )}

                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="active-tasks">
                                {(provided) => (
                                    <ul
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="list-none p-0 m-0"
                                    >
                                        {activeTasks.length === 0 && <li className="text-gray-500 py-4 text-center">このエリアにアクティブなクエストはありません。</li>}

                                        {activeTab === 'all' ? (
                                            // 全体マップ時の構成：全プロジェクトを常にループ（タスクがなくても枠は残す）
                                            projects.map((project: any) => {
                                                const projectTasks = activeTasks.filter((t: any) => t.project_id === project.id);
                                                return (
                                                    <div key={project.id} className="mb-10">
                                                        <h3 className="text-sm font-bold text-gray-500 mb-3 border-l-4 border-gray-700 pl-2 uppercase tracking-widest">{project.name}</h3>
                                                        {projectTasks.length === 0 ? (
                                                            <div className="text-[10px] text-gray-600 italic ml-6 mb-4">この地域にはまだクエストが存在しない...</div>
                                                        ) : (
                                                            projectTasks.map((task: any) => {
                                                                const originalIndex = activeTasks.findIndex((t: any) => t.id === task.id);
                                                                return renderTaskItem(task, originalIndex);
                                                            })
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            activeTasks.map((task: any, index: number) => renderTaskItem(task, index))
                                        )}
                                        {provided.placeholder}
                                    </ul>
                                )}
                            </Droppable>
                        </DragDropContext>

                    </div>
                </div>

                {/* 右カラム：サイドバー */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">

                    <div className="retro-window">
                        <h3 className="text-gray-400 mb-3 text-lg border-b border-gray-600 pb-1">📜 招待の呪文を入力</h3>
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                value={inviteCodeInput}
                                onChange={(e) => setInviteCodeInput(e.target.value)}
                                placeholder="招待コード（8文字）"
                                className="bg-black border-2 border-white p-2 text-white outline-none text-xs font-mono"
                            />
                            <button
                                onClick={joinProject}
                                disabled={isJoining || inviteCodeInput.length < 8}
                                className="bg-white text-black text-xs font-bold py-2 hover:bg-yellow-400 disabled:opacity-50 transition-colors"
                            >
                                {isJoining ? '通信中...' : 'パーティに参加する'}
                            </button>
                        </div>
                    </div>

                    {/* パーティ＆プロジェクト選択 */}
                    <div className="retro-window">
                        <h3 className="text-gray-400 mb-3 text-lg border-b border-gray-600 pb-1">🗺️ ロケーション選択</h3>
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`p-3 border-2 font-inherit transition-all flex items-center gap-3 relative overflow-hidden group
                                    ${activeTab === 'all' ? 'border-white bg-[#111] scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border-gray-700 bg-black text-gray-500 hover:border-gray-400'}`}
                            >
                                {activeTab === 'all' && <span className="text-[var(--active-color)] animate-pulse absolute left-1">▶︎</span>}
                                <span className={`text-2xl ml-3 ${activeTab === 'all' ? '' : 'filter grayscale opacity-50'}`}>🌍</span>
                                <span className={`font-bold tracking-widest ${activeTab === 'all' ? 'text-white' : ''}`}>全体マップ</span>
                            </button>
                            {projects.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => setActiveTab(p.id)}
                                    className={`p-3 border-2 font-inherit transition-all flex items-center gap-3 relative overflow-hidden group
                                        ${activeTab === p.id ? 'border-white bg-[#111] scale-105 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border-gray-700 bg-black text-gray-500 hover:border-gray-400'}`}
                                >
                                    {activeTab === p.id && <span className="text-[var(--active-color)] animate-pulse absolute left-1">▶︎</span>}
                                    <span className={`text-2xl ml-3 ${activeTab === p.id ? '' : 'filter grayscale opacity-50'}`}>🏰</span>
                                    <span className={`font-bold tracking-widest ${activeTab === p.id ? 'text-white' : ''}`}>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 👥 パーティ名簿 */}
                    <div className="retro-window">
                        <h3 className="text-gray-400 mb-3 text-lg border-b border-gray-600 pb-1">👥 パーティ名簿</h3>
                        {partyRoster.length === 0 ? (
                            <div className="text-sm text-gray-500">まだ誰もいません</div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {partyRoster.map((member: any) => {
                                    const canEdit = canEditMemberRole(member.user_id, member.role)
                                    const roleLabel = member.role === 'owner' ? 'オーナー' : member.role === 'admin' ? '軍師' : 'メンバー'
                                    return (
                                    <div key={member.user_id} className="flex items-center gap-2 bg-gray-900 border border-gray-700 p-1 px-2 rounded-sm">
                                        <img 
                                            src={member.avatar_url} 
                                            alt={member.display_name} 
                                            className="w-5 h-5 pixelated-avatar border border-black object-cover" 
                                        />
                                        <span className="text-sm text-gray-300 flex-1 truncate">{member.display_name}</span>
                                        <span className="text-[10px] text-gray-400 border border-gray-600 px-1.5 py-0.5 rounded">{roleLabel}</span>
                                        {activeTab !== 'all' && isManager && (
                                            canEdit ? (
                                                <select
                                                    value={member.role}
                                                    disabled={changingRoleUserId === member.user_id}
                                                    onChange={(e) => updateMemberRole(member.user_id, e.target.value)}
                                                    className="bg-black border border-gray-600 text-[10px] text-gray-300 p-1 cursor-pointer"
                                                >
                                                    <option value="member">メンバー</option>
                                                    <option value="admin">軍師</option>
                                                </select>
                                            ) : (
                                                <span className="text-[10px] text-gray-600">{member.user_id === user.id ? '自分' : '固定'}</span>
                                            )
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>

                    {/* アーカイブ */}
                    {completedTasks.length > 0 && (
                        <div className="mt-8 border-t-2 border-dashed border-gray-600 pt-4">
                            <h3 className="text-gray-500 mb-1 text-lg">🪦 討伐完了（アーカイブ）</h3>
                            <div className="text-[10px] text-gray-600 mb-4">完了した日時と完了者を記録しています（クリックで作戦会議も表示）。</div>
                            <ul className="list-none p-0 m-0 opacity-50">
                                {completedTasks.map((task: any) => {
                                    const isEditingTaskTitle = editingTaskId === task.id;
                                    return (
                                        <li key={task.id} className="border-b border-gray-800 transition-colors hover:bg-[var(--hover-bg)]">
                                            <div className="flex items-center p-3 gap-4">
                                                <div className="relative shrink-0 flex items-center">
                                                    <input type="checkbox" checked={true} onChange={(e) => markCompleted(task, e.target.checked)} className="appearance-none w-6 h-6 border-2 border-gray-600 bg-black cursor-pointer align-middle" />
                                                    <span className="absolute top-[-4px] left-[2px] text-xl text-gray-400 pointer-events-none">✔</span>
                                                </div>
                                                 <div className="grow text-lg text-gray-500 line-through flex items-center flex-wrap gap-2">
                                                    {isEditingTaskTitle ? (
                                                        <div
                                                            className="flex items-center gap-2 min-w-[280px] flex-1"
                                                            style={{ textDecoration: 'none' }}
                                                        >
                                                            <input
                                                                type="text"
                                                                value={editTaskTitle}
                                                                onChange={(e) => setEditTaskTitle(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        saveTaskTitle(task.id)
                                                                    }
                                                                    if (e.key === 'Escape') {
                                                                        cancelTaskTitleEdit()
                                                                    }
                                                                }}
                                                                autoFocus
                                                                className="min-w-0 flex-1 bg-[#1a1200] border border-[var(--active-color)] px-3 py-2 text-white outline-none"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => saveTaskTitle(task.id)}
                                                                className="shrink-0 px-3 py-2 text-xs font-bold bg-[var(--active-color)] text-black border border-yellow-200 hover:brightness-110"
                                                            >
                                                                保存
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelTaskTitleEdit}
                                                                className="shrink-0 px-3 py-2 text-xs font-bold border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
                                                            >
                                                                戻す
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span
                                                                className="cursor-pointer hover:underline decoration-gray-500 underline-offset-4"
                                                                onClick={() => toggleTaskExpansion(task.id)}
                                                            >
                                                                {task.title}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => beginTaskTitleEdit(task)}
                                                                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold border border-[#9d7b3b] bg-[#231b0c] text-[#f2d78f] hover:bg-[#2e2411] transition-colors no-underline"
                                                                style={{ textDecoration: 'none' }}
                                                            >
                                                                <span>✎</span>
                                                                <span>題名変更</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {task.completed_at && (
                                                        <span className="text-xs text-gray-600 no-underline bg-gray-900 px-2 py-1 rounded">
                                                            完了: {new Date(task.completed_at).toLocaleString('ja-JP')}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-600 no-underline bg-gray-900 px-2 py-1 rounded">
                                                        完了者: {getDisplayNameByUserId(task.completed_by_user_id)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1 shrink-0 justify-end w-[80px]">
                                                    {(() => {
                                                        const profile = task.assignee_id ? userProfiles[task.assignee_id] : null;
                                                        const avatar = profile?.avatar_url || getFallbackAvatar(task.assignee_name || 'unknown');
                                                        const name = profile?.display_name || task.assignee_name || '担当未定';
                                                        return (
                                                            <>
                                                                <img src={avatar} alt={name} className="w-6 h-6 pixelated-avatar grayscale border border-gray-800 object-cover" title={name} />
                                                                <span className="text-[9px] text-gray-700 truncate w-full text-center">
                                                                    {name}
                                                                </span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* 💬 作戦会議（コメント）エリア展開 - アーカイブ版 */}
                                            {expandedTaskId === task.id && (
                                                <div className="bg-[#111] p-3 border-t border-[#222] ml-9 mr-3 mb-3 rounded-sm border border-dashed border-[#444] opacity-80">
                                                    <h4 className="text-gray-500 mb-2 text-xs flex items-center gap-2">
                                                        <span>💬 作戦会議（過去の記録）</span>
                                                    </h4>

                                                    <div className="flex flex-col gap-2 mb-3 max-h-[200px] overflow-y-auto pr-2">
                                                        {comments.length === 0 ? (
                                                            <div className="text-gray-600 text-[10px] text-center py-1">記録はありません。</div>
                                                        ) : (
                                                            comments.map((comment: any) => (
                                                                <div key={comment.id} className="flex gap-2">
                                                                    <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(comment.user_email)}`} alt="Avatar" className="w-6 h-6 pixelated-avatar shrink-0 border border-[#444] grayscale" />
                                                                    <div className="bg-black border border-[#333] p-1.5 rounded-sm relative grow">
                                                                        <div className="absolute top-2 -left-1.5 w-0 h-0 border-t-[3px] border-t-transparent border-r-[6px] border-r-[#333] border-b-[3px] border-b-transparent"></div>
                                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                                            <span className="text-[10px] text-gray-500">{comment.user_email?.split('@')[0]}</span>
                                                                            <span className="text-[8px] text-gray-700">
                                                                                {new Date(comment.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                                                                            {cleanCommentContent(comment.content, comment.image_url)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    <form onSubmit={(e) => submitComment(e, task.id)} className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newComment}
                                                            onChange={(e) => setNewComment(e.target.value)}
                                                            placeholder="追記する..."
                                                            className="grow bg-black border border-[#444] p-1.5 text-gray-400 text-xs outline-none focus:border-gray-500 transition-colors"
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={!newComment.trim()}
                                                            className="px-3 bg-black border border-[#444] text-gray-400 text-xs hover:bg-[#222] hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            追記
                                                        </button>
                                                    </form>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

        </main>
    )
}
