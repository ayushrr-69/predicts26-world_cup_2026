import type { Team } from '../components/MatchCard';

export interface ApiMatch {
  id: string;
  round: string;
  teamA: Team | null;
  teamB: Team | null;
  status: 'FT' | 'Live' | 'Upcoming' | 'TBD';
  actualScoreA?: string;
  actualScoreB?: string;
  penaltyScoreA?: string;
  penaltyScoreB?: string;
  homeScorers?: string[];
  awayScorers?: string[];
  /** ISO date string, e.g. "2026-06-29" */
  date?: string;
}

/**
 * Candidate URLs tried in order — first valid response wins.
 * The direct API returns Access-Control-Allow-Origin: * so the browser
 * can call it without a proxy. allorigins is a backup in case of downtime.
 */
const API_ENDPOINTS = [
  { url: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json', wrap: false },
];

// Map English country names (from API) → our internal 3-letter codes
const NAME_TO_CODE: Record<string, string> = {
  'Mexico': 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czech Republic': 'CZE',
  'Canada': 'CAN',
  'Bosnia and Herzegovina': 'BIH',
  'Bosnia & Herzegovina': 'BIH',
  'Australia': 'AUS',
  'Turkey': 'TUR',
  'Qatar': 'QAT',
  'Switzerland': 'SUI',
  'United States': 'USA',
  'USA': 'USA',
  'Paraguay': 'PAR',
  'Germany': 'GER',
  'Curaçao': 'CUW',
  'Sweden': 'SWE',
  'Tunisia': 'TUN',
  'Netherlands': 'NED',
  'Japan': 'JPN',
  'France': 'FRA',
  'Senegal': 'SEN',
  'Iraq': 'IRQ',
  'Norway': 'NOR',
  'England': 'ENG',
  'Croatia': 'CRO',
  'Ghana': 'GHA',
  'Panama': 'PAN',
  'Morocco': 'MAR',
  'Haiti': 'HAI',
  'Scotland': 'SCO',
  'Spain': 'ESP',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  'Uruguay': 'URU',
  'Belgium': 'BEL',
  'Egypt': 'EGY',
  'Iran': 'IRN',
  'New Zealand': 'NZL',
  'Brazil': 'BRA',
  'Portugal': 'POR',
  'Democratic Republic of the Congo': 'COD',
  'DR Congo': 'COD',
  'Colombia': 'COL',
  'Uzbekistan': 'UZB',
  'Argentina': 'ARG',
  'Algeria': 'ALG',
  'Austria': 'AUT',
  'Jordan': 'JOR',
  'Ivory Coast': 'CIV',
  'Ecuador': 'ECU',
};

// Round type mapping from API "type" field → our internal round label
const TYPE_TO_ROUND: Record<string, string> = {
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'Final',
  third: 'Third',
};

function makeTeam(nameEn: string): Team | null {
  if (!nameEn) return null;
  const code = NAME_TO_CODE[nameEn];
  if (!code) return null;
  return { name: nameEn, code, colorKey: code.toLowerCase() };
}

// Map World Cup 2026 Stadium IDs to their respective Summer local offsets (in UTC format)
const STADIUM_OFFSETS: Record<string, string> = {
  '1': '-06:00', // Estadio Azteca (Mexico City) - CST (UTC-6)
  '2': '-06:00', // Estadio Akron (Guadalajara) - CST (UTC-6)
  '3': '-06:00', // Estadio BBVA (Monterrey) - CST (UTC-6)
  '4': '-05:00', // AT&T Stadium (Dallas) - CDT (UTC-5)
  '5': '-05:00', // NRG Stadium (Houston) - CDT (UTC-5)
  '6': '-05:00', // Arrowhead Stadium (Kansas City) - CDT (UTC-5)
  '7': '-04:00', // Mercedes-Benz Stadium (Atlanta) - EDT (UTC-4)
  '8': '-04:00', // Hard Rock Stadium (Miami) - EDT (UTC-4)
  '9': '-04:00', // Gillette Stadium (Boston) - EDT (UTC-4)
  '10': '-04:00', // Lincoln Financial Field (Philadelphia) - EDT (UTC-4)
  '11': '-04:00', // MetLife Stadium (New York/New Jersey) - EDT (UTC-4)
  '12': '-04:00', // BMO Field (Toronto) - EDT (UTC-4)
  '13': '-07:00', // BC Place (Vancouver) - PDT (UTC-7)
  '14': '-07:00', // Lumen Field (Seattle) - PDT (UTC-7)
  '15': '-07:00', // Levi's Stadium (San Francisco) - PDT (UTC-7)
  '16': '-07:00', // SoFi Stadium (Los Angeles) - PDT (UTC-7)
};

/** Parse "MM/DD/YYYY HH:MM" + stadiumId → ISO datetime string with proper local offset */
function parseLocalDate(localDate: string, stadiumId?: string): string | undefined {
  if (!localDate) return undefined;
  const [datePart, timePart = '12:00'] = localDate.split(' ');
  const [mm, dd, yyyy] = datePart.split('/');
  if (!mm || !dd || !yyyy) return undefined;
  const [hh, min] = timePart.split(':');
  const pad = (s: string) => s.padStart(2, '0');
  
  // Look up offset for the stadium (fallback to New York -04:00 if undefined)
  const offset = stadiumId ? (STADIUM_OFFSETS[stadiumId] ?? '-04:00') : '-04:00';
  return `${yyyy}-${pad(mm)}-${pad(dd)}T${pad(hh || '12')}:${pad(min || '00')}:00${offset}`;
}

/**
 * Format a date to human-readable format.
 * If time is present, converts it to the user's local timezone (e.g., IST)
 * and formats as "Jun 28, 5:30 PM". Otherwise, falls back to date-only "Jun 28".
 */
export function formatMatchDate(dateVal?: string): string {
  if (!dateVal) return 'TBA';
  // Already formatted like "Jun 29" — return as-is
  if (/^[A-Za-z]{3}\s+\d{1,2}$/.test(dateVal.trim())) return dateVal.trim();
  
  const hasTime = dateVal.includes('T');
  const d = new Date(hasTime ? dateVal : dateVal + 'T12:00:00Z');
  if (isNaN(d.getTime())) return 'TBA';

  if (hasTime) {
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    return `${dateStr}, ${timeStr} IST`;
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}


/** Attempt each URL in order; return the first that returns a valid response */
async function fetchApiData(): Promise<any | null> {
  for (const endpoint of API_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      
      // Bust cache for proxies
      const targetUrl = endpoint.wrap 
        ? endpoint.url + encodeURIComponent(`?t=${Date.now()}`)
        : endpoint.url;

      const response = await fetch(targetUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      // allorigins wraps response in {contents: "<json string>"}
      if (endpoint.wrap) {
        const proxyData = await response.json();
        if (proxyData.contents) {
          const parsed = JSON.parse(proxyData.contents);
          if (typeof window !== 'undefined') localStorage.setItem('wc_api_cache', JSON.stringify(parsed));
          return parsed;
        }
      } else {
        const parsed = await response.json();
        if (typeof window !== 'undefined') localStorage.setItem('wc_api_cache', JSON.stringify(parsed));
        return parsed;
      }
    } catch (error) {
      // Ignore and try the next endpoint
    }
  }
  return null;
}

// --- DATA CORRECTION LAYER ---
// The free worldcup26.ir API occasionally makes group assignment mistakes (e.g. placing Belgium in M80 instead of M82).
// This dictionary allows us to intercept the raw API data and forcefully correct specific matches before they hit the UI.
const MATCH_OVERRIDES: Record<string, { home_team_name_en?: string; away_team_name_en?: string; home_team_id?: string; away_team_id?: string }> = {};

let nameFixes: Record<string, string> = {
  'Hri Kin': 'Harry Kane'
};

export function updateNameFixes(fixes: Record<string, string>) {
  nameFixes = { ...nameFixes, ...fixes };
}

function parseScorers(str?: any): string[] {
  if (!str || str === 'null' || str === '{}') return [];

  const applyFixes = (arr: any[]) => {
    if (!Array.isArray(arr)) return [];
    
    return arr
      .filter(item => item != null && item !== '')
      .map(item => {
        let fixed = String(item);
        if (nameFixes && typeof nameFixes === 'object') {
          for (const [bad, good] of Object.entries(nameFixes)) {
            if (fixed.includes(bad)) {
              fixed = fixed.replace(bad, good);
            }
          }
        }
        return fixed;
      });
  };

  if (Array.isArray(str)) {
    return applyFixes(str);
  }

  if (typeof str !== 'string') {
    return [];
  }

  try {
    const stripped = str.replace(/^\{/, '').replace(/\}$/, '');
    if (!stripped) return [];
    return applyFixes(JSON.parse(`[${stripped}]`));
  } catch (e) {
    const matches = str.match(/"([^"]+)"/g);
    return matches ? applyFixes(matches.map(s => s.replace(/(^"|"$)/g, ''))) : [];
  }
}

/** Transform a raw API game object → ApiMatch */
function transformGame(g: any): ApiMatch {
  // Apply manual overrides if they exist for this match
  const override = MATCH_OVERRIDES[g.id];
  if (override) {
    if (override.home_team_name_en !== undefined) g.home_team_name_en = override.home_team_name_en;
    if (override.home_team_id !== undefined) g.home_team_id = override.home_team_id;
    if (override.away_team_name_en !== undefined) g.away_team_name_en = override.away_team_name_en;
    if (override.away_team_id !== undefined) g.away_team_id = override.away_team_id;
  }

  const round = TYPE_TO_ROUND[g.type] ?? g.type.toUpperCase();
  const teamA = g.home_team_id !== '0' && g.home_team_id !== 0
    ? makeTeam(g.home_team_name_en)
    : null;
  const teamB = g.away_team_id !== '0' && g.away_team_id !== 0
    ? makeTeam(g.away_team_name_en)
    : null;

  const isFinished = g.finished === 'TRUE';
  const isLive = g.time_elapsed === 'live';
  let status: ApiMatch['status'] = 'TBD';
  if (isFinished) status = 'FT';
  else if (isLive) status = 'Live';
  else if (teamA || teamB) status = 'Upcoming';

  return {
    id: String(g.id),
    round,
    teamA,
    teamB,
    status,
    actualScoreA: isFinished && g.home_score != null && g.home_score !== 'null' ? String(g.home_score) : undefined,
    actualScoreB: isFinished && g.away_score != null && g.away_score !== 'null' ? String(g.away_score) : undefined,
    penaltyScoreA: isFinished && g.home_penalty_score != null && g.home_penalty_score !== 'null' ? String(g.home_penalty_score) : undefined,
    penaltyScoreB: isFinished && g.away_penalty_score != null && g.away_penalty_score !== 'null' ? String(g.away_penalty_score) : undefined,
    homeScorers: parseScorers(g.home_scorers),
    awayScorers: parseScorers(g.away_scorers),
    date: parseLocalDate(g.local_date, String(g.stadium_id)),
  };
}

/** Transform an openfootball game object → ApiMatch */
function transformOpenFootballGame(g: any): ApiMatch {
  const override = MATCH_OVERRIDES[g.num];
  if (override) {
    if (override.home_team_name_en !== undefined) g.team1 = override.home_team_name_en;
    if (override.away_team_name_en !== undefined) g.team2 = override.away_team_name_en;
  }

  let roundStr = g.round;
  let roundCode = 'TBD';
  if (roundStr === 'Round of 32') roundCode = 'R32';
  else if (roundStr === 'Round of 16') roundCode = 'R16';
  else if (roundStr === 'Quarter-final') roundCode = 'QF';
  else if (roundStr === 'Semi-final') roundCode = 'SF';
  else if (roundStr === 'Final') roundCode = 'Final';
  else if (roundStr === 'Match for third place') roundCode = 'Third';

  const isTbdA = typeof g.team1 === 'string' && (g.team1.startsWith('W') || g.team1.startsWith('L'));
  const isTbdB = typeof g.team2 === 'string' && (g.team2.startsWith('W') || g.team2.startsWith('L'));

  const teamA = !isTbdA ? makeTeam(g.team1) : null;
  const teamB = !isTbdB ? makeTeam(g.team2) : null;

  const score = g.score || {};
  let status: ApiMatch['status'] = 'Upcoming';
  
  const formatGoals = (goalsArr?: any[]) => {
    if (!Array.isArray(goalsArr)) return [];
    return goalsArr.map(goal => {
       const minStr = String(goal.minute).replace(/'/g, '');
       return `${goal.name} ${minStr}'`;
    });
  };

  const homeScorers = parseScorers(formatGoals(g.goals1));
  const awayScorers = parseScorers(formatGoals(g.goals2));

  let actualScoreA = undefined;
  let actualScoreB = undefined;
  let penaltyScoreA = undefined;
  let penaltyScoreB = undefined;

  if (score.ft && score.ft.length === 2) {
    status = 'FT';
    actualScoreA = String(score.ft[0]);
    actualScoreB = String(score.ft[1]);
    
    if (score.p && score.p.length === 2) {
      penaltyScoreA = String(score.p[0]);
      penaltyScoreB = String(score.p[1]);
    }
  } else if (!isTbdA && !isTbdB && !teamA && !teamB) {
    status = 'TBD';
  } else if (isTbdA || isTbdB) {
    status = 'TBD';
  }

  let isoDate = undefined;
  if (g.date) {
    if (g.time) {
      const match = g.time.match(/(\d{1,2}:\d{2})\s+UTC([+-]\d+)/);
      if (match) {
        const timePart = match[1];
        let offset = match[2];
        if (offset.length === 2 || offset.length === 3) {
          offset = offset + ':00';
          if (offset.length === 5) {
             offset = offset[0] + '0' + offset.substring(1);
          }
        }
        isoDate = `${g.date}T${timePart}:00${offset}`;
      } else {
        isoDate = `${g.date}T12:00:00Z`;
      }
    } else {
      isoDate = `${g.date}T12:00:00Z`;
    }
  }

  return {
    id: String(g.num),
    round: roundCode,
    teamA,
    teamB,
    status,
    actualScoreA,
    actualScoreB,
    penaltyScoreA,
    penaltyScoreB,
    homeScorers,
    awayScorers,
    date: isoDate,
  };
}

export const apiService = {
  /**
   * Fetches all knockout round matches.
   * Tries the live API (with CORS proxy fallback), then local matches.json.
   */
  async fetchAllMatches(): Promise<ApiMatch[]> {
    // 1. Try live API
    try {
      const data = await fetchApiData();
      if (data && data.matches) {
        return data.matches
          .filter((g: any) => ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'].includes(g.round))
          .map(transformOpenFootballGame);
      } else if (data && data.games) {
        // Fallback for old cache structure
        return data.games
          .filter((g: any) => ['r32', 'r16', 'qf', 'sf', 'final'].includes(g.type))
          .map(transformGame);
      }
    } catch (err) {
      console.warn('Live API fetch failed:', err);
    }

    // 2. Fall back to localStorage cache first
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('wc_api_cache');
        if (cached) {
          const data = JSON.parse(cached);
          if (data && data.matches) {
            return data.matches
              .filter((g: any) => ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'].includes(g.round))
              .map(transformOpenFootballGame);
          } else if (data && data.games) {
            return data.games
              .filter((g: any) => ['r32', 'r16', 'qf', 'sf', 'final'].includes(g.type))
              .map(transformGame);
          }
        }
      }
    } catch (err) {
      console.warn('Cache fallback failed:', err);
    }

    // 3. Fall back to local matches.json as last resort
    try {
      const res = await fetch('/data/matches.json');
      if (!res.ok) throw new Error('matches.json not found');
      const data = await res.json();
      return data.matches as ApiMatch[];
    } catch {
      return [];
    }
  },

  /** Re-fetches for live polling, returning full match objects to update teams and scores. */
  async fetchLiveScores(): Promise<Record<string, ApiMatch>> {
    try {
      const matches = await apiService.fetchAllMatches();
      const results: Record<string, ApiMatch> = {};
      matches.forEach((m) => {
        results[m.id] = m;
      });
      return results;
    } catch {
      return {};
    }
  },
};
