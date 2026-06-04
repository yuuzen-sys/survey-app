'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Shop {
  id: string;
  code: string;
  name: string;
  color: string;
  completed?: boolean;
}

interface Member {
  id: string;
  name: string;
}

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;
  const [shops, setShops] = useState<Shop[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [showTransport, setShowTransport] = useState(false);
  const [transportAmount, setTransportAmount] = useState('');
  const [transportNotes, setTransportNotes] = useState('');
  const [transportSubmitted, setTransportSubmitted] = useState(false);
  const [isSavingTransport, setIsSavingTransport] = useState(false);

  useEffect(() => {
    loadSurveyData();
  }, [token]);

  async function loadSurveyData() {
    try {
      // Get member by token
      const { data: memberData, error: memberError } = await supabase
        .from('survey_members')
        .select('id, name, survey_id')
        .eq('token', token)
        .single();

      if (memberError || !memberData) {
        setError('有効なURLではありません');
        return;
      }

      setMember({ id: memberData.id, name: memberData.name });

      // 交通費提出済み確認
      const { data: transportData } = await supabase
        .from('transportation_reports')
        .select('*')
        .eq('survey_id', memberData.survey_id)
        .eq('member_id', memberData.id)
        .maybeSingle();
      if (transportData) {
        setTransportSubmitted(true);
        setTransportAmount(String(transportData.amount));
        setTransportNotes(transportData.notes || '');
      }

      // Get shops for this survey
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('id, code, name, color')
        .eq('survey_id', memberData.survey_id)
        .eq('assigned_member_id', memberData.id);

      if (shopsError) throw shopsError;

      // 完了済み店舗を取得
      const { data: reportsData } = await supabase
        .from('survey_reports')
        .select('shop_id')
        .eq('member_id', memberData.id)
        .eq('survey_id', memberData.survey_id);

      const completedShopIds = new Set((reportsData || []).map(r => r.shop_id));

      setShops((shopsData || []).map(shop => ({
        ...shop,
        color: completedShopIds.has(shop.id) ? '#A5D6A7' : shop.color,
        completed: completedShopIds.has(shop.id),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTransportSubmit() {
    if (!transportAmount || isNaN(Number(transportAmount))) {
      alert('金額を正しく入力してください');
      return;
    }
    if (!member) return;
    setIsSavingTransport(true);
    try {
      const { data: memberData } = await supabase
        .from('survey_members')
        .select('survey_id')
        .eq('token', token)
        .single();
      if (!memberData) throw new Error('調査員情報が見つかりません');

      // 既存レコードを確認
      const { data: existing } = await supabase
        .from('transportation_reports')
        .select('id')
        .eq('survey_id', memberData.survey_id)
        .eq('member_id', member.id)
        .maybeSingle();

      if (existing) {
        // 既存レコードを更新
        const { error } = await supabase
          .from('transportation_reports')
          .update({ amount: Number(transportAmount), notes: transportNotes })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('transportation_reports')
          .insert({
            survey_id: memberData.survey_id,
            member_id: member.id,
            amount: Number(transportAmount),
            notes: transportNotes,
          });
        if (error) throw error;
      }

      setTransportSubmitted(true);
      setShowTransport(false);
      alert('交通費を提出しました');
    } catch (e: any) {
      alert('送信に失敗しました：' + (e?.message || ''));
    } finally {
      setIsSavingTransport(false);
    }
  }

  if (isLoading) {
    return <div className="p-4 text-center">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!member) {
    return <div className="p-4">調査員情報が見つかりません</div>;
  }

  if (selectedShop) {
    return (
      <ShopDetail
        token={token}
        shopId={selectedShop}
        memberId={member.id}
        onBack={() => setSelectedShop(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto py-6 px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold">{member.name}さん</h1>
          <p className="text-gray-600 mt-2">本日の担当店舗</p>
        </div>

        <div className="space-y-3">
          {shops.length === 0 ? (
            <p className="text-center text-gray-500">本日の担当店舗がありません</p>
          ) : (
            shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => setSelectedShop(shop.id)}
                className="w-full p-4 rounded-lg text-left font-medium transition flex items-center justify-between"
                style={{
                  backgroundColor: shop.color,
                  color: shop.completed ? '#2E7D32' : 'white',
                }}
              >
                <div>
                  <p className="font-bold">{shop.name}</p>
                  <p className="text-sm opacity-75">{shop.code}</p>
                </div>
                {shop.completed && (
                  <span className="text-sm font-bold bg-green-700 text-white px-2 py-1 rounded">
                    ✓ 完了
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          {transportSubmitted && !showTransport ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-green-700 font-medium">✓ 交通費提出済み</p>
                <button
                  onClick={() => setShowTransport(true)}
                  className="text-sm text-blue-600 hover:underline"
                >修正する</button>
              </div>
              <p className="text-gray-600 text-sm">金額：¥{Number(transportAmount).toLocaleString()}</p>
              {transportNotes && <p className="text-gray-500 text-sm">{transportNotes}</p>}
            </div>
          ) : showTransport ? (
            <div>
              <h3 className="font-bold mb-3">交通費提出</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">合計金額（円）</label>
                  <input
                    type="number"
                    value={transportAmount}
                    onChange={(e) => setTransportAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-lg"
                    placeholder="1500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">詳細（※電車とバスは分けて、ICカード運賃で記載）</label>
                  <textarea
                    value={transportNotes}
                    onChange={(e) => setTransportNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    rows={3}
                    placeholder="詳細を入力してください"
                  />
                  <p className="text-xs text-gray-500 mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                    例）初台～つつじが丘　209円{'\n'}つつじが丘駅北口～神代植物公園　230円
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTransport(false)}
                    className="flex-1 py-2 border rounded-lg text-gray-600"
                  >キャンセル</button>
                  <button
                    onClick={handleTransportSubmit}
                    disabled={isSavingTransport}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50"
                  >{isSavingTransport ? '送信中...' : '送信'}</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowTransport(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg"
            >
              交通費提出
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, label }: { scenario: any; label: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-4">
      <h3 className="font-semibold text-lg mb-2">
        {label}
        <span className="text-sm font-normal text-gray-500 ml-2">{scenario.title}</span>
      </h3>
      {scenario.description && (
        <p className="text-gray-700 whitespace-pre-wrap text-sm">{scenario.description}</p>
      )}
      {scenario.cautions && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="font-semibold text-sm text-yellow-800 mb-1">注意点</p>
          <p className="text-sm text-yellow-700">{scenario.cautions}</p>
        </div>
      )}
    </div>
  );
}

function ShopDetail({
  token,
  shopId,
  memberId,
  onBack,
}: {
  token: string;
  shopId: string;
  memberId: string;
  onBack: () => void;
}) {
  const [shop, setShop] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [commonFirstScenarios, setCommonFirstScenarios] = useState<any[]>([]);
  const [commonLastScenarios, setCommonLastScenarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadShopData();
  }, [shopId]);

  async function loadShopData() {
    // 新しい店舗を読み込む時に state を初期化（前の店舗のデータが残るのを防ぐ）
    setIsLoading(true);
    setScenarios([]);
    setCommonFirstScenarios([]);
    setCommonLastScenarios([]);

    try {
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();

      if (shopError) throw shopError;
      setShop(shopData);

      // DBに保存済みの carrier を使用
      const carrier = shopData.carrier || null;

      if (carrier) {
        // scenario_key から個々の番号を分解（⓪含む）
        const scenarioKey: string = shopData.scenario_key || '';
        const numbers = scenarioKey.match(/[①②③④⓪]/g) || [];
        const numberOrder = ['⓪', '①', '②', '③', '④'];

        if (numbers.length > 0) {
          const { data: scenariosData } = await supabase
            .from('scenarios')
            .select('*')
            .eq('carrier', carrier)
            .in('scenario_number', numbers);

          const sorted = [...(scenariosData || [])].sort(
            (a, b) => numberOrder.indexOf(a.scenario_number) - numberOrder.indexOf(b.scenario_number)
          );
          setScenarios(sorted);
        }
      }

      // 共通シナリオを取得（全店舗共通）
      const { data: firstData } = await supabase
        .from('scenarios')
        .select('*')
        .eq('common_position', 'first');
      const { data: lastData } = await supabase
        .from('scenarios')
        .select('*')
        .eq('common_position', 'last');
      setCommonFirstScenarios(firstData || []);
      setCommonLastScenarios(lastData || []);

    } catch (error) {
      console.error('Error loading shop data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (!shop) {
    return <div className="p-4">店舗データが見つかりません</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto py-6 px-4">
        <button
          onClick={onBack}
          className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 戻る
        </button>

        <div
          className="rounded-lg shadow p-6 mb-6 text-white"
          style={{ backgroundColor: shop.color }}
        >
          <h2 className="text-2xl font-bold">{shop.name}</h2>
          <p className="text-sm opacity-90 mt-1">{shop.code}</p>
        </div>

        {/* 共通（最初）シナリオ */}
        {commonFirstScenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} label="共通" />
        ))}

        {/* キャリア別シナリオ */}
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} label={`シナリオ${scenario.scenario_number}`} />
        ))}

        {/* 共通（最後）シナリオ */}
        {commonLastScenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} label="共通" />
        ))}

        <button
          onClick={() => {
            // Navigate to report form
            window.location.href = `/survey/${token}/shops/${shopId}/report`;
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg"
        >
          調査実行
        </button>
      </div>
    </div>
  );
}
