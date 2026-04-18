// ================================================================
// API ROUTES — save each section as its own file
// ================================================================

// ── app/api/me/route.js ─────────────────────────────────────────
// GET /api/me — returns current user info + their student name
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getStudentByEmail } from '@/lib/sheets';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const isTeacher = session.user.email === process.env.TEACHER_EMAIL;
  const studentName = isTeacher ? null : await getStudentByEmail(session.user.email);
  return Response.json({
    email:       session.user.email,
    name:        session.user.name,
    image:       session.user.image,
    isTeacher,
    studentName,
  });
}
*/

// ── app/api/portfolio/route.js ──────────────────────────────────
// GET /api/portfolio?student=Name (teacher only) or own portfolio
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getStudentByEmail, getStudentPortfolio } from '@/lib/sheets';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const isTeacher = session.user.email === process.env.TEACHER_EMAIL;
  const { searchParams } = new URL(request.url);
  const requestedStudent = searchParams.get('student');

  let studentName;
  if (isTeacher && requestedStudent) {
    studentName = requestedStudent;
  } else {
    studentName = await getStudentByEmail(session.user.email);
  }

  if (!studentName) return Response.json({ error: 'Student not found' }, { status: 404 });

  try {
    const data = await getStudentPortfolio(studentName);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

// ── app/api/prices/route.js ─────────────────────────────────────
// GET /api/prices         → ticker map  { BTC: { price, change24h } }
// GET /api/prices?full=true → full array with all change columns
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getPriceData } from '@/lib/sheets';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';

  try {
    const data = await getPriceData(full);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

// ── app/api/leaderboard/route.js ────────────────────────────────
// GET /api/leaderboard
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getLeaderboardData } from '@/lib/sheets';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const data = await getLeaderboardData();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

// ── app/api/trade/route.js ──────────────────────────────────────
// POST /api/trade  { action, coin, amountType, amount }
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getStudentByEmail, writeTradeForm } from '@/lib/sheets';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const studentName = await getStudentByEmail(session.user.email);
  if (!studentName) return Response.json({ error: 'Not a registered student' }, { status: 403 });

  const { action, coin, amountType, amount } = await request.json();
  if (!['BUY','SELL'].includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
  if (!coin || !amount || parseFloat(amount) <= 0) return Response.json({ error: 'Invalid coin or amount' }, { status: 400 });

  try {
    const result = await writeTradeForm(studentName, action, coin, amountType || 'Dollar Amount', amount);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

// ── app/api/trade/sellall/route.js ──────────────────────────────
// POST /api/trade/sellall
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getStudentByEmail, writeSellAll } from '@/lib/sheets';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const studentName = await getStudentByEmail(session.user.email);
  if (!studentName) return Response.json({ error: 'Not a registered student' }, { status: 403 });

  try {
    const result = await writeSellAll(studentName);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

// ── app/api/teacher/market-status/route.js ──────────────────────
// GET /api/teacher/market-status
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { sheetsClient } from '@/lib/sheets';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email !== process.env.TEACHER_EMAIL)
    return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const sheets = await sheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `'_Config'!A1:B20`,
    });
    const rows = res.data.values || [];
    const get = (key) => rows.find(r=>r[0]===key)?.[1];

    return Response.json({
      frozen:      get('MARKET_FREEZE') === '1',
      freezeMsg:   get('MARKET_FREEZE_REASON') || '',
      bullRun:     get('BULL_RUN_ACTIVE') === '1',
      bullMult:    get('BULL_RUN_MULTIPLIER') || '2',
      flashSale:   !!get('FLASH_SALE_COIN'),
      flashCoin:   get('FLASH_SALE_COIN') || '',
      dailyLimit:  get('DAILY_LIMIT_ON') === '1',
      limitN:      get('DAILY_LIMIT_N') || '3',
      fee:         get('TRADE_FEE_OVERRIDE') || '0.005',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

// ── app/api/teacher/[action]/route.js ───────────────────────────
// POST /api/teacher/freeze          { reason }
// POST /api/teacher/unfreeze
// POST /api/teacher/bull-run/start  { multiplier }
// POST /api/teacher/bull-run/stop
// POST /api/teacher/flash-sale/start { coin, discountPct }
// POST /api/teacher/flash-sale/stop
// POST /api/teacher/pause
// POST /api/teacher/resume
// POST /api/teacher/post-headline   { headline, url }
// POST /api/teacher/clear-headlines
/*
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { setMarketProperty } from '@/lib/sheets';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.email !== process.env.TEACHER_EMAIL)
    return Response.json({ error: 'Forbidden' }, { status: 403 });

  const action = params.action;
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case 'freeze':
        await setMarketProperty('MARKET_FREEZE', '1');
        await setMarketProperty('MARKET_FREEZE_REASON', body.reason || 'Market temporarily closed');
        return Response.json({ message: '🚫 Market frozen.' });

      case 'unfreeze':
        await setMarketProperty('MARKET_FREEZE', '0');
        await setMarketProperty('MARKET_FREEZE_REASON', '');
        return Response.json({ message: '✓ Market unfrozen.' });

      case 'bull-run/start':
        await setMarketProperty('BULL_RUN_ACTIVE', '1');
        await setMarketProperty('BULL_RUN_MULTIPLIER', String(body.multiplier || 2));
        return Response.json({ message: `🐂 Bull run started at ${body.multiplier}×.` });

      case 'bull-run/stop':
        await setMarketProperty('BULL_RUN_ACTIVE', '0');
        return Response.json({ message: '⏹ Bull run ended.' });

      case 'flash-sale/start':
        await setMarketProperty('FLASH_SALE_COIN', body.coin);
        await setMarketProperty('FLASH_SALE_FACTOR', String(1 - (body.discountPct||20)/100));
        return Response.json({ message: `⚡ Flash sale: ${body.coin} ${body.discountPct}% off.` });

      case 'flash-sale/stop':
        await setMarketProperty('FLASH_SALE_COIN', '');
        return Response.json({ message: '⏹ Flash sale ended.' });

      case 'pause':
        await setMarketProperty('MARKET_FREEZE', '1');
        await setMarketProperty('MARKET_FREEZE_REASON', '⏸ Simulation paused for class discussion');
        return Response.json({ message: '⏸ Simulation paused.' });

      case 'resume':
        await setMarketProperty('MARKET_FREEZE', '0');
        return Response.json({ message: '▶ Simulation resumed.' });

      case 'post-headline':
        await setMarketProperty('NEWS_HEADLINE', body.headline);
        await setMarketProperty('NEWS_HEADLINE_URL', body.url || '');
        return Response.json({ message: '📰 Headline posted.' });

      case 'clear-headlines':
        await setMarketProperty('NEWS_HEADLINE', '');
        return Response.json({ message: '🗑 Headlines cleared.' });

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
*/

export const ROUTE_REFERENCE = true; // prevents empty file error
