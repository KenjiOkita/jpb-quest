-- tasksテーブルに期限（due_date）カラムを追加
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- コメント：期限が追加されたことで、「時限爆弾」や「逃走間近」などの演出が可能になります。
COMMENT ON COLUMN tasks.due_date IS 'タスクの期限。この日時を過ぎると「逃走」や「敗北」などの演出に使用可能。';
