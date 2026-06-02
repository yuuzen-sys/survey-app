'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface SurveyMember {
  id: string;
  name: string;
  token: string;
  url: string;
}

interface Shop {
  id: string;
  code: string;
  name: string;
}

export default function SurveyDashboard() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;
  const [excelData, setExcelData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<SurveyMember[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadSurveyData();
  }, [surveyId]);

  async function loadSurveyData() {
    try {
      const { data: membersData } = await supabase
        .from('survey_members')
        .select('id, name, token')
        .eq('survey_id', surveyId);

      setMembers(
        (membersData || []).map(m => ({
          ...m,
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/survey/${m.token}`,
        }))
      );

      const { data: shopsData } = await supabase
        .from('shops')
        .select('id, code, name')
        .eq('survey_id', surveyId);

      setShops(shopsData || []);
    } catch (error) {
      console.error('Error loading survey:', error);
    }
  }

  async function handleProcessExcel() {
    if (!excelData.trim()) {
      alert('Excelデータを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: excelData,
          userId: (await supabase.auth.getSession()).data.session?.user.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to process');
      setExcelData('');
      await loadSurveyData();
      alert('処理が完了しました');
    } catch (error) {
      alert('処理に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }

  async function copyToClipboard(url: string, index: number) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      alert('コピーに失敗しました');
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">調査管理</h1>
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800"
        >
          ← 戻る
        </button>
      </div>

      {/* Excel Import */}
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Excel データをインポート</h2>
        <textarea
          value={excelData}
          onChange={(e) => setExcelData(e.target.value)}
          className="w-full h-32 px-3 py-2 border rounded mb-4"
          placeholder="調査員名  店舗コード  店舗名  シナリオ"
        />
        <button
          onClick={handleProcessExcel}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '処理中...' : '処理実行'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* URLs */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-4">調査員URL</h2>
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-gray-500">調査員がいません</p>
            ) : (
              members.map((member, idx) => (
                <div key={member.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div>
                    <p className="font-medium">{member.name}さん</p>
                    <p className="text-xs text-gray-500 font-mono">{member.url}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(member.url, idx)}
                    className="bg-gray-200 hover:bg-gray-300 text-sm px-3 py-1 rounded"
                  >
                    {copiedIndex === idx ? 'コピー済' : 'コピー'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Management Links */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-4">管理機能</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/admin/surveys/${surveyId}/scenarios`)}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-left"
            >
              📝 シナリオ・チェック項目管理
            </button>
            <button
              onClick={() => router.push(`/admin/surveys/${surveyId}/progress`)}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-left"
            >
              📊 進捗管理
            </button>
            <button
              onClick={() => router.push(`/admin/surveys/${surveyId}/settings`)}
              className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 text-left"
            >
              ⚙️ 店舗・調査員設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
