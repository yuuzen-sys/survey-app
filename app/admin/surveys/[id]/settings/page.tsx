'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Member {
  id: string;
  name: string;
  token: string;
}

interface Shop {
  id: string;
  code: string;
  name: string;
  assigned_member_id: string | null;
  color: string;
}

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;
  const [members, setMembers] = useState<Member[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [surveyId]);

  async function loadData() {
    try {
      const [membersRes, shopsRes] = await Promise.all([
        supabase
          .from('survey_members')
          .select('*')
          .eq('survey_id', surveyId),
        supabase
          .from('shops')
          .select('*')
          .eq('survey_id', surveyId),
      ]);

      setMembers(membersRes.data || []);
      setShops(shopsRes.data || []);
    } finally {
      setIsLoading(false);
    }
  }

  async function reassignShop(shopId: string, newMemberId: string) {
    // Check if shop is already reported
    const { data: reports } = await supabase
      .from('survey_reports')
      .select('id')
      .eq('shop_id', shopId);

    if (reports && reports.length > 0) {
      alert('報告済みの店舗は付け替えできません');
      return;
    }

    await supabase
      .from('shops')
      .update({ assigned_member_id: newMemberId || null })
      .eq('id', shopId);

    await loadData();
  }

  async function deleteShop(shopId: string) {
    const { data: reports } = await supabase
      .from('survey_reports')
      .select('id')
      .eq('shop_id', shopId);

    if (reports && reports.length > 0) {
      alert('報告済みの店舗は削除できません');
      return;
    }

    await supabase.from('shops').delete().eq('id', shopId);
    await loadData();
  }

  if (isLoading) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between">
        <h1 className="text-3xl font-bold">設定</h1>
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800"
        >
          ← 戻る
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Members */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-4">調査員一覧</h2>
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="p-3 bg-gray-50 rounded">
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-gray-500 font-mono">{member.token}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Shops */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-4">店舗・担当者設定</h2>
          <div className="space-y-3">
            {shops.map(shop => {
              const assignedMember = members.find(m => m.id === shop.assigned_member_id);
              return (
                <div
                  key={shop.id}
                  className="p-3 border-l-4 rounded"
                  style={{ borderColor: shop.color }}
                >
                  <div className="font-medium">{shop.name}</div>
                  <div className="text-sm text-gray-500">{shop.code}</div>
                  <select
                    value={shop.assigned_member_id || ''}
                    onChange={(e) => reassignShop(shop.id, e.target.value)}
                    className="w-full mt-2 px-2 py-1 border rounded text-sm"
                  >
                    <option value="">未割当</option>
                    {members.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteShop(shop.id)}
                    className="mt-2 text-red-600 hover:text-red-800 text-sm"
                  >
                    削除
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
