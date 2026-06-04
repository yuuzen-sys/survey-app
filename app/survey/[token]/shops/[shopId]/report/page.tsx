'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ChecklistItem {
  id: string;
  item_name: string;
  has_free_text: boolean;
  item_type: 'choice' | 'free_text_only';
  choices: Array<{ id: string; choice_text: string }>;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const shopId = params.shopId as string;
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [responses, setResponses] = useState<Record<string, { choices: string[]; freeText: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shop, setShop] = useState<any>(null);

  useEffect(() => {
    loadChecklistData();
  }, [shopId]);

  async function loadChecklistData() {
    try {
      // Get shop info
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();
      setShop(shopData);

      if (!shopData) throw new Error('Shop not found');

      const carrier = (shopData as any).carrier || '';
      const scenarioKey: string = (shopData as any).scenario_key || '';
      // ⓪も含めて丸数字を抽出
      const numbers = scenarioKey.match(/[①②③④⓪]/g) || [];
      const numberOrder = ['⓪', '①', '②', '③', '④'];

      let sortedScenarios: any[] = [];
      if (numbers.length > 0 && carrier) {
        const { data: scenariosData } = await supabase
          .from('scenarios')
          .select('id, scenario_number')
          .eq('carrier', carrier)
          .in('scenario_number', numbers);
        sortedScenarios = [...(scenariosData || [])].sort(
          (a, b) => numberOrder.indexOf(a.scenario_number) - numberOrder.indexOf(b.scenario_number)
        );
      }

      // 共通（最初）のチェック項目を取得
      const { data: firstCommonScenarios } = await supabase
        .from('scenarios')
        .select('id')
        .eq('common_position', 'first');

      // 共通（最後）のチェック項目を取得
      const { data: lastCommonScenarios } = await supabase
        .from('scenarios')
        .select('id')
        .eq('common_position', 'last');

      async function fetchItems(scenarioId: string) {
        const { data } = await supabase
          .from('checklist_items')
          .select(`id, item_name, has_free_text, item_type, scenario_id,
            checklist_choices(id, choice_text, choice_order)`)
          .eq('scenario_id', scenarioId)
          .order('item_order');
        return (data || []).map(item => ({
          ...item,
          checklist_choices: [...(item.checklist_choices || [])].sort(
            (a: any, b: any) => a.choice_order - b.choice_order
          ),
        }));
      }

      const allItems: any[] = [];

      // 共通（最初）
      for (const s of (firstCommonScenarios || [])) {
        allItems.push(...await fetchItems(s.id));
      }

      // キャリア別シナリオ
      for (const scenario of sortedScenarios) {
        const { data: itemsData } = await supabase
          .from('checklist_items')
          .select(`
            id,
            item_name,
            has_free_text,
            item_type,
            scenario_id,
            checklist_choices (
              id,
              choice_text,
              choice_order
            )
          `)
          .eq('scenario_id', scenario.id)
          .order('item_order');

        if (itemsData) {
          allItems.push(...itemsData.map(item => ({
            ...item,
            checklist_choices: [...(item.checklist_choices || [])].sort(
              (a: any, b: any) => a.choice_order - b.choice_order
            ),
          })));
        }
      }

      // 共通（最後）
      for (const s of (lastCommonScenarios || [])) {
        allItems.push(...await fetchItems(s.id));
      }

      const formattedItems = allItems.map(item => ({
        id: item.id,
        item_name: item.item_name,
        has_free_text: item.has_free_text || false,
        item_type: (item.item_type || 'choice') as 'choice' | 'free_text_only',
        choices: item.checklist_choices || [],
      }));

      setItems(formattedItems);

      const initialResponses: Record<string, { choices: string[]; freeText: string }> = {};
      formattedItems.forEach(item => {
        initialResponses[item.id] = { choices: [], freeText: '' };
      });
      setResponses(initialResponses);

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading checklist:', error);
      setIsLoading(false);
    }
  }

  function handleChoiceSelect(itemId: string, choiceId: string, checked: boolean) {
    setResponses(prev => {
      const updated = { ...prev };
      if (!updated[itemId]) {
        updated[itemId] = { choices: [], freeText: '' };
      }
      if (checked) {
        updated[itemId].choices.push(choiceId);
      } else {
        updated[itemId].choices = updated[itemId].choices.filter(id => id !== choiceId);
      }
      return updated;
    });
  }

  function handleFreeTextChange(itemId: string, text: string) {
    setResponses(prev => {
      const updated = { ...prev };
      if (!updated[itemId]) {
        updated[itemId] = { choices: [], freeText: '' };
      }
      updated[itemId].freeText = text;
      return updated;
    });
  }

  async function handleSubmit() {
    const allSelected = items.every(item => {
      const itemResponses = responses[item.id];
      if (item.item_type === 'free_text_only') {
        return itemResponses && itemResponses.freeText.trim().length > 0;
      }
      const hasChoice = itemResponses && itemResponses.choices.length > 0;
      const hasText = itemResponses && itemResponses.freeText.trim().length > 0;
      return hasChoice || (item.has_free_text && hasText);
    });

    if (!allSelected) {
      alert('全ての項目を選択してください');
      return;
    }

    setIsSaving(true);
    try {
      const { data: memberData } = await supabase
        .from('survey_members')
        .select('id, survey_id')
        .eq('token', token)
        .single();

      if (!memberData) {
        throw new Error('調査員情報が見つかりません');
      }

      const { error } = await supabase
        .from('survey_reports')
        .insert({
          survey_id: memberData.survey_id,
          member_id: memberData.id,
          shop_id: shopId,
          responses,
          status: 'submitted',
        });

      if (error) throw error;

      alert('報告が完了しました');
      router.push(`/survey/${token}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '報告に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="p-4 text-center">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto py-6 px-4">
        <button
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 戻る
        </button>

        <div
          className="rounded-lg shadow p-6 mb-6 text-white"
          style={{ backgroundColor: shop?.color || '#ff6b6b' }}
        >
          <h2 className="text-2xl font-bold">{shop?.name}</h2>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {items.map((item) => (
            <div key={item.id} className="border-b last:border-b-0 pb-4 last:pb-0">
              <p className="font-semibold text-gray-900 mb-3">{item.item_name}</p>

              {item.item_type === 'free_text_only' ? (
                <textarea
                  value={responses[item.id]?.freeText || ''}
                  onChange={(e) => handleFreeTextChange(item.id, e.target.value)}
                  placeholder="内容を入力してください"
                  className="w-full px-3 py-2 border rounded text-sm"
                  rows={3}
                />
              ) : (
                <>
                  <div className="space-y-2 mb-3">
                    {item.choices.map((choice) => (
                      <label key={choice.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={responses[item.id]?.choices.includes(choice.id) || false}
                          onChange={(e) =>
                            handleChoiceSelect(item.id, choice.id, e.target.checked)
                          }
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-3 text-gray-700">{choice.choice_text}</span>
                      </label>
                    ))}
                  </div>

                  {item.has_free_text && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700 mb-2">その他（自由記述）</p>
                      <textarea
                        value={responses[item.id]?.freeText || ''}
                        onChange={(e) => handleFreeTextChange(item.id, e.target.value)}
                        placeholder="内容を入力してください"
                        className="w-full px-3 py-2 border rounded text-sm"
                        rows={2}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 mt-6"
          >
            {isSaving ? '送信中...' : '完了'}
          </button>
        </div>
      </div>
    </div>
  );
}
