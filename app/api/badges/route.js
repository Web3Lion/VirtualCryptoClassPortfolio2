import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStudentByEmail, sheetsClient } from '@/lib/sheets';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// All badge definitions — mirrors the Apps Script getBadgeDefs()
const BADGE_DEFS = [
  { id:'first_trade',    cat:'milestone',   emoji:'🥇', name:'First Trade',         hint:'Execute your first trade' },
  { id:'active_trader',  cat:'milestone',   emoji:'⚡', name:'Active Trader',        hint:'Complete 10 trades' },
  { id:'power_trader',   cat:'milestone',   emoji:'🔥', name:'Power Trader',         hint:'Complete 25 trades' },
  { id:'whale',          cat:'milestone',   emoji:'🐳', name:'Whale',                hint:'Net $2,000 gain on a single trade' },
  { id:'doubled_up',     cat:'milestone',   emoji:'💰', name:'Doubled Up',           hint:'Double your money on a single investment' },
  { id:'triple_threat',  cat:'milestone',   emoji:'🎰', name:'Triple Threat',        hint:'Triple your money on a single investment' },
  { id:'first_profit',   cat:'performance', emoji:'🌱', name:'First Profit',         hint:'Make money on your first sell' },
  { id:'ten_pct',        cat:'performance', emoji:'🚀', name:'10% Club',             hint:'Portfolio hits +10% return' },
  { id:'diamond_hands',  cat:'performance', emoji:'💎', name:'Diamond Hands',        hint:'Portfolio hits +25% return' },
  { id:'to_the_moon',    cat:'performance', emoji:'🌕', name:'To The Moon',          hint:'Portfolio hits +50% return' },
  { id:'portfolio_x2',   cat:'performance', emoji:'🔱', name:'Portfolio Doubled',    hint:'Portfolio hits +100% return' },
  { id:'bought_dip',     cat:'performance', emoji:'📉', name:'Bought The Dip',       hint:'Buy after -10% drop, sell profitably' },
  { id:'diversified',    cat:'strategy',    emoji:'🌈', name:'Diversified',          hint:'Hold 4+ different coins at once' },
  { id:'sharpshooter',   cat:'strategy',    emoji:'🎯', name:'Sharpshooter',         hint:'3 consecutive profitable sells' },
  { id:'sniper',         cat:'strategy',    emoji:'🏹', name:'Sniper',               hint:'5 consecutive profitable sells' },
  { id:'hodler',         cat:'strategy',    emoji:'🧘', name:'HODLer',               hint:'Hold a coin 7+ days, sell profitably' },
  { id:'stop_loss_pro',  cat:'strategy',    emoji:'✂️', name:'Stop Loss Pro',        hint:'Cut a loss before -15% drop' },
  { id:'bot_copycat',    cat:'strategy',    emoji:'🤖', name:'Bot Copycat',          hint:'Mirror a bot trade within 30 min' },
  { id:'analyst',        cat:'learning',    emoji:'📝', name:'Analyst',              hint:'Write trade notes on 5 trades' },
  { id:'researcher',     cat:'learning',    emoji:'📖', name:'Researcher',           hint:'Write trade notes on 15 trades' },
  { id:'due_diligence',  cat:'learning',    emoji:'🔍', name:'Due Diligence',        hint:'Write a note longer than 50 characters' },
  { id:'first_watch',    cat:'learning',    emoji:'👀', name:'First Watch',          hint:'Set your first watchlist price alert' },
  { id:'sector_pro',     cat:'strategy',    emoji:'🗂️', name:'Sector Pro',           hint:'Hold coins in 3+ different sectors' },
  { id:'patient_investor',cat:'strategy',   emoji:'💤', name:'Patient Investor',     hint:'Go 3+ days without trading, then profit' },
  { id:'eager_investor', cat:'milestone',   emoji:'📅', name:'Eager Investor',       hint:'Trade every day for 5 days straight' },
  { id:'bull_rider',     cat:'situational', emoji:'🐂', name:'Bull Rider',           hint:'Hold during a bull run and profit' },
  { id:'flash_deal',     cat:'situational', emoji:'⚡', name:'Flash Deal',            hint:'Buy a coin during a flash sale' },
  { id:'news_trader',    cat:'situational', emoji:'📰', name:'News Trader',          hint:'Trade within 30 min of a headline' },
  { id:'crash_survivor', cat:'situational', emoji:'🌊', name:'Crash Survivor',       hint:'Portfolio drops 15%+, then recovers' },
  { id:'comeback_kid',   cat:'performance', emoji:'🔄', name:'Comeback Kid',         hint:'Recover from last place to top 3' },
  { id:'champion',       cat:'simulation',  emoji:'🏆', name:'Class Champion',       hint:'Finish 1st in the simulation' },
  { id:'most_improved',  cat:'simulation',  emoji:'📊', name:'Most Improved',        hint:'Biggest week-over-week gain' },
  { id:'beat_the_bot',   cat:'simulation',  emoji:'🤖', name:'Beat The Bot',         hint:'Finish above Satoshi Botomoto' },
  { id:'fee_conscious',  cat:'simulation',  emoji:'💸', name:'Fee Conscious',        hint:'10+ trades with total fees under $50' },
];

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
    const sheets = await sheetsClient();

    // Badge store is in col AB (28) on the student sheet, starting at row 2
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${studentName}'!AB1:AF60`,
    });

    const rows = res.data.values || [];
    const store = {};

    // Row 1 is header, data starts at row 2
    rows.slice(1).forEach(r => {
      if (r[0]) store[r[0]] = r[4] || ''; // id → earnedDate
    });

    // Merge defs with earned status
    const badges = BADGE_DEFS.map(def => ({
      ...def,
      earned:    !!store[def.id],
      earnedDate: store[def.id] || null,
    }));

    const earnedCount = badges.filter(b => b.earned).length;

    return Response.json({ badges, earnedCount, total: badges.length, studentName });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
