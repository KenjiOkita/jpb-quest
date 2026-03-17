'use client'

import React from 'react'

interface PartySidebarProps {
    inviteCodeInput: string
    setInviteCodeInput: (val: string) => void
    joinProject: () => void
    isJoining: boolean
    activeTab: string
    setActiveTab: (val: string) => void
    projects: any[]
    joinedPartyRoster: any[]
    registeredOnlyPartyRoster: any[]
    partyRoster: any[]
    ROSTER_DEBUG_MARKER: string
    totalKnownProfiles: number
    isManager: boolean
    renderPartyMemberRow: (member: any) => React.ReactNode
}

const PartySidebar: React.FC<PartySidebarProps> = ({
    inviteCodeInput,
    setInviteCodeInput,
    joinProject,
    isJoining,
    activeTab,
    setActiveTab,
    projects,
    joinedPartyRoster,
    registeredOnlyPartyRoster,
    partyRoster,
    ROSTER_DEBUG_MARKER,
    totalKnownProfiles,
    isManager,
    renderPartyMemberRow
}) => {
    return (
        <div className="w-full flex flex-col gap-6">
            <div className="retro-window">
                <h3 className="text-gray-400 mb-3 text-lg border-b border-gray-600 pb-1">📜 招待の呪文を入力</h3>
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value)}
                        placeholder="招待コード（8文字）"
                        className="bg-black border-2 border-white p-3 text-white outline-none text-sm font-mono focus:bg-[#111]"
                    />
                    <button
                        onClick={joinProject}
                        disabled={isJoining || inviteCodeInput.length < 8}
                        className="bg-white text-black text-sm font-bold py-2.5 hover:bg-yellow-400 disabled:opacity-50 transition-colors shadow-[0_4px_0_#888] active:translate-y-1 active:shadow-none"
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
                {activeTab === 'all' && (
                    <div className="mb-3 space-y-1">
                        <div className="text-[10px] text-gray-500">
                            参加中 {joinedPartyRoster.length}名 / 登録済み未参加 {registeredOnlyPartyRoster.length}名
                        </div>
                        <div className="text-[9px] text-[#7dd3fc] border border-sky-900/70 bg-sky-950/20 px-2 py-1">
                            {ROSTER_DEBUG_MARKER} | profiles {totalKnownProfiles} | roster {partyRoster.length} | joined {joinedPartyRoster.length} | registered {registeredOnlyPartyRoster.length}
                        </div>
                    </div>
                )}
                {activeTab !== 'all' && isManager && (
                    <div className="text-[10px] text-yellow-500/70 mb-3 italic">
                        ※プルダウンから仲間の役職を変更できます。
                    </div>
                )}
                {partyRoster.length === 0 ? (
                    <div className="text-sm text-gray-500">まだ誰もいません</div>
                ) : activeTab === 'all' ? (
                    <div className="flex flex-col gap-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300 border-b border-dashed border-gray-700 pb-1">
                            参加中メンバー
                        </div>
                        {joinedPartyRoster.length === 0 ? (
                            <div className="text-xs text-gray-600 border border-dashed border-gray-800 px-2 py-2">まだ参加中のメンバーはいません</div>
                        ) : (
                            joinedPartyRoster.map(renderPartyMemberRow)
                        )}
                        <div className="pt-2 text-[10px] uppercase tracking-[0.18em] text-sky-300 border-b border-dashed border-gray-700 pb-1">
                            登録済み（未参加）
                        </div>
                        {registeredOnlyPartyRoster.length === 0 ? (
                            <div className="text-xs text-gray-600 border border-dashed border-gray-800 px-2 py-2">未参加の登録メンバーはいません</div>
                        ) : (
                            registeredOnlyPartyRoster.map(renderPartyMemberRow)
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {partyRoster.map(renderPartyMemberRow)}
                    </div>
                )}
            </div>
        </div>
    )
}

export default PartySidebar
