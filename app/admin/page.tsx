'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

interface Survey {
  id: string;
  week: string;
  created_at: string;
  member_count?: number;
  shop_count?: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [excelData, setExcelData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/admin/login');
        return;
      }
      setUser(currentUser);
      loadSurveys();
    } catch {
      router.push('/admin/login');
    }
  }

  async function loadSurveys() {
    const { data } = await supabase
      .from('surveys')
      .select(`
        id, week, created_at,
        survey_members(id),
        shops(id)
      `)
      .order('created_at', { ascending: false });

    setSurveys((data || []).map((s: any) => ({
      id: s.id,
      week: s.week,
      created_at: s.created_at,
      member_count: s.survey_members?.length || 0,
      shop_count: s.shops?.length || 0,
    })));
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
        body: JSON.stringify({ data: excelData, userId: user.id }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '処理に失敗しました');
      }
      const result = await response.json();
      setExcelData('');
      await loadSurveys();
      setTimeout(() => router.push(`/admin/surveys/${result.surveyId}`), 300);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedSurveyIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedSurveyIds.size === surveys.length) {
      setSelectedSurveyIds(new Set());
    } else {
      setSelectedSurveyIds(new Set(surveys.map(s => s.id)));
    }
  }

  async function handleDelete() {
    if (selectedSurveyIds.size === 0) return;
    if (!confirm(`${selectedSurveyIds.size}件の調査セッションを削除しますか？\n（関連する調査員・店舗・報告データも削除されます）`)) return;
    setIsDeleting(true);
    try {
      for (const id of selectedSurveyIds) {
        await supabase.from('surveys').delete().eq('id', id);
      }
      setSelectedSurveyIds(new Set());
      await loadSurveys();
    } catch {
      alert('削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  }

  if (!user) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">覆面調査管理システム</h1>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/admin/login'); }}
            className="text-gray-600 hover:text-gray-900"
          >
            ログアウト
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Excel インポート */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">今週の調査データを振分</h2>
          <p className="text-sm text-gray-500 mb-3">
            Excelから4列（調査員名・店舗コード・店舗名・シナリオ）をコピペしてください
          </p>
          <textarea
            value={excelData}
            onChange={(e) => setExcelData(e.target.value)}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            placeholder={"山崎\t【au04】\tau style 新宿店\t【au①③】現SB..."}
          />
          <button
            onClick={handleProcessExcel}
            disabled={isLoading}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
          >
            {isLoading ? '処理中...' : '振分実行'}
          </button>
        </div>

        {/* 調査セッション一覧 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">調査セッション一覧</h2>
            <div className="flex gap-2">
              {selectedSurveyIds.size > 0 && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded disabled:opacity-50"
                >
                  {isDeleting ? '削除中...' : `選択した${selectedSurveyIds.size}件を削除`}
                </button>
              )}
              <button
                onClick={loadSurveys}
                className="text-gray-500 hover:text-gray-700 text-sm border px-3 py-1 rounded"
              >
                更新
              </button>
            </div>
          </div>

          {surveys.length === 0 ? (
            <p className="text-gray-500 text-sm">調査セッションがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedSurveyIds.size === surveys.length && surveys.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-2 text-left">週</th>
                  <th className="py-2 text-left">調査員数</th>
                  <th className="py-2 text-left">店舗数</th>
                  <th className="py-2 text-left">作成日時</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {surveys.map(survey => (
                  <tr key={survey.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selectedSurveyIds.has(survey.id)}
                        onChange={() => toggleSelect(survey.id)}
                      />
                    </td>
                    <td className="py-2 font-medium">{survey.week}</td>
                    <td className="py-2">{survey.member_count}名</td>
                    <td className="py-2">{survey.shop_count}店舗</td>
                    <td className="py-2 text-gray-500">
                      {new Date(survey.created_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => router.push(`/admin/surveys/${survey.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        管理 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
