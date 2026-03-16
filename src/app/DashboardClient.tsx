'use client'

import { useState, useMemo, useEffect, useRef, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import PixelAvatar from '@/components/PixelAvatar'

const COMMENT_IMAGE_BUCKET = 'comment-images'
const PULL_REFRESH_THRESHOLD = 84

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
    const [editTaskDueDate, setEditTaskDueDate] = useState('')
    const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false)
    const [newTaskPriority, setNewTaskPriority] = useState('normal') // normal, elite, boss
    const [newTaskDueDate, setNewTaskDueDate] = useState('')
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
    const [allProjectMembers, setAllProjectMembers] = useState<any[]>([])
    const [isQuestClearing, setIsQuestClearing] = useState(false)
    const [userProfiles, setUserProfiles] = useState<Record<string, { display_name: string, avatar_url: string }>>({})
    const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null)
    const [dragDestination, setDragDestination] = useState<{ droppableId: string, index: number } | null>(null)
    const [isPushSupported, setIsPushSupported] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [subscriptionLoading, setSubscriptionLoading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [pullDistance, setPullDistance] = useState(0)
    const dueDateInputRef = useRef<HTMLInputElement | null>(null)
    const pullStartYRef = useRef<number | null>(null)
    const pullDistanceRef = useRef(0)
    const isPullingRef = useRef(false)
    const refreshInFlightRef = useRef(false)
    const realtimeRefreshTimeoutRef = useRef<number | null>(null)
    const pendingCommentReloadRef = useRef(false)
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

    if (!supabaseRef.current) {
        supabaseRef.current = createClient()
    }

    const supabase = supabaseRef.current
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
            const { projects: refreshedProjects } = await fetchLatestData()
            const joinedProject = refreshedProjects.find((project: any) => (project.invite_code || '').trim().toLowerCase() === normalizedCode)
            if (joinedProject) {
                setActiveTab(joinedProject.id)
            }
            router.refresh()
        }
        setIsJoining(false)
    }

    // 最新データを再取得して永続性を確保する（エラー時は既存データを保持）
    const fetchLatestData = async () => {
        let projectList: any[] = []
        try {
            const { data: projData, error: projError } = await supabase.from('projects').select('*')
            if (projError) {
                console.error('[JPBQuest] プロジェクト取得エラー:', projError.message)
            } else {
                // データが空（0件）であってもステートを更新する
                setProjects(projData || [])
                projectList = projData || []
            }

            const { data: taskData, error: taskError } = await supabase.from('tasks').select('*').order('order_index', { ascending: true })
            if (taskError) {
                console.error('[JPBQuest] タスク取得エラー:', taskError.message)
            } else {
                // データが空（0件）であってもステートを更新する
                setTasks(taskData || [])
            }

            const { data: memberData, error: memberError } = await supabase
                .from('project_members')
                .select('project_id, user_id, role')
            if (memberError) {
                console.error('[JPBQuest] メンバー取得エラー:', memberError.message)
            } else {
                const safeMembers = memberData || []
                setAllProjectMembers(safeMembers)
                if (activeTab !== 'all') {
                    setProjectMembers(safeMembers.filter((member: any) => member.project_id === activeTab))
                }
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
                
                const currentName = profile?.display_name || user.email?.split('@')[0] || 'hero'
                setDisplayName(currentName)
                
                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url)
                } else {
                    setAvatarUrl(`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(currentName)}`)
                }

                // 🔔 通知のサポートチェックと登録確認
                try {
                    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
                        setIsPushSupported(true);
                        const registration = await navigator.serviceWorker.register('/service-worker.js');
                        const subscription = await registration.pushManager.getSubscription();
                        setIsSubscribed(!!subscription);
                    }
                } catch (err) {
                    console.error('[JPBQuest] SW初期チェックエラー:', err);
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
        return { projects: projectList }
    }

    const refreshDashboardData = async () => {
        if (refreshInFlightRef.current) return

        refreshInFlightRef.current = true
        setIsRefreshing(true)

        try {
            await fetchLatestData()
            if (activeTab !== 'all') {
                await fetchMyRole()
            }
            router.refresh()
        } finally {
            refreshInFlightRef.current = false
            setIsRefreshing(false)
            setPullDistance(0)
            pullDistanceRef.current = 0
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

    const uploadCommentImage = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        setUploading(true)

        try {
            const compressedBlob = await compressImage(selectedFile)
            const blobType = compressedBlob.type || selectedFile.type || 'image/jpeg'
            const extension = blobType === 'image/png' ? 'png' : 'jpg'
            const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-')
            const filePath = `${user.id}/${baseName || 'comment-image'}-${crypto.randomUUID()}.${extension}`

            const { error: uploadError } = await supabase.storage
                .from(COMMENT_IMAGE_BUCKET)
                .upload(filePath, compressedBlob, {
                    contentType: blobType,
                    upsert: false
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from(COMMENT_IMAGE_BUCKET)
                .getPublicUrl(filePath)

            setNewCommentImageUrl(publicUrl)
        } catch (error: any) {
            if (error.message?.includes('Bucket not found')) {
                alert('【要設定】Supabaseで comment-images バケットを作成し、add_comment_image_storage.sql を実行してください。')
            } else {
                alert('画像アップロード失敗: ' + error.message)
            }
        } finally {
            setUploading(false)
            event.target.value = ''
        }
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

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPush = async () => {
        if (subscriptionLoading) return;
        setSubscriptionLoading(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('通知が許可されませんでした。設定から許可してください。');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (!publicKey) {
                throw new Error('VAPID Public Key not found in .env');
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            const { error } = await supabase.from('push_subscriptions').upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
                auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!)))),
                updated_at: new Date().toISOString()
            });

            if (error) throw error;

            setIsSubscribed(true);
            alert('通知の受信設定が完了しました！これで離れていても連絡が届きます。');
        } catch (err: any) {
            console.error('[JPBQuest] 購読エラー:', err);
            alert('通知登録に失敗しました: ' + err.message);
        } finally {
            setSubscriptionLoading(false);
        }
    };

    useEffect(() => {
        fetchMyRole()
    }, [activeTab])

    useEffect(() => {
        if (activeTab === 'all') return
        if (projects.some((project: any) => project.id === activeTab)) return

        setActiveTab('all')
        setActiveProject(null)
        setProjectInviteCode(null)
        setProjectMembers([])
    }, [activeTab, projects])

    useEffect(() => {
        const scheduleRealtimeSync = (shouldReloadComments = false) => {
            if (shouldReloadComments) {
                pendingCommentReloadRef.current = true
            }

            if (realtimeRefreshTimeoutRef.current !== null) {
                window.clearTimeout(realtimeRefreshTimeoutRef.current)
            }

            realtimeRefreshTimeoutRef.current = window.setTimeout(async () => {
                realtimeRefreshTimeoutRef.current = null
                const reloadExpandedComments = pendingCommentReloadRef.current
                pendingCommentReloadRef.current = false

                await fetchLatestData()

                if (activeTab !== 'all') {
                    await fetchMyRole()
                }

                if (reloadExpandedComments && expandedTaskId) {
                    await loadCommentsForTask(expandedTaskId)
                }
            }, 180)
        }

        const realtimeChannel = supabase
            .channel(`dashboard-realtime-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                scheduleRealtimeSync()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                scheduleRealtimeSync()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => {
                scheduleRealtimeSync()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                scheduleRealtimeSync()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload: any) => {
                const changedTaskId = payload.new?.task_id || payload.old?.task_id
                scheduleRealtimeSync(changedTaskId === expandedTaskId)
            })
            .subscribe()

        return () => {
            if (realtimeRefreshTimeoutRef.current !== null) {
                window.clearTimeout(realtimeRefreshTimeoutRef.current)
                realtimeRefreshTimeoutRef.current = null
            }
            pendingCommentReloadRef.current = false
            void supabase.removeChannel(realtimeChannel)
        }
    }, [activeTab, expandedTaskId, supabase, user.id])

    useEffect(() => {
        const touchOptions: AddEventListenerOptions = { passive: false }

        const handleTouchStart = (event: Event) => {
            const touchEvent = event as TouchEvent
            if (touchEvent.touches.length !== 1) return
            if (window.scrollY > 0 || refreshInFlightRef.current) return
            const target = touchEvent.target as HTMLElement | null
            if (target?.closest('input, textarea, select, button')) return

            pullStartYRef.current = touchEvent.touches[0]?.clientY ?? null
            isPullingRef.current = true
        }

        const handleTouchMove = (event: Event) => {
            const touchEvent = event as TouchEvent
            if (!isPullingRef.current || pullStartYRef.current === null) return

            if (window.scrollY > 0) {
                isPullingRef.current = false
                pullStartYRef.current = null
                pullDistanceRef.current = 0
                setPullDistance(0)
                return
            }

            const currentY = touchEvent.touches[0]?.clientY ?? pullStartYRef.current
            const delta = currentY - pullStartYRef.current

            if (delta <= 0) {
                pullDistanceRef.current = 0
                setPullDistance(0)
                return
            }

            const nextDistance = Math.min(delta * 0.55, 120)
            pullDistanceRef.current = nextDistance
            setPullDistance(nextDistance)

            if (touchEvent.cancelable) {
                touchEvent.preventDefault()
            }
        }

        const finishPullGesture = () => {
            const shouldRefresh = pullDistanceRef.current >= PULL_REFRESH_THRESHOLD
            pullStartYRef.current = null
            isPullingRef.current = false

            if (shouldRefresh) {
                void refreshDashboardData()
                return
            }

            pullDistanceRef.current = 0
            setPullDistance(0)
        }

        window.addEventListener('touchstart', handleTouchStart, touchOptions)
        window.addEventListener('touchmove', handleTouchMove, touchOptions)
        window.addEventListener('touchend', finishPullGesture)
        window.addEventListener('touchcancel', finishPullGesture)

        return () => {
            window.removeEventListener('touchstart', handleTouchStart, touchOptions)
            window.removeEventListener('touchmove', handleTouchMove, touchOptions)
            window.removeEventListener('touchend', finishPullGesture)
            window.removeEventListener('touchcancel', finishPullGesture)
        }
    }, [activeTab])

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!expandedTaskId) return
            const target = event.target as HTMLElement | null
            if (!target) return
            if (target.closest('[data-comment-panel]') || target.closest('[data-comment-trigger]')) return
            setExpandedTaskId(null)
            setComments([])
            setNewCommentImageUrl(null)
        }

        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [expandedTaskId])

    useEffect(() => {
        if (!isDueDatePickerOpen) return

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            if (!target) return
            if (target.closest('[data-due-picker]') || target.closest('[data-due-trigger]')) return
            setIsDueDatePickerOpen(false)
        }

        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [isDueDatePickerOpen])

    useEffect(() => {
        if (!editingTaskId) return

        const handleOutsideEditClick = (event: Event) => {
            const target = event.target as HTMLElement | null
            if (!target) return
            if (target.closest('[data-task-edit-panel]') || target.closest('[data-task-edit-trigger]')) return

            // 外側を押したら「戻す」と同じ挙動で編集前の状態に戻す
            setEditingTaskId(null)
            setEditTaskTitle('')
            setEditTaskDueDate('')
            setIsDueDatePickerOpen(false)
        }

        // iOS Safari 含め確実に拾うため、キャプチャ段階で複数イベントを監視
        document.addEventListener('pointerdown', handleOutsideEditClick, true)
        document.addEventListener('mousedown', handleOutsideEditClick, true)
        document.addEventListener('touchstart', handleOutsideEditClick, true)
        return () => {
            document.removeEventListener('pointerdown', handleOutsideEditClick, true)
            document.removeEventListener('mousedown', handleOutsideEditClick, true)
            document.removeEventListener('touchstart', handleOutsideEditClick, true)
        }
    }, [editingTaskId])

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

    const normalizeAssigneeName = (value?: string | null) => (value || '').trim().toLowerCase()

    const isUnassignedAssignee = (assigneeId?: string | null, assigneeName?: string | null) => {
        const normalized = normalizeAssigneeName(assigneeName)
        if (normalized === '') return true
        if (normalized === '未定' || normalized === '担当未定' || normalized === 'unknown' || normalized === 'unassigned' || normalized === 'none' || normalized === '?') {
            return true
        }
        return false
    }

    // 担当者のアバターを取得する共通ヘルパー
    const getAssigneeAvatar = (assigneeId?: string | null, assigneeName?: string | null) => {
        if (isUnassignedAssignee(assigneeId, assigneeName)) {
            // 未定用のピクセルアート（目も口もないグレーのシルエット）
            return "https://api.dicebear.com/7.x/pixel-art/svg?seed=none&backgroundColor=333333&eyes=none&mouth=none";
        }

        if (assigneeId && userProfiles[assigneeId]) {
            return userProfiles[assigneeId].avatar_url;
        }

        const name = assigneeName || 'unknown'
        return getFallbackAvatar(name);
    }

    const isUnassignedTask = (task: any) => {
        return isUnassignedAssignee(task.assignee_id, task.assignee_name)
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
        setEditTaskDueDate(formatDateTimeForInput(task.due_date))
        setIsDueDatePickerOpen(false)
    }

    const cancelTaskTitleEdit = () => {
        setEditingTaskId(null)
        setEditTaskTitle('')
        setEditTaskDueDate('')
        setIsDueDatePickerOpen(false)
    }

    const closeExpandedComments = () => {
        setExpandedTaskId(null)
        setComments([])
        setNewCommentImageUrl(null)
    }

    const scrollToTask = (taskId: string, projectId: string) => {
        // プロジェクトタブを切り替え（全表示の場合はそのまま）
        if (activeTab !== 'all' && activeTab !== projectId) {
            setActiveTab(projectId)
        }
        
        // DOMの更新を待ってからスクロール
        setTimeout(() => {
            const element = document.getElementById(`task-${taskId}`)
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                // スクロール後に2回だけ点滅して、対象タスクを明確に示す
                const blink = () => {
                    element.style.outline = '4px solid transparent'
                    element.style.outlineOffset = '2px'

                    if (typeof element.animate === 'function') {
                        const animation = element.animate(
                            [
                                { outlineColor: 'rgba(255,255,255,0)', boxShadow: '0 0 0 rgba(0,0,0,0)' },
                                { outlineColor: 'rgba(255,255,255,1)', boxShadow: '0 0 0 2px rgba(255,255,255,0.35), 0 0 18px rgba(255,255,255,0.7)' },
                                { outlineColor: 'rgba(255,255,255,0)', boxShadow: '0 0 0 rgba(0,0,0,0)' }
                            ],
                            { duration: 360, iterations: 2, easing: 'ease-in-out' }
                        )
                        animation.onfinish = () => {
                            element.style.outline = 'none'
                            element.style.boxShadow = ''
                        }
                    } else {
                        let count = 0
                        const turnOn = () => {
                            element.style.outline = '4px solid var(--active-color)'
                            element.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.35), 0 0 18px rgba(255,255,255,0.7)'
                        }
                        const turnOff = () => {
                            element.style.outline = 'none'
                            element.style.boxShadow = ''
                        }
                        const pulse = () => {
                            turnOn()
                            setTimeout(() => {
                                turnOff()
                                count += 1
                                if (count < 2) {
                                    setTimeout(pulse, 90)
                                }
                            }, 170)
                        }
                        pulse()
                    }
                }

                setTimeout(blink, 420)
            }
        }, 300)
    }

    const formatDateTimeForInput = (value?: string | null) => {
        if (!value) return ''
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        const pad = (n: number) => String(n).padStart(2, '0')
        const yyyy = date.getFullYear()
        const mm = pad(date.getMonth() + 1)
        const dd = pad(date.getDate())
        const hh = pad(date.getHours())
        const mi = pad(date.getMinutes())
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
    }

    const openDueDatePicker = () => {
        setIsDueDatePickerOpen(true)
        setTimeout(() => {
            const input = dueDateInputRef.current
            if (!input) return
            input.focus()
            try {
                ;(input as any).showPicker?.()
            } catch (_) {
                // iOS Safari など showPicker 未対応ブラウザ向け
            }
        }, 0)
    }

    const saveTaskTitle = async (taskId: string) => {
        const trimmedTitle = editTaskTitle.trim()
        if (!trimmedTitle) {
            alert('タスク名は空にできません。')
            return
        }

        let dueDateIso: string | null = null
        if (editTaskDueDate) {
            const parsed = new Date(editTaskDueDate)
            if (Number.isNaN(parsed.getTime())) {
                alert('期限日時の形式が不正です。')
                return
            }
            dueDateIso = parsed.toISOString()
        }

        const { error } = await supabase
            .from('tasks')
            .update({ title: trimmedTitle, due_date: dueDateIso })
            .eq('id', taskId)

        if (error) {
            alert('タスク更新エラー: ' + error.message)
            return
        }

        setTasks((prev: any[]) => prev.map((task: any) => (
            task.id === taskId ? { ...task, title: trimmedTitle, due_date: dueDateIso } : task
        )))
        cancelTaskTitleEdit()
    }

    const renderTaskItem = (task: any, index: number, droppableId: string) => {
        const isProgress = task.status === 'progress';
        const isBoss = task.priority === 'boss';
        const isElite = task.priority === 'elite';
        const isEditingTaskTitle = editingTaskId === task.id;
        const isDropTarget = dragDestination?.droppableId === droppableId && dragDestination.index === index;

        // 期限の状態判定
        const now = new Date();
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate && dueDate < now && task.status !== 'completed';
        const isNearDeadline = dueDate && !isOverdue && (dueDate.getTime() - now.getTime()) < 24 * 60 * 60 * 1000 && task.status !== 'completed';
        const dueDateBadgeClass = isOverdue
            ? 'border-red-400 text-red-200 bg-red-950/70 shadow-[0_0_10px_rgba(239,68,68,0.45)] animate-pulse'
            : isNearDeadline
                ? 'border-orange-400 text-orange-100 bg-orange-950/65 shadow-[0_0_10px_rgba(251,146,60,0.38)]'
                : 'border-sky-400 text-sky-100 bg-[#071423] shadow-[0_0_8px_rgba(56,189,248,0.28)]'
        const prioritySelectToneClass = isBoss
            ? 'bg-[#2b0808] border-red-500 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.35)]'
            : isElite
                ? 'bg-[#2b1a05] border-amber-500 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-[#111] border-gray-600 text-gray-200'

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
                {(provided, snapshot) => (
                    <li
                        id={`task-${task.id}`}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-black transition-all relative ${priorityClasses} ${isOverdue ? 'animate-pulse border-red-600 shadow-[0_0_20px_rgba(255,0,0,0.4)]' : ''}
                            ${snapshot.isDragging ? 'ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.45)] z-20' : ''}`}
                    >
                        {isDropTarget && (
                            <div className="absolute top-0 left-2 right-2 h-[2px] bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] pointer-events-none" />
                        )}
                        <div className={`flex items-start md:items-center p-2.5 md:py-3 md:px-4 gap-2 md:gap-3 transition-colors hover:bg-[#111]
                 ${isProgress ? 'border-l-8 border-l-[var(--progress-color)] bg-[rgba(255,68,68,0.05)] text-white' : 'text-[var(--muted-color)]'}
                 ${isOverdue ? 'bg-red-950/20' : isNearDeadline ? 'bg-orange-950/10' : ''}`}>

                            <div {...provided.dragHandleProps} className="text-yellow-400 hover:text-yellow-200 cursor-grab active:cursor-grabbing px-1 md:px-1.5 text-2xl md:text-3xl select-none leading-none hover:scale-110 transition-all mt-0.5 md:mt-0">
                                ⠿
                            </div>

                            <div className="relative shrink-0 flex items-center">
                                <input type="checkbox" checked={false} onChange={(e) => markCompleted(task, e.target.checked)} className={`appearance-none w-5 h-5 md:w-5 md:h-5 border-2 bg-black cursor-pointer align-middle ${isProgress ? 'border-white' : 'border-[var(--muted-color)]'}`} />
                            </div>

                            <div className="grow text-sm md:text-base flex items-center flex-wrap gap-1.5 md:gap-2.5 min-w-0">
                                {isEditingTaskTitle ? (
                                    <div data-task-edit-panel="true" className="relative flex items-center flex-wrap gap-1.5 md:gap-2 mr-1 md:mr-1.5 min-w-[200px] md:min-w-[240px] flex-1">
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
                                            className="min-w-0 flex-1 basis-full md:basis-auto bg-[#1a1200] border-2 border-[var(--active-color)] px-2 py-1.5 md:px-2.5 md:py-1.5 text-sm md:text-sm text-white outline-none shadow-[0_0_0_1px_rgba(255,204,0,0.2)]"
                                        />
                                        <button
                                            type="button"
                                            data-due-trigger="true"
                                            onClick={openDueDatePicker}
                                            className="shrink-0 px-2 py-1.5 md:px-2.5 md:py-1.5 text-[10px] md:text-[10px] font-bold border border-sky-700 text-sky-200 bg-[#071622] hover:bg-[#0b2234] transition-colors"
                                            title="期限カレンダーを開く"
                                        >
                                            📅 期限
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => saveTaskTitle(task.id)}
                                            className="shrink-0 px-2 py-1.5 md:px-2.5 md:py-1.5 text-[10px] md:text-[10px] font-bold bg-[var(--active-color)] text-black border border-yellow-200 hover:brightness-110"
                                        >
                                            保存
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelTaskTitleEdit}
                                            className="shrink-0 px-2 py-1.5 md:px-2.5 md:py-1.5 text-[10px] md:text-[10px] font-bold border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
                                        >
                                            戻す
                                        </button>
                                        {isDueDatePickerOpen && (
                                            <div
                                                data-due-picker="true"
                                                className="absolute z-40 right-0 top-full mt-1 w-[min(300px,88vw)] bg-black border-2 border-sky-700 p-2 shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
                                            >
                                                <div className="text-[10px] text-sky-200 mb-1">期限を設定</div>
                                                <input
                                                    ref={dueDateInputRef}
                                                    type="datetime-local"
                                                    value={editTaskDueDate}
                                                    onChange={(e) => setEditTaskDueDate(e.target.value)}
                                                    className="w-full bg-black border border-gray-500 px-2 py-1.5 text-xs text-gray-100 outline-none"
                                                    style={{ colorScheme: 'dark' }}
                                                />
                                                <div className="mt-2 flex items-center justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditTaskDueDate('')
                                                            setIsDueDatePickerOpen(false)
                                                        }}
                                                        className="text-[10px] px-2 py-1 border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
                                                    >
                                                        期限なし
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDueDatePickerOpen(false)}
                                                        className="text-[10px] px-2 py-1 border border-sky-700 text-sky-200 hover:bg-[#0b2234]"
                                                    >
                                                        閉じる
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center mr-1 md:mr-2 min-w-0">
                                        <span
                                            className={`cursor-pointer hover:underline decoration-[var(--active-color)] underline-offset-4 break-words
                                                ${isBoss ? 'text-[#ff4444] font-bold text-lg md:text-xl tracking-tight md:tracking-tighter' : isElite ? 'text-[#ffaa00] font-bold text-base md:text-lg' : ''}`}
                                            onClick={closeExpandedComments}
                                            title="開いている作戦会議を閉じる"
                                        >
                                            {task.title}
                                        </span>
                                    </div>
                                )}
                                <div className="flex gap-1.5 md:gap-2 items-center flex-wrap">
                                    {dueDate && (
                                        <div className={`text-[10px] md:text-xs px-2 md:px-2.5 py-1 md:py-1 border font-bold flex items-center gap-1 rounded-sm
                                            ${dueDateBadgeClass}`}>
                                            {isOverdue ? '💀 逃走中 (OVERDUE)' : isNearDeadline ? '⏳ 逃走間近 (NEAR)' : '📅 期限'}
                                            : {dueDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                    <div className="cursor-pointer select-none" onClick={() => toggleProgress(task)} title="クリックで進行状態を変更">
                                        {isProgress ? (
                                            <span className="text-xs md:text-xs px-1 md:px-1.5 py-0.5 border border-[var(--progress-color)] text-[var(--progress-color)] rounded inline-flex items-center gap-1 hover:bg-[var(--progress-color)] hover:text-black transition-colors">⚔️ 冒険中</span>
                                        ) : (
                                            <span className="text-xs md:text-xs px-1 md:px-1.5 py-0.5 border border-[var(--muted-color)] text-[var(--muted-color)] rounded inline-flex items-center gap-1 hover:border-[var(--muted-color)] hover:text-white transition-colors">📜 受注待ち</span>
                                        )}
                                    </div>
                                    <select
                                        value={task.priority || 'normal'}
                                        onChange={(e) => updateTaskPriority(task, e.target.value)}
                                        className={`border text-[10px] md:text-[11px] px-1.5 py-1 rounded-sm outline-none cursor-pointer transition-colors
                                            ${prioritySelectToneClass}`}
                                    >
                                        <option value="normal">雑魚敵</option>
                                        <option value="elite">中ボス</option>
                                        <option value="boss">大ボス</option>
                                    </select>
                                </div>
                                {activeTab === 'all' && <span className="text-xs md:text-sm ml-1 md:ml-2 bg-gray-800 px-1.5 md:px-2 py-0.5 rounded text-gray-300">({projects.find((p: any) => p.id === task.project_id)?.name})</span>}
                                <div className="ml-auto shrink-0 flex items-center gap-1.5">
                                    {!isEditingTaskTitle && (
                                        <button
                                            type="button"
                                            data-task-edit-trigger="true"
                                            onClick={() => beginTaskTitleEdit(task)}
                                            className="inline-flex items-center gap-1 rounded-sm px-1.5 md:px-2 py-1 text-[9px] md:text-[10px] font-bold border border-[#9d7b3b] bg-[#231b0c] text-[#f2d78f] hover:bg-[#2e2411] transition-colors whitespace-nowrap"
                                            title="タスク名・期限を編集"
                                        >
                                            <span>✎</span>
                                            <span className="md:hidden">編集</span>
                                            <span className="hidden md:inline">題名・期限</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        data-comment-trigger="true"
                                        className="text-[10px] md:text-[11px] text-gray-200 bg-[#221400] border border-yellow-700 cursor-pointer inline-flex items-center gap-1 px-2 md:px-2 py-1 md:py-1 shadow-[0_0_10px_rgba(234,179,8,0.18)] hover:bg-[#3a2400] transition-colors whitespace-nowrap"
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
                            </div>

                                <div className="flex flex-col items-center w-[64px] md:w-[72px] shrink-0 border-l border-white/10 ml-1 md:ml-3 pl-2 md:pl-3 pt-0.5 md:pt-0">
                                <div className="text-[9px] text-gray-500 uppercase tracking-tighter mb-1 md:hidden">担当冒険者</div>
                                {isManager ? (
                                    <div className="flex flex-col items-center w-full gap-1 md:gap-1">
                                        <div className="flex -space-x-1">
                                            {isUnassignedTask(task) ? (
                                                <div className="w-7 h-7 md:w-7 md:h-7 flex items-center justify-center border border-gray-500 bg-[#1b1b1b] text-gray-300 text-base md:text-base font-bold leading-none">
                                                    ?
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 md:w-7 md:h-7 border border-black shadow-sm overflow-hidden">
                                                    <img
                                                        src={getAssigneeAvatar(task.assignee_id, task.assignee_name)}
                                                        className="w-full h-full pixelated-avatar-tiny object-cover"
                                                        style={{ transform: 'scale(1.22)' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <select
                                            value={isUnassignedTask(task) ? '' : (task.assignee_name || '')}
                                            onChange={(e) => updateAssignee(task.id, e.target.value)}
                                            className="bg-black border border-gray-600 text-[9px] md:text-[9px] text-gray-300 outline-none w-full p-1 md:p-0.5 cursor-pointer hover:border-[var(--active-color)]"
                                        >
                                            <option value="">未定</option>
                                            {partyMembers.map((name, i) => (
                                                <option key={i} value={name as string}>{name as string}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="group/assignee flex flex-col items-center w-full">
                                        <div className="flex -space-x-1 mb-0.5">
                                            {isUnassignedTask(task) ? (
                                                <div className="w-7 h-7 md:w-7 md:h-7 flex items-center justify-center border border-gray-500 bg-[#1b1b1b] text-gray-300 text-base md:text-base font-bold leading-none">
                                                    ?
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 md:w-7 md:h-7 border border-black overflow-hidden">
                                                    <img
                                                        src={getAssigneeAvatar(task.assignee_id, task.assignee_name)}
                                                        className="w-full h-full pixelated-avatar-tiny object-cover"
                                                        style={{ transform: 'scale(1.22)' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] md:text-[9px] text-center text-gray-400 truncate w-full">
                                            {isUnassignedTask(task) ? '未アサイン' : (task.assignee_id ? (userProfiles[task.assignee_id]?.display_name || task.assignee_name || '担当未定') : (task.assignee_name || '担当未定'))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 💬 作戦会議（コメント）エリア展開 */}
                        {expandedTaskId === task.id && (
                            <div data-comment-panel="true" className="comment-panel-enter bg-[#111] p-3 md:p-4 border-t border-[#333] ml-2 md:ml-11 mr-2 md:mr-4 mb-3 md:mb-4 rounded-sm border-2 border-dashed border-[#555]">
                                <h4 className="text-[var(--active-color)] mb-3 text-sm flex items-center gap-2 font-bold px-2 border-l-4 border-[var(--active-color)]">
                                    <span>💬 作戦会議（指令・報告）</span>
                                </h4>

                                <div className="flex flex-col gap-4 mb-5 pr-3">
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
                                                onChange={uploadCommentImage}
                                                disabled={uploading}
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
                                        <div className="flex items-center justify-between gap-3 text-xs border border-[#444] bg-black/70 px-3 py-2">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <img
                                                    src={newCommentImageUrl}
                                                    alt="添付予定の画像"
                                                    className="h-12 w-12 shrink-0 rounded border border-[#555] object-cover"
                                                />
                                                <span className="text-gray-300 truncate">📷 画像を添付済み</span>
                                            </div>
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
        const currentUserName = (displayName || user.email?.split('@')[0] || '勇者').trim()
        const trimmedAssignee = (newTaskAssignee || '').trim()
        const assigneeName = trimmedAssignee || '未定'
        const assigneeId = trimmedAssignee ? (trimmedAssignee === currentUserName ? user.id : null) : null

        const { error } = await supabase
            .from('tasks')
            .insert({
                id: newTaskId,
                title: newTaskTitle,
                project_id: activeTab,
                assignee_id: assigneeId,
                assignee_name: assigneeName,
                priority: newTaskPriority,
                due_date: newTaskDueDate || null,
                order_index: activeTasks.length // New tasks go to the end
            })

        if (!error) {
            const newTask = {
                id: newTaskId,
                title: newTaskTitle,
                project_id: activeTab,
                assignee_id: assigneeId,
                assignee_name: assigneeName,
                status: 'unstarted',
                priority: newTaskPriority,
                due_date: newTaskDueDate || null,
                order_index: activeTasks.length
            };
            setTasks([newTask, ...tasks])
            setNewTaskTitle('')
            setNewTaskAssignee('')
            setNewTaskPriority('normal')
            setNewTaskDueDate('')
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

    const onDragUpdate = (update: any) => {
        if (!update.destination) {
            setDragDestination(null)
            return
        }
        setDragDestination({
            droppableId: update.destination.droppableId,
            index: update.destination.index
        })
    }

    const onDragEnd = async (result: any) => {
        setDragDestination(null)
        if (!result.destination) return

        const { source, destination } = result

        // 全体マップではプロジェクト内並べ替えのみ許可（別プロジェクトへの移動は不可）
        if (activeTab === 'all') {
            if (source.droppableId !== destination.droppableId) return
            if (!source.droppableId.startsWith('project-')) return

            const projectId = source.droppableId.replace('project-', '')
            const projectItems = tasks
                .filter((t: any) => t.project_id === projectId && t.status !== 'completed')
                .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))

            const reordered = Array.from(projectItems)
            const [moved] = reordered.splice(source.index, 1)
            reordered.splice(destination.index, 0, moved)

            const orderMap = new Map(reordered.map((item: any, idx: number) => [item.id, idx]))
            setTasks((prev: any[]) => prev.map((t: any) => (
                t.project_id === projectId && t.status !== 'completed' && orderMap.has(t.id)
                    ? { ...t, order_index: orderMap.get(t.id) }
                    : t
            )))

            for (let i = 0; i < reordered.length; i++) {
                await supabase.from('tasks').update({ order_index: i }).eq('id', (reordered[i] as any).id)
            }
            return
        }

        const items = Array.from(activeTasks)
        const [reorderedItem] = items.splice(source.index, 1)
        items.splice(destination.index, 0, reorderedItem)

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
        const rawValue = newValue !== undefined ? newValue : editAssigneeValue
        const trimmedValue = (rawValue || '').trim()
        const currentUserName = (displayName || user.email?.split('@')[0] || '勇者').trim()
        const assigneeName = trimmedValue || '未定'
        const assigneeId = trimmedValue ? (trimmedValue === currentUserName ? user.id : null) : null

        const { error } = await supabase
            .from('tasks')
            .update({ assignee_name: assigneeName, assignee_id: assigneeId })
            .eq('id', taskId)

        if (!error) {
            setTasks(tasks.map((t: any) => t.id === taskId ? { ...t, assignee_name: assigneeName, assignee_id: assigneeId } : t))
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
        const QUEST_CLEAR_DELAY_MS = 900

        if (isCompleted) {
            // クエスト完了演出
            setIsQuestClearing(true)
            playLevelUpSound()

            // 演出後に実際に完了処理を行う
            setTimeout(async () => {
                const newStatus = 'completed';
                const updateData: any = {
                    status: newStatus,
                    completed_at: new Date().toISOString(),
                    completed_by_user_id: user.id
                }

                // 先にローカルを更新して、完了タスクが即座に消えるようにする
                setTasks((prev: any[]) => prev.map((t: any) => (
                    t.id === task.id ? { ...t, status: newStatus, completed_at: updateData.completed_at, completed_by_user_id: user.id } : t
                )))

                const { error } = await supabase.from('tasks').update(updateData).eq('id', task.id)

                if (error) {
                    // completed_at カラム未適用環境でも status だけは更新できるようフォールバック
                    const { error: fallbackError } = await supabase
                        .from('tasks')
                        .update({ status: newStatus })
                        .eq('id', task.id)

                    if (fallbackError) {
                        // 失敗時はUIを元に戻す
                        setTasks((prev: any[]) => prev.map((t: any) => (
                            t.id === task.id
                                ? {
                                    ...t,
                                    status: task.status,
                                    completed_at: task.completed_at || null,
                                    completed_by_user_id: task.completed_by_user_id || null,
                                }
                                : t
                        )))
                        alert('完了更新エラー: ' + fallbackError.message)
                    }
                }
                setIsQuestClearing(false)
            }, QUEST_CLEAR_DELAY_MS)
        } else {
            // 未完了に戻す場合
            const newStatus = 'unstarted';
            const { error } = await supabase.from('tasks').update({ status: newStatus, completed_at: null, completed_by_user_id: null }).eq('id', task.id)
            if (error) {
                // completed_* カラム未適用環境向けフォールバック
                const { error: fallbackError } = await supabase
                    .from('tasks')
                    .update({ status: newStatus })
                    .eq('id', task.id)

                if (fallbackError) {
                    alert('未完了戻しエラー: ' + fallbackError.message)
                    return
                }
            }
            setTasks((prev: any[]) => prev.map((t: any) => (
                t.id === task.id ? { ...t, status: newStatus, completed_at: null, completed_by_user_id: null } : t
            )))
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

    const loadCommentsForTask = async (taskId: string) => {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true })

        if (!error && data) {
            setComments(data)
        }
    }

    const toggleTaskExpansion = async (taskId: string) => {
        if (expandedTaskId === taskId) {
            closeExpandedComments()
            return
        }

        setExpandedTaskId(taskId)
        setNewCommentImageUrl(null)
        await loadCommentsForTask(taskId)
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

    // タスクを表示対象（全体 or プロジェクト単位）で絞り込み
    const scopedTasks = useMemo(() => {
        if (activeTab === 'all') return tasks
        return tasks.filter((t: any) => t.project_id === activeTab)
    }, [tasks, activeTab])

    // 未完了タスク（並び順は手動ソート順）
    const activeTasks = useMemo(() => {
        return scopedTasks
            .filter((t: any) => t.status !== 'completed')
            .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
    }, [scopedTasks])

    // 完了タスク（新しい完了日時順）
    const completedTasks = useMemo(() => {
        const toTime = (value?: string | null) => {
            if (!value) return 0
            const time = new Date(value).getTime()
            return Number.isNaN(time) ? 0 : time
        }

        return scopedTasks
            .filter((t: any) => t.status === 'completed')
            .sort((a: any, b: any) => {
                const timeA = toTime(a.completed_at || a.updated_at || a.created_at)
                const timeB = toTime(b.completed_at || b.updated_at || b.created_at)
                return timeB - timeA
            })
    }, [scopedTasks])

    const completedTasksByProject = useMemo(() => {
        if (activeTab !== 'all') return []

        const grouped: Record<string, any[]> = {}
        completedTasks.forEach((task: any) => {
            const projectId = task.project_id || 'unknown'
            if (!grouped[projectId]) grouped[projectId] = []
            grouped[projectId].push(task)
        })

        return Object.entries(grouped)
            .map(([projectId, groupedTasks]) => ({
                projectId,
                projectName: projects.find((p: any) => p.id === projectId)?.name || '不明な拠点',
                tasks: groupedTasks
            }))
            .sort((a, b) => a.projectName.localeCompare(b.projectName, 'ja'))
    }, [activeTab, completedTasks, projects])

    // ボトルネック（緊急）は priority: 'boss' かつ status: 'blocked' か status: 'progress' 的なものを想定
    const bottleneckTasks = activeTasks.filter((t: any) => t.priority === 'boss')

    // 🌟 タスク担当ドロップダウン用のメンバー名
    const partyMembers = useMemo(() => {
        if (activeTab !== 'all') {
            const currentUserName = displayName || user.email?.split('@')[0] || '勇者'
            const names = projectMembers
                .map((m: any) => {
                    if (m.user_id === user.id) return currentUserName
                    return userProfiles[m.user_id]?.display_name || `冒険者-${String(m.user_id).slice(0, 4)}`
                })
                .filter(Boolean) as string[]

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
            const mergedMembers = new Map<string, { user_id: string, role: string }>()

            allProjectMembers.forEach((member: any) => {
                const resolvedRole = member.role || 'member'
                const existing = mergedMembers.get(member.user_id)

                if (!existing || (roleOrder[resolvedRole] ?? 99) < (roleOrder[existing.role] ?? 99)) {
                    mergedMembers.set(member.user_id, {
                        user_id: member.user_id,
                        role: resolvedRole
                    })
                }
            })

            if (!mergedMembers.has(user.id)) {
                mergedMembers.set(user.id, {
                    user_id: user.id,
                    role: userRole || 'member'
                })
            }

            return Array.from(mergedMembers.values())
                .map((member) => {
                    const profile = userProfiles[member.user_id]
                    const fallbackName = member.user_id === user.id ? (displayName || user.email?.split('@')[0] || '冒険者') : '冒険者'
                    const displayNameResolved = profile?.display_name || fallbackName

                    return {
                        user_id: member.user_id,
                        display_name: displayNameResolved,
                        avatar_url: profile?.avatar_url || getFallbackAvatar(displayNameResolved),
                        role: member.role
                    }
                })
                .sort((a, b) => {
                    const roleDiff = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
                    if (roleDiff !== 0) return roleDiff
                    return a.display_name.localeCompare(b.display_name, 'ja')
                })
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
    }, [activeTab, allProjectMembers, projectMembers, userProfiles, user.id, user.email, displayName, userRole])

    const getDisplayNameByUserId = (userId?: string | null) => {
        if (!userId) return '不明'
        if (userId === user.id) return displayName || user.email?.split('@')[0] || '冒険者'
        return userProfiles[userId]?.display_name || '冒険者'
    }

    const getProjectNameById = (projectId?: string | null) => {
        if (!projectId) return '不明な拠点'
        return projects.find((project: any) => project.id === projectId)?.name || '不明な拠点'
    }

    return (
        <main className="py-6 md:py-12 min-h-screen relative max-w-none md:max-w-4xl mx-0 md:mx-auto px-0 md:px-4 overflow-x-clip">
            {(pullDistance > 0 || isRefreshing) && (
                <div
                    className="fixed left-1/2 top-3 z-[220] transition-all duration-150"
                    style={{ transform: `translate(-50%, ${isRefreshing ? 0 : Math.min(pullDistance, PULL_REFRESH_THRESHOLD)}px)` }}
                >
                    <div className="min-w-[172px] rounded-sm border-2 border-white bg-black/90 px-4 py-2 text-center shadow-[0_0_0_2px_#000,0_0_0_4px_#fff]">
                        <div className="text-[10px] font-bold tracking-[0.25em] text-yellow-300">
                            {isRefreshing ? 'NOW LOADING' : pullDistance >= PULL_REFRESH_THRESHOLD ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH'}
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-gray-600 bg-[#111]">
                            <div
                                className="h-full bg-yellow-400 transition-all duration-150"
                                style={{ width: `${isRefreshing ? 100 : Math.min((pullDistance / PULL_REFRESH_THRESHOLD) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
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
            <div className="flex justify-between items-center mb-6 md:mb-10 border-b-4 border-double border-white pb-4 md:pb-6 bg-black p-3 md:p-6 shadow-[0_0_0_2px_#000,0_0_0_4px_#fff] md:shadow-[0_0_0_4px_#000,0_0_0_8px_#fff] mx-0 md:mx-4 relative overflow-hidden">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <img
                            src={avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(displayName || user.email || 'hero')}`}
                            alt="Avatar"
                            className="w-20 h-20 aspect-square pixelated-avatar border-4 border-white shadow-[4px_4px_0_#444] group-hover:brightness-75 transition-all cursor-pointer object-cover"
                        />
                        <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-[10px] text-white font-bold bg-black/50 text-center p-1 leading-tight">
                            {uploading ? '⬆️...' : '📷 変更'}
                            <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                        </label>
                    </div>
                    <div>
                        <h1 className="hero-name-pixel text-3xl md:text-4xl text-white uppercase tracking-wider mb-1 max-w-[220px] md:max-w-none break-words">
                            {displayName}
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--muted-color)] uppercase tracking-tighter">LV 99 LEGENDARY HERO</span>
                            <span className="text-[10px] bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-600 font-bold uppercase tracking-widest">{userRole || 'Loading...'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-4">
                        <a href="/settings" className="text-gray-500 hover:text-white text-xl transition-colors" title="冒険者設定">⚙️</a>
                        <button onClick={handleLogout} className="text-gray-400 hover:text-white underline text-sm tracking-widest uppercase transition-colors">Sign Out</button>
                    </div>
                    {isPushSupported && (
                        <button
                            onClick={isSubscribed ? undefined : subscribeToPush}
                            disabled={subscriptionLoading || isSubscribed}
                            className={`flex items-center gap-2 px-3 py-1 border-2 text-[9px] font-bold uppercase tracking-[0.3em] transition-all
                                ${isSubscribed 
                                    ? 'border-green-600 text-green-400 cursor-default bg-green-950/20' 
                                    : 'border-yellow-600 text-yellow-400 hover:bg-yellow-600 hover:text-black shadow-[0_4px_0_#444] active:translate-y-1 active:shadow-none'}`}
                        >
                            {subscriptionLoading ? '⌛...' : isSubscribed ? '🔔 通知有効' : '🔔 通知を有効にする'}
                        </button>
                    )}
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
                    <h2 className="retro-title pixel-heading-jp text-[var(--danger-color)] border-[var(--danger-color)] bg-[rgba(255,51,51,0.1)]">🚨 緊急クエスト（BOSS ENCOUNTER）</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bottleneckTasks.map((task: any) => {
                            const avatar = getAssigneeAvatar(task.assignee_id, task.assignee_name);
                            const isUnassigned = isUnassignedTask(task);
                            return (
                                <div 
                                    key={task.id} 
                                    onClick={() => scrollToTask(task.id, task.project_id)}
                                    className="border-2 border-[var(--danger-color)] p-3 flex items-center gap-4 bg-[rgba(255,51,51,0.1)] cursor-pointer hover:translate-x-1 hover:bg-[rgba(255,51,51,0.2)] transition-all group/emergency"
                                >
                                    {isUnassigned ? (
                                        <div className="w-12 h-12 flex flex-col items-center justify-center border border-yellow-600 bg-[#2a2006] text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                                            <span className="text-xl leading-none font-bold">?</span>
                                        </div>
                                    ) : (
                                        <img 
                                            src={avatar} 
                                            alt="担当者" 
                                            className="w-12 h-12 pixelated-avatar border border-[var(--danger-color)] object-cover shadow-[0_0_10px_rgba(255,51,51,0.3)]" 
                                        />
                                    )}
                                    <div className="flex-grow">
                                        <div className="text-xl mb-1 group-hover/emergency:text-white transition-colors">{task.title}</div>
                                        {activeTab === 'all' && (
                                            <div className="mb-1 text-[10px] text-gray-300 uppercase tracking-[0.18em]">
                                                🏰 {getProjectNameById(task.project_id)}
                                            </div>
                                        )}
                                        <div className="text-[var(--danger-color)] text-[10px] uppercase font-bold flex justify-between items-center">
                                            <span>▶︎ BOSS ENCOUNTER</span>
                                            <span className="animate-pulse">WATCH OUT!</span>
                                        </div>
                                        {isUnassigned && (
                                            <div className="text-[10px] mt-1 text-yellow-300 font-bold">担当者: 未アサイン</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">

                {/* 左カラム：メインタスクエリア（広め）*/}
                <div className="w-full lg:w-3/4 flex flex-col gap-6">
                    {/* プロジェクト作成エリア (マネージャー以上のみ) */}
                    {isManager && (
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
                    )}

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
                                            className={`border-4 p-4 outline-none text-lg w-full cursor-pointer transition-colors
                                                ${newTaskPriority === 'boss'
                                                    ? 'bg-red-950/40 border-red-500 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.3)]'
                                                    : newTaskPriority === 'elite'
                                                        ? 'bg-amber-950/35 border-amber-500 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                                                        : 'bg-black border-white text-white focus:bg-[#111]'}`}
                                        >
                                            <option value="normal">⚔️ 雑魚敵 — 通常タスク</option>
                                            <option value="elite">🟠 中ボス — 重要タスク</option>
                                            <option value="boss">🔴 大ボス — 最優先・緊急</option>
                                        </select>
                                    </div>

                                    {/* 期限（縦積み） */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] text-[#aaa] uppercase tracking-[0.2em] font-bold">期限（逃走日時）</label>
                                        <input
                                            type="datetime-local"
                                            value={newTaskDueDate}
                                            onChange={e => setNewTaskDueDate(e.target.value)}
                                            className="bg-black border-4 border-white p-4 text-white outline-none text-lg font-inherit focus:bg-[#111] w-full cursor-pointer invert brightness-200"
                                            style={{ colorScheme: 'dark' }}
                                        />
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

                        <DragDropContext onDragEnd={onDragEnd} onDragUpdate={onDragUpdate}>
                            {activeTab === 'all' ? (
                                <div className="list-none p-0 m-0">
                                    {projects.map((project: any) => {
                                        const projectTasks = activeTasks.filter((t: any) => t.project_id === project.id);
                                        const projectDroppableId = `project-${project.id}`;
                                        return (
                                            <div key={project.id} className="mb-10">
                                                <h3 className="text-sm font-bold text-gray-500 mb-3 border-l-4 border-gray-700 pl-2 uppercase tracking-widest">{project.name}</h3>
                                                <Droppable droppableId={projectDroppableId}>
                                                    {(provided, snapshot) => (
                                                        <ul
                                                            {...provided.droppableProps}
                                                            ref={provided.innerRef}
                                                            className={`list-none p-0 m-0 transition-all rounded-sm border
                                                                ${snapshot.isDraggingOver ? 'border-yellow-500/80 bg-yellow-950/10 shadow-[0_0_0_1px_rgba(234,179,8,0.4)]' : 'border-transparent'}`}
                                                        >
                                                            {projectTasks.length === 0 && (
                                                                <li className="text-[10px] text-gray-600 italic ml-6 mb-4 py-2">
                                                                    この地域にはまだクエストが存在しない...
                                                                </li>
                                                            )}
                                                            {projectTasks.map((task: any, index: number) => renderTaskItem(task, index, projectDroppableId))}
                                                            {provided.placeholder}
                                                            {dragDestination?.droppableId === projectDroppableId && dragDestination.index === projectTasks.length && projectTasks.length > 0 && (
                                                                <li className="h-[2px] bg-yellow-400 mx-2 mb-2 shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                                                            )}
                                                        </ul>
                                                    )}
                                                </Droppable>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Droppable droppableId="active-tasks">
                                    {(provided, snapshot) => (
                                        <ul
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`list-none p-0 m-0 transition-all rounded-sm
                                                ${snapshot.isDraggingOver ? 'ring-1 ring-yellow-500/70 bg-yellow-950/10' : ''}`}
                                        >
                                            {activeTasks.length === 0 && <li className="text-gray-500 py-4 text-center">このエリアにアクティブなクエストはありません。</li>}
                                            {activeTasks.map((task: any, index: number) => renderTaskItem(task, index, 'active-tasks'))}
                                            {provided.placeholder}
                                            {dragDestination?.droppableId === 'active-tasks' && dragDestination.index === activeTasks.length && activeTasks.length > 0 && (
                                                <li className="h-[2px] bg-yellow-400 mx-2 mb-2 shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                                            )}
                                        </ul>
                                    )}
                                </Droppable>
                            )}
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
                        <h3 className="text-gray-400 mb-2 text-lg border-b border-gray-600 pb-1">👥 パーティ名簿</h3>
                        {activeTab !== 'all' && isManager && (
                            <div className="text-[10px] text-yellow-500/70 mb-3 italic">
                                ※プルダウンから仲間の役職を変更できます。
                            </div>
                        )}
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
                        <div className="mt-8 border-t-2 border-dashed border-gray-500 pt-4 bg-black/65 backdrop-blur-[1px] px-3 md:px-4 pb-3 rounded-sm">
                            <h3 className="text-yellow-300 mb-1 text-lg font-bold tracking-wide">🪦 討伐完了（アーカイブ）</h3>
                            <div className="text-[11px] text-gray-300 mb-4">
                                {activeTab === 'all'
                                    ? '各拠点ごとに完了したクエストを一覧表示しています。'
                                    : '完了した日時と完了者を記録しています（クリックで作戦会議も表示）。'}
                            </div>
                            {activeTab === 'all' ? (
                                <div className="flex flex-col gap-3">
                                    {completedTasksByProject.map((group: any) => (
                                        <div key={group.projectId} className="border border-gray-600 bg-black/70 rounded-sm overflow-hidden">
                                            <div className="px-2 py-1.5 text-[11px] text-yellow-200 border-b border-gray-700 font-bold tracking-wide bg-black/60">
                                                🏰 {group.projectName} ({group.tasks.length})
                                            </div>
                                            <ul className="list-none p-0 m-0">
                                                {group.tasks.map((task: any) => (
                                                    <li key={task.id} className="px-2 py-2 border-b border-gray-800 last:border-b-0 flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] text-gray-100 line-through break-words">{task.title}</div>
                                                            <div className="text-[10px] text-gray-300 mt-0.5">
                                                                完了: {task.completed_at ? new Date(task.completed_at).toLocaleString('ja-JP') : '日時未記録'}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400">
                                                                完了者: {getDisplayNameByUserId(task.completed_by_user_id)}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => markCompleted(task, false)}
                                                            className="shrink-0 text-[10px] px-2 py-1 border border-teal-400 text-teal-200 bg-[#062323] hover:bg-[#0b3434] transition-colors"
                                                            title="このタスクを未完了に戻す"
                                                        >
                                                            ↩ 復活
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <ul className="list-none p-0 m-0">
                                    {completedTasks.map((task: any) => {
                                        const isEditingTaskTitle = editingTaskId === task.id;
                                        return (
                                            <li key={task.id} className="border-b border-gray-700 bg-black/50 transition-colors hover:bg-black/70">
                                                <div className="flex items-start md:items-center p-2 md:p-3 gap-2 md:gap-4">
                                                    <div className="relative shrink-0 flex items-center">
                                                        <input type="checkbox" checked={true} onChange={(e) => markCompleted(task, e.target.checked)} className="appearance-none w-5 h-5 md:w-6 md:h-6 border-2 border-gray-600 bg-black cursor-pointer align-middle" />
                                                        <span className="absolute top-[-4px] left-[2px] text-lg md:text-xl text-gray-400 pointer-events-none">✔</span>
                                                    </div>
                                                     <div className="grow text-sm md:text-lg text-gray-200 line-through flex items-center flex-wrap gap-1.5 md:gap-2 min-w-0">
                                                        {isEditingTaskTitle ? (
                                                            <div
                                                                data-task-edit-panel="true"
                                                                className="relative flex items-center flex-wrap gap-2 min-w-[280px] flex-1"
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
                                                                    className="min-w-0 flex-1 basis-full md:basis-auto bg-[#1a1200] border border-[var(--active-color)] px-3 py-2 text-white outline-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    data-due-trigger="true"
                                                                    onClick={openDueDatePicker}
                                                                    className="shrink-0 px-3 py-2 text-xs font-bold border border-sky-700 text-sky-200 bg-[#071622] hover:bg-[#0b2234] transition-colors"
                                                                    style={{ textDecoration: 'none' }}
                                                                >
                                                                    📅 期限
                                                                </button>
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
                                                                {isDueDatePickerOpen && (
                                                                    <div
                                                                        data-due-picker="true"
                                                                        className="absolute z-40 right-0 top-full mt-1 w-[min(300px,88vw)] bg-black border-2 border-sky-700 p-2 shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
                                                                        style={{ textDecoration: 'none' }}
                                                                    >
                                                                        <div className="text-[10px] text-sky-200 mb-1">期限を設定</div>
                                                                        <input
                                                                            ref={dueDateInputRef}
                                                                            type="datetime-local"
                                                                            value={editTaskDueDate}
                                                                            onChange={(e) => setEditTaskDueDate(e.target.value)}
                                                                            className="w-full bg-black border border-gray-500 px-2 py-1.5 text-xs text-gray-100 outline-none"
                                                                            style={{ colorScheme: 'dark' }}
                                                                        />
                                                                        <div className="mt-2 flex items-center justify-between gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setEditTaskDueDate('')
                                                                                    setIsDueDatePickerOpen(false)
                                                                                }}
                                                                                className="text-[10px] px-2 py-1 border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white"
                                                                            >
                                                                                期限なし
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setIsDueDatePickerOpen(false)}
                                                                                className="text-[10px] px-2 py-1 border border-sky-700 text-sky-200 hover:bg-[#0b2234]"
                                                                            >
                                                                                閉じる
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
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
                                                                    data-task-edit-trigger="true"
                                                                    onClick={() => beginTaskTitleEdit(task)}
                                                                    className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold border border-[#9d7b3b] bg-[#231b0c] text-[#f2d78f] hover:bg-[#2e2411] transition-colors no-underline"
                                                                    style={{ textDecoration: 'none' }}
                                                                >
                                                                    <span>✎</span>
                                                                    <span>題名・期限</span>
                                                                </button>
                                                            </>
                                                        )}
                                                        {task.completed_at && (
                                                            <span className="text-[11px] text-gray-200 no-underline bg-black border border-gray-700 px-2 py-1 rounded">
                                                                完了: {new Date(task.completed_at).toLocaleString('ja-JP')}
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] text-gray-200 no-underline bg-black border border-gray-700 px-2 py-1 rounded">
                                                            完了者: {getDisplayNameByUserId(task.completed_by_user_id)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => markCompleted(task, false)}
                                                            className="text-[10px] px-2 py-1 border border-teal-400 text-teal-200 bg-[#062323] hover:bg-[#0b3434] transition-colors no-underline"
                                                            style={{ textDecoration: 'none' }}
                                                            title="このタスクを未完了に戻す"
                                                        >
                                                            ↩ 復活
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1 shrink-0 justify-end w-[80px]">
                                                        {(() => {
                                                            const profile = task.assignee_id ? userProfiles[task.assignee_id] : null;
                                                            const avatar = profile?.avatar_url || getFallbackAvatar(task.assignee_name || 'unknown');
                                                            const name = profile?.display_name || task.assignee_name || '担当未定';
                                                            const isUnassigned = isUnassignedTask(task);
                                                            return (
                                                                <>
                                                                    {isUnassigned ? (
                                                                        <div className="w-6 h-6 flex items-center justify-center border border-gray-600 bg-[#1a1a1a] text-gray-300 text-sm font-bold leading-none">?</div>
                                                                    ) : (
                                                                        <div className="w-6 h-6 border border-gray-800 overflow-hidden">
                                                                            <img
                                                                                src={avatar}
                                                                                alt={name}
                                                                                className="w-full h-full pixelated-avatar-tiny grayscale object-cover"
                                                                                style={{ transform: 'scale(1.22)' }}
                                                                                title={name}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <span className="text-[9px] text-gray-400 truncate w-full text-center">
                                                                        {isUnassigned ? '未アサイン' : name}
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* 💬 作戦会議（コメント）エリア展開 - アーカイブ版 */}
                                                {expandedTaskId === task.id && (
                                                    <div data-comment-panel="true" className="comment-panel-enter bg-[#111] p-3 border-t border-[#222] ml-9 mr-3 mb-3 rounded-sm border border-dashed border-[#444] opacity-80">
                                                        <h4 className="text-gray-500 mb-2 text-xs flex items-center gap-2">
                                                            <span>💬 作戦会議（過去の記録）</span>
                                                        </h4>

                                                        <div className="flex flex-col gap-2 mb-3 pr-2">
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
                            )}
                        </div>
                    )}
                </div>
            </div>

        </main>
    )
}
