'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface MasterScenario {
  id: string;
  carrier: string;
  scenario_number: string;
  title: string;
  description: string;
  cautions: string;
  common_position?: string | null;
}

export default function ScenariosPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;
  const [scenarios, setScenarios] = useState<MasterScenario[]>([]);
  const [selected, setSelected] = useState<MasterScenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    try {
      const { data } = await supabase
        .from('scenarios')
        .select('id, carrier, scenario_number, title, description, cautions, common_position')
        .order('carrier')
        .order('scenario_number');
      setScenarios(data || []);
      if (data && data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="p-6">
      <button onClick={() => router.back()} className="text-blue-600 mb-4 block">← 戻る</button>
      <h2 className="text-2xl font-bold mb-6">シナリオ・チェック項目管理</h2>
      <p className="text-sm text-gray-500 mb-4">
        キャリア（au, DS等）× シナリオ番号（①②③④）でシナリオを管理します。
      </p>

      <div className="grid grid-cols-3 gap-6">
        {/* 左：シナリオ一覧 */}
        <div className="col-span-1 bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">シナリオ一覧</h3>
            <button
              onClick={() => { setSelected(null); setShowNew(true); }}
              className="text-sm bg-blue-600 text-white px-2 py-1 rounded"
            >
              ＋新規
            </button>
          </div>

          <div className="space-y-3">
            {/* 共通（最初） */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">共通（最初）</p>
              {scenarios.filter(s => s.common_position === 'first').map(s => (
                <ScenarioButton key={s.id} s={s} selected={selected} showNew={showNew}
                  onClick={() => { setSelected(s); setShowNew(false); }} />
              ))}
              <button
                onClick={() => { setSelected(null); setShowNew(true); }}
                data-common="first"
                className="w-full text-left text-xs text-blue-500 hover:text-blue-700 py-1 pl-1"
                onClick={() => {
                  setSelected(null);
                  setShowNew(true);
                  setTimeout(() => {
                    (document.getElementById('new-common-first') as HTMLElement)?.click();
                  }, 50);
                }}
              >＋ 追加</button>
            </div>

            {/* キャリア別 */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">キャリア別</p>
              {scenarios.filter(s => !s.common_position).map(s => (
                <ScenarioButton key={s.id} s={s} selected={selected} showNew={showNew}
                  onClick={() => { setSelected(s); setShowNew(false); }} />
              ))}
              <button
                className="w-full text-left text-xs text-blue-500 hover:text-blue-700 py-1 pl-1"
                onClick={() => { setSelected(null); setShowNew(true); }}
              >＋ 追加</button>
            </div>

            {/* 共通（最後） */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">共通（最後）</p>
              {scenarios.filter(s => s.common_position === 'last').map(s => (
                <ScenarioButton key={s.id} s={s} selected={selected} showNew={showNew}
                  onClick={() => { setSelected(s); setShowNew(false); }} />
              ))}
              <button
                className="w-full text-left text-xs text-blue-500 hover:text-blue-700 py-1 pl-1"
                onClick={() => { setSelected(null); setShowNew(true); }}
              >＋ 追加</button>
            </div>
          </div>
        </div>

        {/* 右：編集エリア */}
        <div className="col-span-2">
          {showNew ? (
            <NewScenarioForm
              onSaved={(newS) => {
                setScenarios(prev => [...prev, newS]);
                setSelected(newS);
                setShowNew(false);
              }}
            />
          ) : selected ? (
            <ScenarioEditor
              key={selected.id}
              scenario={selected}
              onUpdated={(updated) => {
                setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
                setSelected(updated);
              }}
              onDeleted={() => {
                setScenarios(prev => prev.filter(s => s.id !== selected.id));
                setSelected(null);
              }}
              onDuplicated={(newS) => {
                setScenarios(prev => [...prev, newS].sort((a, b) =>
                  a.carrier.localeCompare(b.carrier) || a.scenario_number.localeCompare(b.scenario_number)
                ));
                setSelected(newS);
              }}
            />
          ) : (
            <div className="bg-white rounded shadow p-6 text-gray-500">
              左からシナリオを選択するか、新規作成してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- シナリオボタン ----
function ScenarioButton({ s, selected, showNew, onClick }: {
  s: MasterScenario; selected: MasterScenario | null; showNew: boolean; onClick: () => void;
}) {
  const isSelected = selected?.id === s.id && !showNew;
  const label = s.common_position
    ? s.title
    : `${s.carrier} × ${s.scenario_number}`;
  return (
    <button
      onClick={onClick}
      className={`w-full p-2 text-left rounded text-sm mb-1 ${
        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
      }`}
    >
      <div className="font-medium">{label}</div>
      {!s.common_position && <div className="text-xs opacity-75">{s.title}</div>}
    </button>
  );
}

// ---- 新規シナリオ作成フォーム ----
function NewScenarioForm({ onSaved }: { onSaved: (s: MasterScenario) => void }) {
  const [form, setForm] = useState({
    carrier: '',
    scenario_number: '①',
    title: '',
    description: '',
    cautions: '',
    common_position: '' as '' | 'first' | 'last',
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!form.common_position && (!form.carrier || !form.scenario_number)) {
      alert('キャリアとシナリオ番号は必須です');
      return;
    }
    if (!form.title) {
      alert('タイトルは必須です');
      return;
    }
    setIsSaving(true);
    try {
      const insertData: any = {
        title: form.title,
        description: form.description,
        cautions: form.cautions,
        common_position: form.common_position || null,
      };
      if (!form.common_position) {
        insertData.carrier = form.carrier;
        insertData.scenario_number = form.scenario_number;
      }
      const { data, error } = await supabase
        .from('scenarios')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      onSaved(data);
    } catch (e: any) {
      alert(e.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="bg-white rounded shadow p-6">
      <h3 className="text-xl font-semibold mb-4">新規シナリオ作成</h3>
      <div className="space-y-4">
        {/* 種別選択 */}
        <div>
          <label className="block text-sm font-medium mb-1">種別</label>
          <select
            value={form.common_position}
            onChange={(e) => setForm({ ...form, common_position: e.target.value as '' | 'first' | 'last' })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">キャリア別（通常）</option>
            <option value="first">共通 - 最初に表示</option>
            <option value="last">共通 - 最後に表示</option>
          </select>
        </div>

        {/* キャリア別の場合のみ表示 */}
        {!form.common_position && (
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">キャリア（例：au, SB）</label>
              <input
                type="text"
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="au"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">シナリオ番号</label>
              <select
                value={form.scenario_number}
                onChange={(e) => setForm({ ...form, scenario_number: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                {['①', '②', '③', '④'].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">タイトル</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">シナリオ内容</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded h-24"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">注意点</label>
          <textarea
            value={form.cautions}
            onChange={(e) => setForm({ ...form, cautions: e.target.value })}
            className="w-full px-3 py-2 border rounded h-16"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '作成する'}
        </button>
      </div>
    </div>
  );
}

// ---- シナリオ編集フォーム ----
function ScenarioEditor({
  scenario,
  onUpdated,
  onDeleted,
  onDuplicated,
}: {
  scenario: MasterScenario;
  onUpdated: (s: MasterScenario) => void;
  onDeleted: () => void;
  onDuplicated: (s: MasterScenario) => void;
}) {
  const [form, setForm] = useState(scenario);
  const [items, setItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [dupForm, setDupForm] = useState({ carrier: '', scenario_number: '①' });
  const [showDupModal, setShowDupModal] = useState(false);

  useEffect(() => {
    setForm(scenario);
    loadItems();
  }, [scenario.id]);

  async function loadItems() {
    const { data } = await supabase
      .from('checklist_items')
      .select(`*, checklist_choices(id, choice_text, choice_order)`)
      .eq('scenario_id', scenario.id)
      .order('item_order');
    setItems(data || []);
  }

  async function handleDuplicate() {
    if (!dupForm.carrier || !dupForm.scenario_number) {
      alert('キャリアとシナリオ番号を入力してください');
      return;
    }
    setIsDuplicating(true);
    try {
      // 新しいシナリオを作成
      const { data: newScenario, error: scenarioError } = await supabase
        .from('scenarios')
        .insert({
          carrier: dupForm.carrier,
          scenario_number: dupForm.scenario_number,
          title: `${form.title}（複製）`,
          description: form.description,
          cautions: form.cautions,
        })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // チェック項目と選択肢を複製
      for (const item of items) {
        const { data: newItem, error: itemError } = await supabase
          .from('checklist_items')
          .insert({
            scenario_id: newScenario.id,
            item_name: item.item_name,
            item_order: item.item_order,
            has_free_text: item.has_free_text || false,
            item_type: item.item_type || 'choice',
          })
          .select()
          .single();

        if (itemError) continue;

        // 選択肢を複製
        const choices = item.checklist_choices || [];
        if (choices.length > 0) {
          await supabase.from('checklist_choices').insert(
            choices.map((c: any) => ({
              item_id: newItem.id,
              choice_text: c.choice_text,
              choice_order: c.choice_order,
            }))
          );
        }
      }

      setShowDupModal(false);
      setDupForm({ carrier: '', scenario_number: '①' });
      onDuplicated(newScenario);
      alert('複製しました');
    } catch (e: any) {
      alert(e.message || '複製に失敗しました');
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleSaveScenario() {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .update({ title: form.title, description: form.description, cautions: form.cautions })
        .eq('id', scenario.id)
        .select()
        .single();
      if (error) throw error;
      onUpdated(data);
      alert('保存しました');
    } catch (e: any) {
      alert(e.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }

  async function addItem(type: 'choice' | 'free_text_only' = 'choice') {
    const newOrder = items.length + 1;
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({
        scenario_id: scenario.id,
        item_name: '新規項目',
        item_order: newOrder,
        has_free_text: false,
        item_type: type,
      })
      .select()
      .single();
    if (!error && data) {
      setItems([...items, { ...data, checklist_choices: [] }]);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('この項目を削除しますか？')) return;
    await supabase.from('checklist_items').delete().eq('id', itemId);
    setItems(items.filter(i => i.id !== itemId));
  }

  return (
    <div className="bg-white rounded shadow p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">
          {scenario.carrier} × {scenario.scenario_number}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setDupForm({ carrier: scenario.carrier, scenario_number: '①' });
              setShowDupModal(true);
            }}
            className="text-purple-600 hover:text-purple-800 text-sm border border-purple-300 px-3 py-1 rounded"
          >
            複製
          </button>
          <button
            onClick={async () => {
              if (!confirm('このシナリオを削除しますか？')) return;
              await supabase.from('scenarios').delete().eq('id', scenario.id);
              onDeleted();
            }}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            削除
          </button>
        </div>
      </div>

      {/* 複製モーダル */}
      {showDupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h4 className="text-lg font-semibold mb-4">シナリオを複製</h4>
            <p className="text-sm text-gray-500 mb-4">
              「{scenario.carrier} × {scenario.scenario_number}」の内容をコピーして新しいシナリオを作成します
            </p>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">新しいキャリア</label>
                <input
                  type="text"
                  value={dupForm.carrier}
                  onChange={(e) => setDupForm({ ...dupForm, carrier: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="SB"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">シナリオ番号</label>
                <select
                  value={dupForm.scenario_number}
                  onChange={(e) => setDupForm({ ...dupForm, scenario_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {['①', '②', '③', '④', '①②', '①③', '①④', '②③', '②④', '③④', '①②③', '②③④', '①②③④'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDupModal(false)}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {isDuplicating ? '複製中...' : '複製する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* シナリオ基本情報 */}
      <div className="space-y-4 mb-6 pb-6 border-b">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">シナリオ内容</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded h-24"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">注意点</label>
          <textarea
            value={form.cautions}
            onChange={(e) => setForm({ ...form, cautions: e.target.value })}
            className="w-full px-3 py-2 border rounded h-16"
          />
        </div>
        <button
          onClick={handleSaveScenario}
          disabled={isSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : 'シナリオを保存'}
        </button>
      </div>

      {/* チェック項目 */}
      <h3 className="text-lg font-semibold mb-4">チェック項目</h3>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <ChecklistItemEditor
            key={item.id}
            item={item}
            index={idx}
            total={items.length}
            onUpdated={(updated) =>
              setItems(items.map(i => i.id === updated.id ? updated : i))
            }
            onDelete={() => deleteItem(item.id)}
            onMoveUp={async () => {
              if (idx === 0) return;
              const newItems = [...items];
              [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
              // item_order を更新
              await supabase.from('checklist_items').update({ item_order: idx }).eq('id', newItems[idx - 1].id);
              await supabase.from('checklist_items').update({ item_order: idx + 1 }).eq('id', newItems[idx].id);
              setItems(newItems);
            }}
            onMoveDown={async () => {
              if (idx === items.length - 1) return;
              const newItems = [...items];
              [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
              await supabase.from('checklist_items').update({ item_order: idx + 1 }).eq('id', newItems[idx].id);
              await supabase.from('checklist_items').update({ item_order: idx + 2 }).eq('id', newItems[idx + 1].id);
              setItems(newItems);
            }}
          />
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => addItem('choice')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            ＋ 選択肢項目を追加
          </button>
          <button
            onClick={() => addItem('free_text_only')}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 text-sm"
          >
            ＋ 自由記述項目を追加
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- チェック項目エディタ ----
function ChecklistItemEditor({
  item,
  index,
  total,
  onUpdated,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: any;
  index: number;
  total: number;
  onUpdated: (item: any) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [localItem, setLocalItem] = useState(item);
  const [isSaving, setIsSaving] = useState(false);

  async function saveItem() {
    setIsSaving(true);
    try {
      // 項目本体を保存
      await supabase
        .from('checklist_items')
        .update({
          item_name: localItem.item_name,
          has_free_text: localItem.has_free_text || false,
          item_type: localItem.item_type || 'choice',
        })
        .eq('id', localItem.id);

      // 選択肢を保存（新規 or 更新）
      for (const choice of localItem.checklist_choices || []) {
        if (choice.id) {
          await supabase
            .from('checklist_choices')
            .update({ choice_text: choice.choice_text })
            .eq('id', choice.id);
        } else {
          const { data } = await supabase
            .from('checklist_choices')
            .insert({
              item_id: localItem.id,
              choice_text: choice.choice_text,
              choice_order: choice.choice_order,
            })
            .select()
            .single();
          if (data) {
            const idx = localItem.checklist_choices.indexOf(choice);
            localItem.checklist_choices[idx] = data;
          }
        }
      }

      onUpdated({ ...localItem });
      alert('保存しました');
    } catch (e: any) {
      alert(e.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteChoice(choiceId: string | undefined, idx: number) {
    if (choiceId) {
      await supabase.from('checklist_choices').delete().eq('id', choiceId);
    }
    const updated = {
      ...localItem,
      checklist_choices: localItem.checklist_choices.filter((_: any, i: number) => i !== idx),
    };
    setLocalItem(updated);
  }

  function addChoice() {
    const updated = {
      ...localItem,
      checklist_choices: [
        ...(localItem.checklist_choices || []),
        {
          choice_text: '新規選択肢',
          choice_order: (localItem.checklist_choices?.length || 0) + 1,
        },
      ],
    };
    setLocalItem(updated);
  }

  return (
    <div className={`border-2 rounded p-4 ${localItem.item_type === 'free_text_only' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
      {/* 項目名 + 種別バッジ + 並び替えボタン */}
      <div className="flex items-center gap-2 mb-3">
        {/* 上下ボタン */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-gray-500 hover:text-gray-800 disabled:opacity-20 leading-none text-lg"
            title="上へ"
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-gray-500 hover:text-gray-800 disabled:opacity-20 leading-none text-lg"
            title="下へ"
          >▼</button>
        </div>
        <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${
          localItem.item_type === 'free_text_only'
            ? 'bg-orange-200 text-orange-800'
            : 'bg-green-200 text-green-800'
        }`}>
          {localItem.item_type === 'free_text_only' ? '自由記述' : '選択肢'}
        </span>
        <input
          type="text"
          value={localItem.item_name}
          onChange={(e) => setLocalItem({ ...localItem, item_name: e.target.value })}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="項目名"
        />
        <button onClick={onDelete} className="text-red-600 hover:text-red-800 text-sm whitespace-nowrap">
          削除
        </button>
      </div>

      {/* 選択肢項目の場合のみ表示 */}
      {localItem.item_type !== 'free_text_only' && (
        <>
          <div className="ml-4 space-y-2 mb-3">
            {(localItem.checklist_choices || []).map((choice: any, idx: number) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={choice.choice_text}
                  onChange={(e) => {
                    const choices = [...localItem.checklist_choices];
                    choices[idx] = { ...choices[idx], choice_text: e.target.value };
                    setLocalItem({ ...localItem, checklist_choices: choices });
                  }}
                  className="flex-1 px-3 py-2 border rounded text-sm"
                  placeholder="選択肢"
                />
                <button
                  onClick={() => deleteChoice(choice.id, idx)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  削除
                </button>
              </div>
            ))}
            <button onClick={addChoice} className="text-sm text-blue-600 hover:text-blue-800">
              ＋ 選択肢を追加
            </button>
          </div>
          <label className="flex items-center gap-2 ml-4 mb-3 text-sm">
            <input
              type="checkbox"
              checked={localItem.has_free_text || false}
              onChange={(e) => setLocalItem({ ...localItem, has_free_text: e.target.checked })}
              className="h-4 w-4"
            />
            「その他（自由記述）」も許可する
          </label>
        </>
      )}

      {/* 自由記述項目のプレビュー */}
      {localItem.item_type === 'free_text_only' && (
        <div className="ml-4 mb-3">
          <div className="px-3 py-2 border rounded bg-white text-sm text-gray-400 italic">
            （テキスト入力エリアが表示されます）
          </div>
        </div>
      )}

      <button
        onClick={saveItem}
        disabled={isSaving}
        className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
      >
        {isSaving ? '保存中...' : '保存'}
      </button>
    </div>
  );
}
