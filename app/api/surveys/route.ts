import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * シナリオ列からキャリアを抽出する
 * 例: [D①] → D / [DS①] → DS / [SB③] → SB / [au①③] → au / D⓪ → D / Ⅾ⓪ → D
 * シナリオ列の最初の英字を常にキャリアとして抽出
 */
function extractCarrierFromScenario(scenario: string): string {
  // シナリオ列から最初の英字（1～3文字）を抽出
  // 【D②③】、D②③、D⓪、Ⅾ⓪ など全形式に対応
  const match = scenario.match(/([a-zA-Z]+)/);
  if (match) return match[1];
  return '';
}

/**
 * シナリオ列からシナリオキー（番号の組み合わせ）を抽出する
 * 例: 【au①③】→ ①③ / [D③]... → ③ / 【au②③④】→ ②③④ / D⓪ → ⓪
 * 括弧の有無、⓪にも対応
 */
function extractScenarioKey(scenario: string): string {
  // 丸数字（①②③④⓪）をすべて抽出
  const matches = scenario.match(/[①②③④⓪]/g);
  return matches ? matches.join('') : '';
}

// POST /api/surveys - Excel data import and process
export async function POST(req: NextRequest) {
  try {
    const { data, userId } = await req.json();

    if (!data || !userId) {
      return NextResponse.json({ error: 'Missing data or userId' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    // 固定ログイン時（userId が UUID でない場合）は user 作成をスキップ
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      // ユーザーが存在しなければ作成
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (!existingUser) {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        const email = authUser?.user?.email || 'user@example.com';
        const { error: userError } = await supabase
          .from('users')
          .insert({ id: userId, email, name: 'ユーザー' });
        if (userError) {
          return NextResponse.json({ error: userError.message }, { status: 500 });
        }
      }
    }

    // タブ区切りデータをパース（列：調査員名、店舗コード、店舗名、シナリオ）
    const lines = data.trim().split('\n');
    const memberMap = new Map<string, { name: string; token: string }>();
    const shopRows: {
      code: string;
      name: string;
      memberName: string;
      scenario: string;
      carrier: string;
      scenarioNumber: string;
    }[] = [];

    for (const line of lines) {
      const cols = line.split('\t');
      const memberName = cols[0]?.trim();
      const shopCode = cols[1]?.trim();
      const shopName = cols[2]?.trim();
      const scenario = cols[3]?.trim();

      // シナリオが空の場合もショップとして登録（シナリオなし）
      if (!memberName || !shopCode || !shopName) continue;

      if (!memberMap.has(memberName)) {
        memberMap.set(memberName, { name: memberName, token: uuidv4() });
      }

      // キャリアとシナリオキーはシナリオ列から抽出
      const carrier = scenario ? extractCarrierFromScenario(scenario) : '';
      const scenarioKey = scenario ? extractScenarioKey(scenario) : '';

      // DEBUG
      if (shopCode.includes('量販')) {
        console.log(`[DEBUG ${shopCode}] scenario="${scenario}" → carrier="${carrier}", scenarioKey="${scenarioKey}"`);
      }

      shopRows.push({ code: shopCode, name: shopName, memberName, scenario: scenario || '', carrier, scenarioNumber: scenarioKey });
    }

    if (shopRows.length === 0) {
      return NextResponse.json({ error: 'データが空です。列：調査員名、店舗コード、店舗名、シナリオ（シナリオ列は空でも可）' }, { status: 400 });
    }

    // 調査セッションを作成
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .insert({ week: weekStart.toISOString().split('T')[0], created_by: null })
      .select()
      .single();

    if (surveyError) {
      return NextResponse.json({ error: surveyError.message }, { status: 500 });
    }
    const surveyId = surveyData.id;

    // 調査員を作成
    const memberInserts = Array.from(memberMap.values()).map(m => ({
      survey_id: surveyId,
      name: m.name,
      token: m.token,
    }));
    const { data: membersData, error: membersError } = await supabase
      .from('survey_members')
      .insert(memberInserts)
      .select();
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const memberIdMap = new Map(membersData.map(m => [m.name, m.id]));

    // キャリア別カラー
    const carrierColors: Record<string, string> = {
      au:     '#FF9500', // オレンジ
      SB:     '#2563EB', // ブルー
      sb:     '#2563EB', // ブルー
      docomo: '#E60012', // 赤
      D:      '#E60012', // 赤
      DS:     '#E60012', // 赤
    };
    function getCarrierColor(carrier: string): string {
      return carrierColors[carrier] || '#78909C';
    }

    // 店舗を作成（carrier・scenario_key・color も保存）
    const shopInserts = shopRows.map(shop => ({
      survey_id: surveyId,
      code: shop.code,
      name: shop.name,
      assigned_member_id: memberIdMap.get(shop.memberName),
      carrier: shop.carrier || null,
      scenario_key: shop.scenarioNumber || null,
      color: getCarrierColor(shop.carrier),
    }));
    const { data: shopsData, error: shopsError } = await supabase
      .from('shops')
      .insert(shopInserts)
      .select('id, code, name, carrier, scenario_key, color, assigned_member_id');
    if (shopsError) {
      return NextResponse.json({ error: shopsError.message }, { status: 500 });
    }

    // シナリオは管理画面で手動管理するため、インポート時には自動作成しない
    // scenario_key（例: ①③④）は shops テーブルに保存済み

    // フルパス URL を生成（Render 環境では RENDER_EXTERNAL_URL を優先）
    const origin = process.env.RENDER_EXTERNAL_URL
      || req.headers.get('x-forwarded-proto') + '://' + req.headers.get('x-forwarded-host')
      || new URL(req.url).origin;

    return NextResponse.json({
      surveyId,
      members: membersData.map(m => ({
        id: m.id,
        name: m.name,
        token: m.token,
        url: `${origin}/survey/${m.token}`,
      })),
    });
  } catch (error) {
    console.error('Error in POST /api/surveys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/surveys - Get survey details
export async function GET(req: NextRequest) {
  try {
    const surveyId = req.nextUrl.searchParams.get('id');
    if (!surveyId) {
      return NextResponse.json({ error: 'Missing survey ID' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data: survey, error } = await supabase
      .from('surveys')
      .select(`*, survey_members(id, name, token, created_at), shops(id, code, name, color, assigned_member_id)`)
      .eq('id', surveyId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error in GET /api/surveys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
