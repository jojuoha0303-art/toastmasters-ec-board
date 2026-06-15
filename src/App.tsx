import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Copy, RotateCcw, Flame, Clock,
  SkipForward, Inbox, X, Check, Users, Pencil, Loader2
} from 'lucide-react';

// API helpers（Vercel API Route経由でSupabaseへ）
const api = {
  async getTopics(): Promise<DbRow[]> {
    const r = await fetch('/api/topics');
    if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
    return r.json();
  },
  async insertTopic(row: DbRow): Promise<void> {
    const r = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || `insert failed: ${r.status}`);
    }
  },
  async updateTopic(id: string, patch: Partial<DbRow>): Promise<void> {
    const r = await fetch(`/api/topics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`update failed: ${r.status}`);
  },
  async deleteTopic(id: string): Promise<void> {
    const r = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`delete failed: ${r.status}`);
  },
};

type Priority = 'HIGH' | 'MID' | 'LOW';
type ColumnId = 'pool' | 'now' | 'later' | 'skip';

interface Assignee {
  name: string;
  color: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  assignee: Assignee | null;
  column: ColumnId;
}

const EC_MEMBERS: Assignee[] = [
  { name: 'ALL', color: 'bg-slate-600' },
  { name: 'President', color: 'bg-indigo-600' },
  { name: 'VPE', color: 'bg-emerald-600' },
  { name: 'VPM', color: 'bg-orange-500' },
  { name: 'VPPR', color: 'bg-pink-500' },
  { name: 'Secretary', color: 'bg-teal-500' },
  { name: 'Treasurer', color: 'bg-violet-500' },
  { name: 'SAA', color: 'bg-sky-500' },
];

const INITIAL_TOPICS: Topic[] = [
  {
    id: '1',
    title: '年間テーマの決定',
    description: '今期のクラブテーマとスローガンを EC で合意する',
    priority: 'HIGH',
    assignee: { name: 'President', color: 'bg-indigo-600' },
    column: 'now',
  },
  {
    id: '2',
    title: 'コンテスト出場者の選定',
    description: '次回スピーチコンテストの出場希望者を募り、スケジュールを確定する',
    priority: 'HIGH',
    assignee: { name: 'VPE', color: 'bg-emerald-600' },
    column: 'now',
  },
  {
    id: '3',
    title: '新会員勧誘キャンペーン',
    description: 'ゲスト誘致のための SNS・口コミ戦略を立案する',
    priority: 'MID',
    assignee: { name: 'VPM', color: 'bg-orange-500' },
    column: 'now',
  },
  {
    id: '4',
    title: 'SNS 投稿スケジュール',
    description: 'Instagram・X の投稿頻度とコンテンツ担当を明確にする',
    priority: 'MID',
    assignee: { name: 'VPPR', color: 'bg-pink-500' },
    column: 'later',
  },
  {
    id: '5',
    title: '例会プログラム改善',
    description: 'タイムテーブルの見直しと新ロール導入の検討',
    priority: 'MID',
    assignee: { name: 'VPE', color: 'bg-emerald-600' },
    column: 'pool',
  },
  {
    id: '6',
    title: '年会費・予算計画',
    description: '次期の収支計画を作成し EC で承認する',
    priority: 'LOW',
    assignee: { name: 'Treasurer', color: 'bg-violet-500' },
    column: 'pool',
  },
  {
    id: '7',
    title: '会場手配ルールの整備',
    description: '例会場の予約・設営・撤収フローをドキュメント化する',
    priority: 'LOW',
    assignee: { name: 'SAA', color: 'bg-sky-500' },
    column: 'skip',
  },
];

const COLUMNS: {
  id: ColumnId;
  label: string;
  icon: React.ReactNode;
  color: string;
  headerBg: string;
  bg: string;
  border: string;
}[] = [
  {
    id: 'pool',
    label: '議題プール',
    icon: <Inbox className="w-4 h-4" />,
    color: 'text-slate-600',
    headerBg: 'bg-slate-100',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  {
    id: 'now',
    label: '今すぐ議論',
    icon: <Flame className="w-4 h-4" />,
    color: 'text-red-600',
    headerBg: 'bg-red-50',
    bg: 'bg-red-50/40',
    border: 'border-red-200',
  },
  {
    id: 'later',
    label: '後で検討',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-amber-600',
    headerBg: 'bg-amber-50',
    bg: 'bg-amber-50/40',
    border: 'border-amber-200',
  },
  {
    id: 'skip',
    label: '見送り',
    icon: <SkipForward className="w-4 h-4" />,
    color: 'text-slate-500',
    headerBg: 'bg-slate-100',
    bg: 'bg-slate-50/60',
    border: 'border-slate-200',
  },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  HIGH: 'bg-red-100 text-red-700 border border-red-200',
  MID: 'bg-amber-100 text-amber-700 border border-amber-200',
  LOW: 'bg-slate-100 text-slate-600 border border-slate-200',
};

// ── AddTopicModal ─────────────────────────────────────────────

interface AddTopicModalProps {
  onClose: () => void;
  onAdd: (topic: Omit<Topic, 'id'>) => void;
}

const AddTopicModal: React.FC<AddTopicModalProps> = ({ onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MID');
  const [assigneeName, setAssigneeName] = useState('');
  const [column, setColumn] = useState<ColumnId>('pool');

  const handleSubmit = () => {
    if (!title.trim()) return;
    const assignee = EC_MEMBERS.find(s => s.name === assigneeName) || null;
    onAdd({ title: title.trim(), description: description.trim(), priority, assignee, column });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5" /> 議題を追加
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              議題タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例：次回例会テーマの決定"
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">内容・背景</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="議題の詳細や背景を入力"
              rows={3}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">優先度</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white"
              >
                <option value="HIGH">HIGH（高）</option>
                <option value="MID">MID（中）</option>
                <option value="LOW">LOW（低）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">担当</label>
              <select
                value={assigneeName}
                onChange={e => setAssigneeName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white"
              >
                <option value="">未割当</option>
                {EC_MEMBERS.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">初期ステータス</label>
            <select
              value={column}
              onChange={e => setColumn(e.target.value as ColumnId)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white"
            >
              <option value="pool">議題プール</option>
              <option value="now">今すぐ議論</option>
              <option value="later">後で検討</option>
              <option value="skip">見送り</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" /> 追加する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── EditTopicModal ────────────────────────────────────────────

interface EditTopicModalProps {
  topic: Topic;
  onClose: () => void;
  onSave: (updated: Topic) => void;
}

const EditTopicModal: React.FC<EditTopicModalProps> = ({ topic, onClose, onSave }) => {
  const [title, setTitle] = useState(topic.title);
  const [description, setDescription] = useState(topic.description);
  const [priority, setPriority] = useState<Priority>(topic.priority);
  const [assigneeName, setAssigneeName] = useState(topic.assignee?.name || '');
  const [column, setColumn] = useState<ColumnId>(topic.column);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const assignee = EC_MEMBERS.find(s => s.name === assigneeName) || null;
    onSave({ ...topic, title: title.trim(), description: description.trim(), priority, assignee, column });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Pencil className="w-5 h-5" /> 議題を編集
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              議題タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-violet-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">内容・背景</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-violet-500 focus:outline-none text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">優先度</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-violet-500 focus:outline-none text-sm bg-white"
              >
                <option value="HIGH">HIGH（高）</option>
                <option value="MID">MID（中）</option>
                <option value="LOW">LOW（低）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">担当</label>
              <select
                value={assigneeName}
                onChange={e => setAssigneeName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-violet-500 focus:outline-none text-sm bg-white"
              >
                <option value="">未割当</option>
                {EC_MEMBERS.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ステータス</label>
            <select
              value={column}
              onChange={e => setColumn(e.target.value as ColumnId)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-violet-500 focus:outline-none text-sm bg-white"
            >
              <option value="pool">議題プール</option>
              <option value="now">今すぐ議論</option>
              <option value="later">後で検討</option>
              <option value="skip">見送り</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" /> 保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── TopicCard ─────────────────────────────────────────────────

interface TopicCardProps {
  topic: Topic;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDelete: (id: string) => void;
  onEdit: (topic: Topic) => void;
  onAssigneeChange: (id: string, assignee: Assignee | null) => void;
}

const TopicCard: React.FC<TopicCardProps> = ({
  topic, isDragging, onDragStart, onDragEnd, onDelete, onEdit, onAssigneeChange,
}) => {
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, topic.id)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-40 scale-95 rotate-1' : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-slate-800 text-sm leading-snug flex-1">{topic.title}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(topic); }}
            className="text-slate-300 hover:text-violet-500 transition-colors"
            title="編集"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-slate-300 hover:text-red-400 transition-colors"
            title="削除"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 削除確認 */}
      {confirmDelete && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-semibold text-red-700 mb-2">この議題を削除しますか？</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete(topic.id); setConfirmDelete(false); }}
              className="flex-1 py-1 rounded-md bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
            >
              削除する
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1 rounded-md bg-white border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {topic.description && (
        <p className="text-xs text-slate-500 leading-relaxed mb-3">{topic.description}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[topic.priority]}`}>
          {topic.priority}
        </span>

        <div className="relative">
          <button
            onClick={() => setShowAssignMenu(!showAssignMenu)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {topic.assignee ? (
              <>
                <div className={`w-5 h-5 rounded-full ${topic.assignee.color} flex items-center justify-center text-white text-[9px] font-bold`}>
                  {topic.assignee.name[0]}
                </div>
                <span className="font-medium">{topic.assignee.name}</span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                  <Users className="w-3 h-3 text-slate-400" />
                </div>
                <span className="text-slate-400">未割当</span>
              </>
            )}
          </button>

          {showAssignMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 min-w-[130px]">
              <button
                onClick={() => { onAssigneeChange(topic.id, null); setShowAssignMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 flex items-center gap-2"
              >
                <Users className="w-3 h-3" /> 未割当
              </button>
              {EC_MEMBERS.map(s => (
                <button
                  key={s.name}
                  onClick={() => { onAssigneeChange(topic.id, s); setShowAssignMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <div className={`w-4 h-4 rounded-full ${s.color} flex items-center justify-center text-white text-[9px] font-bold`}>
                    {s.name[0]}
                  </div>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── DB helpers ────────────────────────────────────────────────

type DbRow = {
  id: string;
  title: string;
  description: string;
  priority: string;
  assignee_name: string | null;
  assignee_color: string | null;
  column_id: string;
};

function rowToTopic(row: DbRow): Topic {
  const assignee =
    row.assignee_name && row.assignee_color
      ? { name: row.assignee_name, color: row.assignee_color }
      : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority as Priority,
    assignee,
    column: row.column_id as ColumnId,
  };
}

function topicToRow(t: Topic): DbRow {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    assignee_name: t.assignee?.name ?? null,
    assignee_color: t.assignee?.color ?? null,
    column_id: t.column,
  };
}

// ── App ───────────────────────────────────────────────────────

const App: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [copied, setCopied] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const dragOverRef = useRef<ColumnId | null>(null);
  // 削除・移動中のIDを追跡し、ポーリングで復活しないようにする
  const pendingDeletes = useRef<Set<string>>(new Set());

  // 初回ロード＆ポーリング（30秒ごとに他デバイスの変更を反映）
  const fetchTopics = useCallback(async () => {
    try {
      const data = await api.getTopics();
      // 削除処理中のIDはポーリング結果から除外
      setTopics(data.map(rowToTopic).filter(t => !pendingDeletes.current.has(t.id)));
      setDbError(null);
    } catch (e) {
      setDbError(`読み込みエラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
    const timer = setInterval(fetchTopics, 30000); // 30秒ポーリング
    return () => clearInterval(timer);
  }, [fetchTopics]);

  const getTopicsForColumn = (col: ColumnId) => topics.filter(t => t.column === col);

  const handleAddTopic = async (topicData: Omit<Topic, 'id'>) => {
    const newTopic: Topic = { ...topicData, id: `topic-${Date.now()}` };
    setTopics(prev => [...prev, newTopic]);
    try {
      await api.insertTopic(topicToRow(newTopic));
      setDbError(null);
    } catch (e) {
      setTopics(prev => prev.filter(t => t.id !== newTopic.id));
      setDbError(`追加エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDelete = async (id: string) => {
    pendingDeletes.current.add(id);
    setTopics(prev => prev.filter(t => t.id !== id));
    try {
      await api.deleteTopic(id);
    } catch {
      // 失敗したら元に戻す
      pendingDeletes.current.delete(id);
      fetchTopics();
    } finally {
      pendingDeletes.current.delete(id);
    }
  };

  const handleEditSave = async (updated: Topic) => {
    setTopics(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditingTopic(null);
    await api.updateTopic(updated.id, topicToRow(updated)).catch(() => fetchTopics());
  };

  const handleAssigneeChange = async (id: string, assignee: Assignee | null) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, assignee } : t));
    await api.updateTopic(id, {
      assignee_name: assignee?.name ?? null,
      assignee_color: assignee?.color ?? null,
    }).catch(() => fetchTopics());
  };

  const handleCopyMarkdown = () => {
    const lines: string[] = ['# Otemachi Toastmasters EC 議題ボード', ''];
    COLUMNS.forEach(col => {
      const colTopics = getTopicsForColumn(col.id);
      lines.push(`## ${col.label}（${colTopics.length}件）`);
      lines.push('');
      colTopics.forEach(t => {
        lines.push(`### ${t.title}`);
        if (t.description) lines.push(t.description);
        lines.push(`- 優先度: ${t.priority}`);
        lines.push(`- 担当: ${t.assignee?.name || '未割当'}`);
        lines.push('');
      });
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = async () => {
    if (!window.confirm('ボードをリセットしてサンプルデータに戻しますか？')) return;
    for (const t of topics) await api.deleteTopic(t.id).catch(() => {});
    for (const t of INITIAL_TOPICS) await api.insertTopic(topicToRow(t)).catch(() => {});
    await fetchTopics();
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
    dragOverRef.current = null;
  };

  const handleColumnDragOver = (e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRef.current !== colId) {
      dragOverRef.current = colId;
      setDragOverColumn(colId);
    }
  };

  const handleColumnDragLeave = () => {
    dragOverRef.current = null;
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault();
    if (!draggingId) return;
    const id = draggingId;
    setTopics(prev => prev.map(t => t.id === id ? { ...t, column: colId } : t));
    setDraggingId(null);
    setDragOverColumn(null);
    dragOverRef.current = null;
    await api.updateTopic(id, { column_id: colId }).catch(() => fetchTopics());
  };

  const nowCount = getTopicsForColumn('now').length;
  const laterCount = getTopicsForColumn('later').length;
  const unassigned = topics.filter(t => !t.assignee).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full max-w-7xl mx-auto px-4 py-6">

        {/* ヘッダーアクション */}
        <div className="flex items-center justify-end mb-5 gap-2">
          <button
            onClick={handleCopyMarkdown}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
              copied
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'コピー完了！' : 'Markdownコピー'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-600 hover:border-slate-400 font-semibold text-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            リセット
          </button>
        </div>

        {/* タイトルカード */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl mt-0.5">🗣</span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Otemachi Toastmasters
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                EC議題ディスカッションボード ― カードをドラッグして議論ステータスを管理
              </p>
            </div>
          </div>
          <div className="flex gap-4 flex-shrink-0">
            {[
              { label: '議題総数', value: topics.length, color: 'text-slate-800' },
              { label: '今すぐ', value: nowCount, color: 'text-red-600' },
              { label: '後で', value: laterCount, color: 'text-amber-600' },
              { label: '未割当', value: unassigned, color: 'text-slate-500' },
            ].map(stat => (
              <div key={stat.label} className="text-center min-w-[60px]">
                <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 議題追加ボタン */}
        <div className="mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/30 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            議題を追加
          </button>
        </div>

        {/* エラー表示 */}
        {dbError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            ⚠️ {dbError}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">データを読み込み中...</span>
          </div>
        )}

        {/* カンバンボード */}
        {!loading && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {COLUMNS.map(col => {
              const colTopics = getTopicsForColumn(col.id);
              const isOver = dragOverColumn === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={e => handleColumnDragOver(e, col.id)}
                  onDragLeave={handleColumnDragLeave}
                  onDrop={e => handleDrop(e, col.id)}
                  className={`rounded-2xl border-2 flex flex-col min-h-[400px] min-w-[260px] flex-1 transition-all ${
                    isOver
                      ? 'border-indigo-400 bg-indigo-50/60 shadow-lg shadow-indigo-500/20'
                      : `${col.border} ${col.bg}`
                  }`}
                >
                  <div className={`px-4 py-3 rounded-t-xl flex items-center justify-between ${col.headerBg}`}>
                    <div className={`flex items-center gap-2 font-bold text-sm ${col.color}`}>
                      {col.icon}
                      {col.label}
                    </div>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white shadow-sm ${col.color}`}>
                      {colTopics.length}
                    </span>
                  </div>

                  <div className="flex-1 p-3 space-y-3">
                    {colTopics.length === 0 && (
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center text-xs font-medium ${
                        isOver ? 'border-indigo-400 text-indigo-500' : 'border-slate-300 text-slate-400'
                      }`}>
                        {isOver ? 'ここにドロップ' : 'カードをここにドラッグ'}
                      </div>
                    )}
                    {colTopics.map(topic => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        isDragging={draggingId === topic.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDelete={handleDelete}
                        onEdit={setEditingTopic}
                        onAssigneeChange={handleAssigneeChange}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddTopicModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTopic}
        />
      )}
      {editingTopic && (
        <EditTopicModal
          topic={editingTopic}
          onClose={() => setEditingTopic(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default App;
