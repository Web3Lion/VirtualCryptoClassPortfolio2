import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function sheetsClient() {
  const auth = await getAuth();
  return google.sheets({ version: 'v4', auth });
}

export async function getStudentPortfolio(studentName) {
  const sheets = await sheetsClient();

  const [summaryRes, holdingsRes, historyRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${studentName}'!B2:B8` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${studentName}'!A41:H140` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${studentName}'!J41:R300` }),
  ]);

  const sv = summaryRes.data.values || [];
  const [startCash, cash, holdingsVal, totalVal, pl, returnPct, fees] = sv.map(r => r[0]);

  return {
    summary: { startCash, cash, holdingsVal, totalVal, pl, returnPct, fees },
    holdings: (holdingsRes.data.values || []).filter(r => r[0]),
    history:  (historyRes.data.values  || []).filter(r => r[0]),
  };
}

export async function getLeaderboardData() {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'🏆 Leaderboard'!A1:M60`,
  });
  const rows = res.data.values || [];
  if (!rows.length) return [];

  const c = s => String(s || '').replace(/[$,%]/g, '').trim();
  return rows.slice(1).map(row => ({
    rank:      row[0],
    name:      row[1]?.replace(/^🤖\s*/, '') || '',
    isBot:     row[1]?.includes('🤖') || false,
    total:     c(row[2]),
    cash:      c(row[3]),
    holdings:  c(row[4]),
    pl:        c(row[5]),
    returnPct: c(row[6]),
    fees:      c(row[7]),
    coinCount: row[8],
    bestTrade: row[9],
    streak:    row[10]?.match(/\d+/)?.[0] || '0',
    streakType: row[10]?.includes('win') ? 'win' : 'loss',
    bestStreak: row[11]?.match(/\d+/)?.[0] || '0',
  })).filter(r => r.name && r.name !== '🔗 Quick Links');
}

export async function getPriceData(full = false) {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'Crypto Prices'!A2:H200`,
  });
  const rows = res.data.values || [];

  if (full) {
    return rows.filter(r => r[1]).map((r, i) => ({
      rank:      i + 1,
      ticker:    r[1],
      price:     r[2]?.replace(/[$,]/g, ''),
      change1h:  r[3]?.replace(/[+%]/g, ''),
      change3h:  r[4]?.replace(/[+%]/g, ''),
      change24h: r[5]?.replace(/[+%]/g, ''),
      change7d:  r[6]?.replace(/[+%]/g, ''),
      updatedAt: r[7],
      sector:    getSector(r[1]),
    }));
  }

  const map = {};
  rows.filter(r => r[1]).forEach(r => {
    map[r[1]] = {
      price:     r[2]?.replace(/[$,]/g, ''),
      change24h: r[5]?.replace(/[+%]/g, ''),
    };
  });
  return map;
}

export async function getStudentByEmail(email) {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'Students'!A2:B60`,
  });
  const rows = res.data.values || [];
  const match = rows.find(r => r[1]?.toLowerCase().trim() === email.toLowerCase().trim());
  return match?.[0] || null;
}

export async function writeTradeForm(studentName, action, coin, amountType, amount) {
  const auth = await getAuth(); // your existing auth helper
  const script = google.script({ version: 'v1', auth });
  
  // First write the trade form values
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${studentName}'!A15:D15`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[action, coin, amountType, amount]] },
  });

  // Then call executeTrade directly via Apps Script API
  const result = await script.scripts.run({
    scriptId: SCRIPT_ID,
    requestBody: {
      function: 'executeTradeForStudent',
      parameters: [studentName],
      devMode: false,
    },
  });

  if (result.data.error) {
    throw new Error(result.data.error.details?.[0]?.errorMessage || 'Script execution failed');
  }

  return { success: true };
}

export async function writeSellAll(studentName) {
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${studentName}'!E16`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[true]] },
  });
  return { success: true };
}

export async function setMarketProperty(key, value) {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'_Config'!A1:B100`,
  });
  const rows = res.data.values || [];
  const rowIdx = rows.findIndex(r => r[0] === key);
  if (rowIdx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'_Config'!B${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'_Config'!A:B`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[key, value]] },
    });
  }
}

function getSector(symbol) {
  const map = {
    BTC: '🔵 Layer 1', ETH: '🔵 Layer 1', SOL: '🔵 Layer 1', ADA: '🔵 Layer 1',
    AVAX: '🔵 Layer 1', DOT: '🔵 Layer 1', ATOM: '🔵 Layer 1', NEAR: '🔵 Layer 1',
    MATIC: '⚡ Layer 2', ARB: '⚡ Layer 2', OP: '⚡ Layer 2',
    DOGE: '🐸 Memecoin', SHIB: '🐸 Memecoin', PEPE: '🐸 Memecoin', BONK: '🐸 Memecoin',
    USDT: '💵 Stablecoin', USDC: '💵 Stablecoin', DAI: '💵 Stablecoin',
    UNI: '🏦 DeFi', AAVE: '🏦 DeFi', MKR: '🏦 DeFi', CRV: '🏦 DeFi',
    LINK: '🔧 Infrastructure', RNDR: '🤖 AI / Data', FET: '🤖 AI / Data',
    SAND: '🎮 Gaming/NFT', MANA: '🎮 Gaming/NFT', AXS: '🎮 Gaming/NFT',
    BNB: '🏛 Exchange Token', OKB: '🏛 Exchange Token',
  };
  return map[symbol] || '📦 Other';
}
