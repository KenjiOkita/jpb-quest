'use client'

import React from 'react'

interface QuestCreateFormProps {
    onSubmit: (e: React.FormEvent) => void
    newTaskTitle: string
    setNewTaskTitle: (val: string) => void
    newTaskAssignee: string
    setNewTaskAssignee: (val: string) => void
    newTaskPriority: string
    setNewTaskPriority: (val: string) => void
    newTaskDueDate: string
    setNewTaskDueDate: (val: string) => void
    currentProjectMembers: any[]
    getMemberDisplayName: (userId: string) => string
}

const QuestCreateForm: React.FC<QuestCreateFormProps> = ({
    onSubmit,
    newTaskTitle,
    setNewTaskTitle,
    newTaskAssignee,
    setNewTaskAssignee,
    newTaskPriority,
    setNewTaskPriority,
    newTaskDueDate,
    setNewTaskDueDate,
    currentProjectMembers,
    getMemberDisplayName
}) => {
    return (
        <form onSubmit={onSubmit} className="mb-10 p-6 bg-black border-4 border-white shadow-[0_0_0_4px_#000,0_0_0_8px_#fff]">
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
                        {currentProjectMembers.map((member: any) => (
                            <option key={member.user_id} value={member.user_id}>{getMemberDisplayName(member.user_id)}</option>
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
                    className="w-full bg-white text-black border-4 border-black py-4 text-xl hover:bg-yellow-100 transition-all font-bold shadow-[0_6px_0_#888] active:translate-y-1 active:shadow-none tracking-[0.2em]"
                >
                    💡 クエストを依頼する
                </button>
            </div>
        </form>
    )
}

export default QuestCreateForm
