'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProgressPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;
  const [members, setMembers] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    loadData();
    // リアルタイム更新
    const sub = supabase
      .channel(`progress:${surveyId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'survey_reports',
        filter: `survey_id=eq.${surveyId}`
      }, () => loadData())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [surveyId]);

  async function loadData() {
    const [membersRes, shopsRes, reportsRes] = await Promise.all([
      supabase.from('survey_members').select('*').eq('survey_id', surveyId).order('created_at'),
      supabase.from('shops').select('*').eq('survey_id', surveyId).order('created_at'),
      supabase.from('survey_reports').select('*').eq('survey_id', surveyId),
    ]);
    setMembers(membersRes.data || []);
    setShops(shopsRes.data || []);
    setReports(reportsRes.data || []);
    setIsLoading(false);
  }

  function getReport(memberId: string, shopId: string) {
    return reports.find(r => r.member_id === memberId && r.shop_id === shopId);
  }

  async function handleCardClick(report: any, shop: any, member: any) {
    if (!report) return;
    // 詳細モーダルを開く
    setSelectedReport({ report, shop, member });
  }

  async function markAsChecked(reportId: string) {
    await supabase
      .from('survey_reports')
      .update({ status: 'checked', checked_at: new Date().toISOString() })
      .eq('id', reportId);
    setSelectedReport(null);
    await loadData();
  }

  if (isLoading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">進捗管理</h1>
        <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800">← 戻る</button>
      </div>

      {/* 凡例 */}
      <div className="flex gap-6 text-sm mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-8 rounded border-2 border-gray-200 bg-white"></div>
          <span>未報告</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-8 rounded border-4 border-blue-500 bg-white"></div>
          <span>報告済（クリックで確認）</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-8 rounded bg-gray-200"></div>
          <span>確認済</span>
        </div>
      </div>

      {/* 調査員ごとのカード一覧 */}
      <div className="space-y-8">
        {members.map(member => {
          const memberShops = shops.filter(s => s.assigned_member_id === member.id);
          if (memberShops.length === 0) return null;
          return (
            <div key={member.id} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">{member.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {memberShops.map(shop => {
                  const report = getReport(member.id, shop.id);
                  const status = report?.status || 'pending';
                  return (
                    <ShopCard
                      key={shop.id}
                      shop={shop}
                      status={status}
                      onClick={() => handleCardClick(report, shop, member)}
                    />
                  );
                })}
              </div>
              {/* 交通費 */}
              <TransportCell surveyId={surveyId} memberId={member.id} memberName={member.name} />
            </div>
          );
        })}
      </div>

      {/* 報告詳細モーダル */}
      {selectedReport && (
        <ReportModal
          report={selectedReport.report}
          shop={selectedReport.shop}
          member={selectedReport.member}
          onClose={() => setSelectedReport(null)}
          onChecked={() => markAsChecked(selectedReport.report.id)}
        />
      )}
    </div>
  );
}

// ---- 店舗カード ----
function ShopCard({ shop, status, onClick }: {
  shop: any;
  status: 'pending' | 'submitted' | 'checked';
  onClick: () => void;
}) {
  const baseStyle = "rounded-lg p-3 cursor-pointer transition-all text-sm";

  if (status === 'checked') {
    return (
      <div className={`${baseStyle} bg-gray-100 text-gray-400 border-2 border-gray-200`} onClick={onClick}>
        <div className="font-medium truncate">{shop.name}</div>
        <div className="text-xs opacity-70">{shop.code}</div>
        <div className="text-xs mt-1 text-gray-400">✓ 確認済</div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div
        className={`${baseStyle} bg-white text-gray-800 hover:opacity-80`}
        style={{ border: `4px solid ${shop.color || '#4CAF50'}` }}
        onClick={onClick}
      >
        <div className="font-bold truncate">{shop.name}</div>
        <div className="text-xs opacity-70">{shop.code}</div>
        <div className="text-xs mt-1 font-semibold text-green-600">● 報告済</div>
      </div>
    );
  }

  return (
    <div
      className={`${baseStyle} border-2 border-gray-200 bg-white text-gray-500`}
    >
      <div className="font-medium truncate">{shop.name}</div>
      <div className="text-xs opacity-70">{shop.code}</div>
      <div className="text-xs mt-1 text-gray-300">未報告</div>
    </div>
  );
}

// ---- 交通費セル ----
function TransportCell({ surveyId, memberId, memberName }: {
  surveyId: string; memberId: string; memberName: string;
}) {
  const [transport, setTransport] = useState<any>(null);

  useEffect(() => {
    supabase
      .from('transportation_reports')
      .select('*')
      .eq('survey_id', surveyId)
      .eq('member_id', memberId)
      .maybeSingle()
      .then(({ data }) => setTransport(data));
  }, [surveyId, memberId]);

  return (
    <div className="mt-3 pt-3 border-t text-sm text-gray-600">
      <div>交通費：¥{transport ? Number(transport.amount).toLocaleString() : '未提出'}</div>
      {transport?.notes && (
        <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap bg-gray-50 p-2 rounded">
          {transport.notes}
        </div>
      )}
    </div>
  );
}

// ---- 報告詳細モーダル ----
function ReportModal({ report, shop, member, onClose, onChecked }: {
  report: any; shop: any; member: any;
  onClose: () => void; onChecked: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [report.id]);

  async function loadItems() {
    // DBに保存済みの carrier を使用（shop.code からの抽出は不要）
    const carrier = shop.carrier || '';
    const scenarioKey: string = shop.scenario_key || '';
    // ⓪も含めて丸数字を抽出
    const numbers = scenarioKey.match(/[①②③④⓪]/g) || [];
    const numberOrder = ['⓪', '①', '②', '③', '④'];

    const allItems: any[] = [];

    // 共通（最初）
    const { data: firstScenarios } = await supabase
      .from('scenarios').select('id').eq('common_position', 'first');
    for (const s of (firstScenarios || [])) {
      const { data } = await supabase
        .from('checklist_items')
        .select('*, checklist_choices(id, choice_text, choice_order)')
        .eq('scenario_id', s.id).order('item_order');
      allItems.push(...(data || []));
    }

    // キャリア別
    if (carrier && numbers.length > 0) {
      const { data: scenarios } = await supabase
        .from('scenarios').select('id, scenario_number')
        .eq('carrier', carrier).in('scenario_number', numbers);
      const sorted = [...(scenarios || [])].sort(
        (a, b) => numberOrder.indexOf(a.scenario_number) - numberOrder.indexOf(b.scenario_number)
      );
      for (const s of sorted) {
        const { data } = await supabase
          .from('checklist_items')
          .select('*, checklist_choices(id, choice_text, choice_order)')
          .eq('scenario_id', s.id).order('item_order');
        allItems.push(...(data || []));
      }
    }

    // 共通（最後）
    const { data: lastScenarios } = await supabase
      .from('scenarios').select('id').eq('common_position', 'last');
    for (const s of (lastScenarios || [])) {
      const { data } = await supabase
        .from('checklist_items')
        .select('*, checklist_choices(id, choice_text, choice_order)')
        .eq('scenario_id', s.id).order('item_order');
      allItems.push(...(data || []));
    }

    setItems(allItems);
    setIsLoading(false);
  }

  const responses = report.responses || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div
          className="p-6 rounded-t-xl text-white"
          style={{ backgroundColor: shop.color || '#78909C' }}
        >
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{shop.name}</h2>
              <p className="text-sm opacity-90">{shop.code} ／ {member.name}</p>
            </div>
            <button onClick={onClose} className="text-white opacity-75 hover:opacity-100 text-2xl">✕</button>
          </div>
          <p className="text-xs opacity-75 mt-2">
            報告日時：{new Date(report.submitted_at || report.created_at).toLocaleString('ja-JP')}
          </p>
        </div>

        {/* 回答内容 */}
        <div className="p-6">
          {isLoading ? (
            <p className="text-center text-gray-500">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-500 text-sm">チェック項目がありません</p>
          ) : (
            <div className="space-y-5">
              {items.map(item => {
                const resp = responses[item.id];
                const selectedChoiceIds: string[] = resp?.choices || [];
                const freeText: string = resp?.freeText || '';
                const choices = [...(item.checklist_choices || [])].sort(
                  (a: any, b: any) => a.choice_order - b.choice_order
                );

                return (
                  <div key={item.id} className="border-b pb-4 last:border-0">
                    <p className="font-semibold text-gray-800 mb-2">{item.item_name}</p>

                    {item.item_type === 'free_text_only' ? (
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                        {freeText || <span className="text-gray-400">（未入力）</span>}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {choices.map((c: any) => {
                          const checked = selectedChoiceIds.includes(c.id);
                          return (
                            <div key={c.id} className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${checked ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-400'}`}>
                              <span>{checked ? '☑' : '☐'}</span>
                              <span>{c.choice_text}</span>
                            </div>
                          );
                        })}
                        {freeText && (
                          <div className="mt-1 text-sm bg-gray-50 p-2 rounded">
                            <span className="font-medium">その他：</span>{freeText}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-6 pt-0 flex gap-3 justify-end border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
          >
            閉じる
          </button>
          {report.status !== 'checked' && (
            <button
              onClick={onChecked}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              確認済みにする
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
