import { useEffect, useRef, useState } from 'react';
import { 
  Trophy, 
  Settings, 
  Bell, 
  Plus, 
  Menu, 
  ChevronRight,
  CheckCircle,
  Lock,
  LayoutDashboard,
  BookOpen,
  ChevronDown,
  LogOut,
  X
} from 'lucide-react';
import { MatchCard } from './components/MatchCard';
import type { Team } from './components/MatchCard';
import { apiService, formatMatchDate } from './services/api';
import { authService } from './services/firebase';
import type { AuthUser } from './services/firebase';

interface PredictionMatch {
  id: string;        // bracket position id: m1-m16, r16_1-r16_8, etc.
  apiId?: string;    // real API match id for polling (e.g. '73', '74')
  teamA: Team | null;
  teamB: Team | null;
  scoreA: string;
  scoreB: string;
  status: 'locked' | 'open' | 'correct' | 'incorrect';
  actualScoreA?: string;
  actualScoreB?: string;
  penaltyScoreA?: string;
  penaltyScoreB?: string;
  date?: string;     // ISO date string from API: '2026-06-29'
}

// Initial Round of 32 Matchups
const initialR32Matches: PredictionMatch[] = Array(16).fill(null).map((_, i) => ({
  id: `m${i + 1}`,
  teamA: null,
  teamB: null,
  scoreA: '',
  scoreB: '',
  status: 'open',
}));function Fifa26Logo() {
  return (
    <img 
      src="/fifa-26-logo.svg" 
      alt="FIFA World Cup 2026 Logo" 
      className="h-9 w-auto flex-shrink-0 ml-1.5 select-none"
    />
  );
}


// Derive flag URL from team code (mirrors flagMap in MatchCard)
const flagMap: Record<string, string> = {
  USA: 'us', NED: 'nl', ENG: 'gb-eng', SEN: 'sn', ARG: 'ar', AUS: 'au',
  FRA: 'fr', POL: 'pl', BRA: 'br', GER: 'de', CAN: 'ca', BEL: 'be',
  MEX: 'mx', ESP: 'es', POR: 'pt', URU: 'uy', ITA: 'it', SUI: 'ch',
  CRO: 'hr', JPN: 'jp', MAR: 'ma', COL: 'co', DEN: 'dk', TUN: 'tn',
  KOR: 'kr', GHA: 'gh', ECU: 'ec', IRN: 'ir', CMR: 'cm', SRB: 'rs',
  SWE: 'se', UKR: 'ua', RSA: 'za', BIH: 'ba', CIV: 'ci', NOR: 'no',
  // Additional 2026 nations from API
  MX: 'mx', CZE: 'cz', PAR: 'py', QAT: 'qa', TUR: 'tr', CUW: 'cw',
  NZL: 'nz', CPV: 'cv', KSA: 'sa', HAI: 'ht', SCO: 'gb-sct', PAN: 'pa',
  ALG: 'dz', AUT: 'at', JOR: 'jo', IRQ: 'iq', COD: 'cd', UZB: 'uz', EGY: 'eg',
};
const getFlagUrl = (code?: string) =>
  code && flagMap[code] ? `https://flagcdn.com/w40/${flagMap[code]}.png` : null;


function App() {
  const [activeTab, setActiveTab] = useState<'bracket' | 'list' | 'leagues'>('bracket');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'dashboard' | 'leaderboard' | 'settings' | 'rules'>('dashboard');
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState('R32');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginUsername, setLoginUsername] = useState('Sophia Perez');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [settingsName, setSettingsName] = useState('');
  const [settingsUsername, setSettingsUsername] = useState('');
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [profileSetupName, setProfileSetupName] = useState('');
  const [profileSetupUsername, setProfileSetupUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [leaguesList, setLeaguesList] = useState<any[]>([]);
  const [rawLeagueRoster, setRawLeagueRoster] = useState<any[]>([]);
  const [activeLeagueMembers, setActiveLeagueMembers] = useState<any[]>([]);
  const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
  const [showJoinLeagueModal, setShowJoinLeagueModal] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinLeagueCode, setJoinLeagueCode] = useState('');
  const [isCreatingLeague, setIsCreatingLeague] = useState(false);
  const [isJoiningLeague, setIsJoiningLeague] = useState(false);
  const [createdLeagueCode, setCreatedLeagueCode] = useState<string | null>(null);
  const [createdLeagueNameValue, setCreatedLeagueNameValue] = useState('');
  const [joinedLeagueNameValue, setJoinedLeagueNameValue] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [viewingBracketUser, setViewingBracketUser] = useState<string | null>(null);
  const [viewingBracketUserId, setViewingBracketUserId] = useState<string | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });
  const [notify48h, setNotify48h] = useState(() => localStorage.getItem('wc_notify48h') !== 'false');
  const [notify5h, setNotify5h] = useState(() => localStorage.getItem('wc_notify5h') !== 'false');
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => JSON.parse(localStorage.getItem('wc_dismissed_notifs') || '[]'));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bracket state management
  const [r32Matches, setR32Matches] = useState<PredictionMatch[]>(initialR32Matches);
  const [r16Matches, setR16Matches] = useState<PredictionMatch[]>(
    Array(8).fill(null).map((_, i) => ({
      id: `r16_${i + 1}`,
      teamA: null,
      teamB: null,
      scoreA: '',
      scoreB: '',
      status: 'open',

    }))
  );
  const [qfMatches, setQfMatches] = useState<PredictionMatch[]>(
    Array(4).fill(null).map((_, i) => ({
      id: `qf_${i + 1}`,
      teamA: null,
      teamB: null,
      scoreA: '',
      scoreB: '',
      status: 'open',

    }))
  );
  const [sfMatches, setSfMatches] = useState<PredictionMatch[]>(
    Array(2).fill(null).map((_, i) => ({
      id: `sf_${i + 1}`,
      teamA: null,
      teamB: null,
      scoreA: '',
      scoreB: '',
      status: 'open',

    }))
  );
  const [finalMatch, setFinalMatch] = useState<PredictionMatch>({
    id: 'final',
    teamA: null,
    teamB: null,
    scoreA: '',
    scoreB: '',
    status: 'open',

  });

  const handleTopTabChange = (tabId: 'bracket' | 'list' | 'leagues') => {
    setSidebarTab('dashboard');
    setActiveTab(tabId);
    setSelectedLeague(null);
    if (tabId === 'bracket' || tabId === 'list') {
      setViewingBracketUser(null);
      setViewingBracketUserId(null);
    }
  };

  const getUserScore = (matchId: string, team: 'A' | 'B', username: string | null, viewedUserId?: string | null) => {
    if (!username) return '';
    const isCurrent = currentUser && (
      (viewedUserId && viewedUserId === currentUser.uid) ||
      (username.trim().toLowerCase() === currentUser.displayName?.trim().toLowerCase()) ||
      (username.trim().toLowerCase() === currentUser.username?.trim().toLowerCase()) ||
      (username.trim().toLowerCase() === 'sophia perez')
    );

    const m = [...r32Matches, ...r16Matches, ...qfMatches, ...sfMatches, finalMatch].find(x => x.id === matchId || x.apiId === matchId);

    if (isCurrent) {
      return team === 'A' ? m?.scoreA ?? '' : m?.scoreB ?? '';
    }
    
    const member = activeLeagueMembers.find(memberObj => 
      (viewedUserId && memberObj.uid === viewedUserId) ||
      memberObj.name?.trim().toLowerCase() === username.trim().toLowerCase() ||
      memberObj.username?.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (!member || !member.predictions) return '';

    const p = (m?.apiId ? member.predictions[m.apiId] : null) || member.predictions[matchId];
    return p ? (team === 'A' ? p.scoreA : p.scoreB) : '';
  };



  const getMatchWinner = (match: { teamA: Team | null, teamB: Team | null, actualScoreA?: string, actualScoreB?: string, penaltyScoreA?: string, penaltyScoreB?: string }): Team | null => {
    if (!match.teamA || !match.teamB) return null;
    if (match.actualScoreA !== undefined && match.actualScoreB !== undefined) {
      const actA = parseInt(match.actualScoreA);
      const actB = parseInt(match.actualScoreB);
      if (!isNaN(actA) && !isNaN(actB)) {
        if (actA > actB) return match.teamA;
        if (actB > actA) return match.teamB;
        if (match.penaltyScoreA !== undefined && match.penaltyScoreB !== undefined) {
          const penA = parseInt(match.penaltyScoreA);
          const penB = parseInt(match.penaltyScoreB);
          if (!isNaN(penA) && !isNaN(penB)) {
            if (penA > penB) return match.teamA;
            if (penB > penA) return match.teamB;
          }
        }
        return match.teamA;
      }
    }
    return null;
  };

  const getMatchPoints = (matchId: string, scoreA: string, scoreB: string, actualScoreA?: string, actualScoreB?: string, username?: string | null): number | null => {
    if (scoreA === '' || scoreB === '') return null;
    if (actualScoreA === undefined || actualScoreB === undefined) return null;
    
    const predA = parseInt(scoreA);
    const predB = parseInt(scoreB);
    if (isNaN(predA) || isNaN(predB)) return null;

    const actA = parseInt(actualScoreA);
    const actB = parseInt(actualScoreB);
    if (isNaN(actA) || isNaN(actB)) return null;

    if (predA === actA && predB === actB) {
      const membersList = activeLeagueMembers;
      const userToCompare = username;
      if (userToCompare && membersList.length > 0) {
        let anyoneElseExact = false;
        for (const member of membersList) {
          if (member.name === userToCompare) continue;
          const mScoreA = getUserScore(matchId, 'A', member.name, member.uid);
          const mScoreB = getUserScore(matchId, 'B', member.name, member.uid);
          const mPredA = parseInt(mScoreA);
          const mPredB = parseInt(mScoreB);
          if (!isNaN(mPredA) && !isNaN(mPredB) && mPredA === actA && mPredB === actB) {
            anyoneElseExact = true;
            break;
          }
        }
        if (!anyoneElseExact) {
          return 4;
        }
      }
      return 3;
    }

    const predWinner = predA > predB ? 'A' : predB > predA ? 'B' : 'Draw';
    const actWinner = actA > actB ? 'A' : actB > actA ? 'B' : 'Draw';
    if (predWinner === actWinner && predWinner !== 'Draw') {
      return 1;
    }

    return 0;
  };

  const getDynamicUserMatches = (username: string | null, viewedUserId?: string | null) => {
    const isCurrent = !username || (currentUser && (
      (viewedUserId && viewedUserId === currentUser.uid) ||
      username.trim().toLowerCase() === currentUser.displayName?.trim().toLowerCase() || 
      username.trim().toLowerCase() === currentUser.username?.trim().toLowerCase() || 
      username.trim().toLowerCase() === 'sophia perez'
    ));
    if (isCurrent) {
      return { r32: r32Matches, r16: r16Matches, qf: qfMatches, sf: sfMatches, fn: finalMatch };
    }

    const getDynamicStatus = (_matchId: string, scoreA: string, scoreB: string, actualScoreA?: string, actualScoreB?: string): 'locked' | 'open' | 'correct' | 'incorrect' => {
      const predA = parseInt(scoreA);
      const predB = parseInt(scoreB);
      if (isNaN(predA) || isNaN(predB)) return 'open';
      if (actualScoreA === undefined || actualScoreB === undefined) return 'locked';
      
      const actA = parseInt(actualScoreA);
      const actB = parseInt(actualScoreB);
      if (isNaN(actA) || isNaN(actB)) return 'locked';
      
      const predWinner = predA > predB ? 'A' : predB > predA ? 'B' : 'Draw';
      const actWinner = actA > actB ? 'A' : actB > actA ? 'B' : 'Draw';
      
      return (predWinner === actWinner) ? 'correct' : 'incorrect';
    };

    const r32Mock = r32Matches.map(m => {
      const key = m.apiId || m.id;
      const scoreA = getUserScore(key, 'A', username);
      const scoreB = getUserScore(key, 'B', username);
      const status = getDynamicStatus(m.id, scoreA, scoreB, m.actualScoreA, m.actualScoreB);
      return {
        ...m,
        scoreA,
        scoreB,
        status,
      };
    });

    const r16Mock = r16Matches.map((match, idx) => {
      const parentA = r32Mock[idx * 2];
      const parentB = r32Mock[idx * 2 + 1];
      const teamA = getMatchWinner(parentA);
      const teamB = getMatchWinner(parentB);
      const key = match.apiId || match.id;
      const scoreA = getUserScore(key, 'A', username);
      const scoreB = getUserScore(key, 'B', username);
      const status = getDynamicStatus(match.id, scoreA, scoreB, match.actualScoreA, match.actualScoreB);
      return {
        ...match,
        teamA,
        teamB,
        scoreA,
        scoreB,
        status,
      };
    });

    const qfMock = qfMatches.map((match, idx) => {
      const parentA = r16Mock[idx * 2];
      const parentB = r16Mock[idx * 2 + 1];
      const teamA = getMatchWinner(parentA);
      const teamB = getMatchWinner(parentB);
      const key = match.apiId || match.id;
      const scoreA = getUserScore(key, 'A', username);
      const scoreB = getUserScore(key, 'B', username);
      const status = getDynamicStatus(match.id, scoreA, scoreB, match.actualScoreA, match.actualScoreB);
      return {
        ...match,
        teamA,
        teamB,
        scoreA,
        scoreB,
        status,
      };
    });

    const sfMock = sfMatches.map((match, idx) => {
      const parentA = qfMock[idx * 2];
      const parentB = qfMock[idx * 2 + 1];
      const teamA = getMatchWinner(parentA);
      const teamB = getMatchWinner(parentB);
      const key = match.apiId || match.id;
      const scoreA = getUserScore(key, 'A', username);
      const scoreB = getUserScore(key, 'B', username);
      const status = getDynamicStatus(match.id, scoreA, scoreB, match.actualScoreA, match.actualScoreB);
      return {
        ...match,
        teamA,
        teamB,
        scoreA,
        scoreB,
        status,
      };
    });

    const fnKey = finalMatch.apiId || finalMatch.id;
    const scoreA = getUserScore(fnKey, 'A', username);
    const scoreB = getUserScore(fnKey, 'B', username);
    const status = getDynamicStatus(finalMatch.id, scoreA, scoreB, finalMatch.actualScoreA, finalMatch.actualScoreB);
    const fnMock = {
      ...finalMatch,
      teamA: getMatchWinner(sfMock[0]),
      teamB: getMatchWinner(sfMock[1]),
      scoreA,
      scoreB,
      status,
    };

    return { r32: r32Mock, r16: r16Mock, qf: qfMock, sf: sfMock, fn: fnMock };
  };

  const viewedBracket = getDynamicUserMatches(viewingBracketUser, viewingBracketUserId);

  const getViewedUserInfo = () => {
    if (!viewingBracketUser) return null;
    const cleanUsername = viewingBracketUser.trim().toLowerCase();
    const member = activeLeagueMembers.find(m => 
      m.name?.trim().toLowerCase() === cleanUsername || 
      m.username?.trim().toLowerCase() === cleanUsername
    );
    if (member) {
      return {
        rank: member.rank,
        points: member.points,
        avatar: member.avatar,
      };
    }
    return { rank: '--', points: '--', avatar: undefined };
  };

  const viewedUserInfo = getViewedUserInfo();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setIsLoggedIn(Boolean(user));
      if (user) {
        const setupDone = localStorage.getItem(`wc_profile_setup_done_${user.uid}`);
        if (!setupDone) {
          setNeedsProfileSetup(true);
          setProfileSetupName(user.displayName || '');
          setProfileSetupUsername((user.displayName || user.email || '').toLowerCase().replace(/\s+/g, ''));
        } else {
          setNeedsProfileSetup(false);
        }
      } else {
        setNeedsProfileSetup(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setSettingsName(currentUser.displayName || '');
      setSettingsUsername(currentUser.username || '');

      // Auto-sync user details to Firestore users collection in the background
      authService.updateUserProfile(currentUser.displayName, currentUser.username, currentUser.photoURL).catch(() => {});

      // Load user's private leagues
      const loadUserLeagues = async () => {
        const list = await authService.loadUserLeagues(currentUser.uid);
        const mapped = (list || []).map((l: any) => ({
          name: l.name,
          code: l.code,
          members: l.members ? (Array.isArray(l.members) ? l.members.length : l.members) : 1,
          pts: '--',
          rank: '--',
          color: l.code === 'PUBLIC' ? 'slate' : 'blue'
        }));
        setLeaguesList(mapped);
      };
      loadUserLeagues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (selectedLeague && currentUser) {
      const loadLeagueRoster = async () => {
        setIsLoadingRoster(true);
        const code = leaguesList.find(l => l.name === selectedLeague)?.code || selectedLeague;
        const roster = await authService.loadLeagueMembers(code, currentUser.uid);
        setRawLeagueRoster(roster || []);
        setIsLoadingRoster(false);
      };
      loadLeagueRoster();
    } else {
      setRawLeagueRoster([]);
      setActiveLeagueMembers([]);
    }
  }, [selectedLeague, currentUser, leaguesList]);

  useEffect(() => {
    if (rawLeagueRoster.length > 0) {
      const allMatches = [...r32Matches, ...r16Matches, ...qfMatches, ...sfMatches, finalMatch];
      
      const updatedRoster = rawLeagueRoster.map(member => {
        let pts = 0;
        let exact = 0;
        let correctOutcome = 0;
        let totalPreds = 0;
        
        if (member.predictions) {
          Object.keys(member.predictions).forEach(matchId => {
            const pred = member.predictions[matchId];
            if (!pred || pred.scoreA === '' || pred.scoreB === '') return;
            
            totalPreds++;
            const actualMatch = allMatches.find(m => m.id === matchId || m.apiId === matchId);
            if (actualMatch && actualMatch.actualScoreA !== undefined && actualMatch.actualScoreB !== undefined) {
              const actA = parseInt(actualMatch.actualScoreA);
              const actB = parseInt(actualMatch.actualScoreB);
              const predA = parseInt(pred.scoreA);
              const predB = parseInt(pred.scoreB);
              
              if (!isNaN(actA) && !isNaN(actB) && !isNaN(predA) && !isNaN(predB)) {
                if (actA === predA && actB === predB) {
                  // Check for sole predictor bonus
                  let anyoneElseExact = false;
                  if (selectedLeague) {
                    for (const other of rawLeagueRoster) {
                      if (other.uid === member.uid) continue;
                      const otherPred = other.predictions?.[matchId];
                      if (otherPred && parseInt(otherPred.scoreA) === actA && parseInt(otherPred.scoreB) === actB) {
                        anyoneElseExact = true;
                        break;
                      }
                    }
                  }
                  
                  if (selectedLeague && !anyoneElseExact) {
                    pts += 4;
                  } else {
                    pts += 3;
                  }
                  exact++;
                } else {
                  const actWin = actA > actB ? 'A' : actB > actA ? 'B' : 'D';
                  const predWin = predA > predB ? 'A' : predB > predA ? 'B' : 'D';
                  if (actWin === predWin && actWin !== 'D') {
                    pts += 1;
                    correctOutcome++;
                  }
                }
              }
            }
          });
        }
        
        const totalCorrect = exact + correctOutcome;
        const accuracy = totalPreds > 0 ? Math.round((totalCorrect / totalPreds) * 100) + '%' : '0%';
        
        return {
          ...member,
          points: pts,
          picks: `${totalCorrect}/${totalPreds > 0 ? totalPreds : 31}`,
          accuracy
        };
      }).sort((a, b) => b.points - a.points).map((m, i) => ({ ...m, rank: i + 1 }));
      
      setActiveLeagueMembers(updatedRoster);
      
      setLeaguesList(prev => {
        let changed = false;
        const next = prev.map(l => {
          if (l.name === selectedLeague) {
            const me = updatedRoster.find(m => m.isUser);
            if (me && (l.rank !== me.rank || l.pts !== me.points)) {
              changed = true;
              return { ...l, rank: me.rank, pts: me.points };
            }
          }
          return l;
        });
        return changed ? next : prev;
      });
      
    } else {
      setActiveLeagueMembers([]);
    }
  }, [rawLeagueRoster, r32Matches, r16Matches, qfMatches, sfMatches, finalMatch, selectedLeague]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (!notificationsMenuRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  // Dynamically update progression tree
  const updateProgression = (
    r32: PredictionMatch[],
    r16: PredictionMatch[],
    qf: PredictionMatch[],
    sf: PredictionMatch[],
    fn: PredictionMatch
  ) => {
    // 1. Update R32 -> R16
    const nextR16 = r16.map((match, idx) => {
      const parentA = r32[idx * 2];
      const parentB = r32[idx * 2 + 1];
      return {
        ...match,
        teamA: getMatchWinner(parentA),
        teamB: getMatchWinner(parentB),
      };
    });

    // 2. Update R16 -> QF
    const nextQF = qf.map((match, idx) => {
      const parentA = nextR16[idx * 2];
      const parentB = nextR16[idx * 2 + 1];
      return {
        ...match,
        teamA: getMatchWinner(parentA),
        teamB: getMatchWinner(parentB),
      };
    });

    // 3. Update QF -> SF
    const nextSF = sf.map((match, idx) => {
      const parentA = nextQF[idx * 2];
      const parentB = nextQF[idx * 2 + 1];
      return {
        ...match,
        teamA: getMatchWinner(parentA),
        teamB: getMatchWinner(parentB),
      };
    });

    // 4. Update SF -> Final
    const nextFinal = {
      ...fn,
      teamA: getMatchWinner(nextSF[0]),
      teamB: getMatchWinner(nextSF[1]),
    };

    setR16Matches(nextR16);
    setQfMatches(nextQF);
    setSfMatches(nextSF);
    setFinalMatch(nextFinal);
  };

  useEffect(() => {
    if (authLoading) return;

    const loadFixtures = async () => {
      try {
        const matches = await apiService.fetchAllMatches();
        let saved: Record<string, any> | null = null;
        if (currentUser) {
          saved = await authService.loadPredictions(currentUser.uid);
        }

        // Helper to sort API matches by FIFA topological layout (preserves bracket pairings)
        const R32_ORDER = ['74', '77', '73', '75', '83', '84', '81', '82', '76', '78', '79', '80', '86', '88', '85', '87'];
        const R16_ORDER = ['89', '90', '93', '94', '91', '92', '95', '96'];
        const QF_ORDER  = ['97', '98', '99', '100'];
        const SF_ORDER  = ['101', '102'];

        // 1. Map Round of 32 — sort by FIFA topology, assign bracket position IDs m1..m16
        const r32Api = matches.filter(m => m.round === 'R32').sort((a, b) => R32_ORDER.indexOf(a.id) - R32_ORDER.indexOf(b.id));
        const mappedR32: PredictionMatch[] = r32Api.map((m, idx) => {
          const posId = `m${idx + 1}`;
          const existing = r32Matches.find(x => x.apiId === m.id || x.id === posId);
          const savedPred = saved ? (saved[m.id] || saved[posId]) : null;
          const scoreA = savedPred?.scoreA ?? existing?.scoreA ?? '';
          const scoreB = savedPred?.scoreB ?? existing?.scoreB ?? '';

          let status: PredictionMatch['status'] = 'open';
          if (m.status === 'FT') {
            const predA = parseInt(scoreA);
            const predB = parseInt(scoreB);
            const actA = parseInt(m.actualScoreA || '0');
            const actB = parseInt(m.actualScoreB || '0');
            if (!isNaN(predA) && !isNaN(predB)) {
              const predWinner = predA > predB ? 'A' : predB > predA ? 'B' : 'Draw';
              const actWinner = actA > actB ? 'A' : actB > actA ? 'B' : 'Draw';
              status = predWinner === actWinner ? 'correct' : 'incorrect';
            } else {
              status = 'locked';
            }
          } else if (m.status === 'Live') {
            status = 'locked';
          }
          return {
            id: posId,
            apiId: m.id,
            teamA: m.teamA,
            teamB: m.teamB,
            scoreA,
            scoreB,
            status,
            actualScoreA: m.actualScoreA,
            actualScoreB: m.actualScoreB,
            penaltyScoreA: m.penaltyScoreA,
            penaltyScoreB: m.penaltyScoreB,
            date: m.date,
          };
        });
        // Pad to 16 if API has fewer (shouldn't happen but safe)
        while (mappedR32.length < 16) {
          mappedR32.push({ id: `m${mappedR32.length + 1}`, teamA: null, teamB: null, scoreA: '', scoreB: '', status: 'open' });
        }
        setR32Matches(mappedR32);

        // 2. Map Round of 16
        const r16Api = matches.filter(m => m.round === 'R16').sort((a, b) => R16_ORDER.indexOf(a.id) - R16_ORDER.indexOf(b.id));
        const mappedR16 = r16Matches.map((m, idx) => {
          const live = r16Api[idx];
          if (!live) return m;
          const savedPred = saved ? (saved[live.id] || saved[m.id]) : null;
          const scoreA = savedPred?.scoreA ?? m.scoreA;
          const scoreB = savedPred?.scoreB ?? m.scoreB;
          return {
            ...m,
            apiId: live.id,
            scoreA,
            scoreB,
            actualScoreA: live.actualScoreA,
            actualScoreB: live.actualScoreB,
            penaltyScoreA: live.penaltyScoreA,
            penaltyScoreB: live.penaltyScoreB,
            status: (live.status === 'FT' || live.status === 'Live') ? 'locked' as const : m.status,
            date: live.date,
          };
        });

        // 3. Map Quarterfinals
        const qfApi = matches.filter(m => m.round === 'QF').sort((a, b) => QF_ORDER.indexOf(a.id) - QF_ORDER.indexOf(b.id));
        const mappedQF = qfMatches.map((m, idx) => {
          const live = qfApi[idx];
          if (!live) return m;
          const savedPred = saved ? (saved[live.id] || saved[m.id]) : null;
          const scoreA = savedPred?.scoreA ?? m.scoreA;
          const scoreB = savedPred?.scoreB ?? m.scoreB;
          return {
            ...m,
            apiId: live.id,
            scoreA,
            scoreB,
            actualScoreA: live.actualScoreA,
            actualScoreB: live.actualScoreB,
            penaltyScoreA: live.penaltyScoreA,
            penaltyScoreB: live.penaltyScoreB,
            status: (live.status === 'FT' || live.status === 'Live') ? 'locked' as const : m.status,
            date: live.date,
          };
        });

        // 4. Map Semifinals
        const sfApi = matches.filter(m => m.round === 'SF').sort((a, b) => SF_ORDER.indexOf(a.id) - SF_ORDER.indexOf(b.id));
        const mappedSF = sfMatches.map((m, idx) => {
          const live = sfApi[idx];
          if (!live) return m;
          const savedPred = saved ? (saved[live.id] || saved[m.id]) : null;
          const scoreA = savedPred?.scoreA ?? m.scoreA;
          const scoreB = savedPred?.scoreB ?? m.scoreB;
          return {
            ...m,
            apiId: live.id,
            scoreA,
            scoreB,
            actualScoreA: live.actualScoreA,
            actualScoreB: live.actualScoreB,
            penaltyScoreA: live.penaltyScoreA,
            penaltyScoreB: live.penaltyScoreB,
            status: (live.status === 'FT' || live.status === 'Live') ? 'locked' as const : m.status,
            date: live.date,
          };
        });

        // 5. Map Final
        const finalApi = matches.find(m => m.round === 'FINAL');
        let mappedFinal = finalMatch;
        if (finalApi) {
          const savedPred = saved ? (saved[finalApi.id] || saved[finalMatch.id]) : null;
          const scoreA = savedPred?.scoreA ?? finalMatch.scoreA;
          const scoreB = savedPred?.scoreB ?? finalMatch.scoreB;
          mappedFinal = {
            ...finalMatch,
            apiId: finalApi.id,
            scoreA,
            scoreB,
            actualScoreA: finalApi.actualScoreA,
            actualScoreB: finalApi.actualScoreB,
            penaltyScoreA: finalApi.penaltyScoreA,
            penaltyScoreB: finalApi.penaltyScoreB,
            status: (finalApi.status === 'FT' || finalApi.status === 'Live') ? ('locked' as const) : finalMatch.status,
            date: finalApi.date,
          };
        }

        updateProgression(mappedR32, mappedR16, mappedQF, mappedSF, mappedFinal);
        
        setIsInitialDataLoaded(true);
      } catch (err) {
        console.error('Failed to load fixtures:', err);
        setIsInitialDataLoaded(true);
      }
    };
    loadFixtures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser]);

  useEffect(() => {
    const pollLiveScores = async () => {
      try {
        const liveUpdates = await apiService.fetchLiveScores();
        if (Object.keys(liveUpdates).length === 0) return;

        const applyUpdates = (prev: PredictionMatch[]) => {
          let changed = false;
          const next = prev.map(m => {
            const live = liveUpdates[m.apiId || ''];
            if (live) {
              const teamAChanged = live.teamA?.code !== m.teamA?.code;
              const teamBChanged = live.teamB?.code !== m.teamB?.code;
              const scoresChanged = live.actualScoreA !== m.actualScoreA || live.actualScoreB !== m.actualScoreB || live.penaltyScoreA !== m.penaltyScoreA || live.penaltyScoreB !== m.penaltyScoreB;
              const statusChanged = (live.status === 'FT' || live.status === 'Live') && m.status !== 'locked';

              if (teamAChanged || teamBChanged || scoresChanged || statusChanged) {
                changed = true;
                return {
                  ...m,
                  teamA: live.teamA || m.teamA,
                  teamB: live.teamB || m.teamB,
                  actualScoreA: live.actualScoreA,
                  actualScoreB: live.actualScoreB,
                  penaltyScoreA: live.penaltyScoreA,
                  penaltyScoreB: live.penaltyScoreB,
                  status: (live.status === 'FT' || live.status === 'Live') ? 'locked' : m.status
                };
              }
            }
            return m;
          });
          return changed ? next : prev;
        };

        setR32Matches(applyUpdates);
        setR16Matches(applyUpdates);
        setQfMatches(applyUpdates);
        setSfMatches(applyUpdates);
        setFinalMatch(prev => {
          const live = liveUpdates[prev.apiId || ''];
          if (live) {
            const scoresChanged = live.actualScoreA !== prev.actualScoreA || live.actualScoreB !== prev.actualScoreB || live.penaltyScoreA !== prev.penaltyScoreA || live.penaltyScoreB !== prev.penaltyScoreB;
            const statusChanged = (live.status === 'FT' || live.status === 'Live') && prev.status !== 'locked';
            const teamAChanged = live.teamA?.code !== prev.teamA?.code;
            const teamBChanged = live.teamB?.code !== prev.teamB?.code;
            if (scoresChanged || statusChanged || teamAChanged || teamBChanged) {
              return {
                ...prev,
                teamA: live.teamA || prev.teamA,
                teamB: live.teamB || prev.teamB,
                actualScoreA: live.actualScoreA,
                actualScoreB: live.actualScoreB,
                penaltyScoreA: live.penaltyScoreA,
                penaltyScoreB: live.penaltyScoreB,
                status: (live.status === 'FT' || live.status === 'Live') ? 'locked' : prev.status
              };
            }
          }
          return prev;
        });

      } catch (err) {
        console.error('Failed to poll live scores:', err);
      }
    };

    const interval = setInterval(pollLiveScores, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get match lock state based on its individual kickoff time
  const getMatchLockState = (date?: string) => {
    let kickoffMs = Infinity;
    if (date && date !== 'TBA') {
      try {
        const parsedMs = Date.parse(date);
        if (!isNaN(parsedMs)) {
          kickoffMs = parsedMs;
        }
      } catch {}
    }

    if (kickoffMs === Infinity) {
      kickoffMs = Date.parse('2026-07-29T14:00:00Z'); // Fallback July 29, 2026 19:30 IST
    }

    const now = Date.now();
    const openTimeMs = kickoffMs - (48 * 60 * 60 * 1000); // Opens 48 hours prior
    const lockTimeMs = kickoffMs - (15 * 60 * 1000); // Locks 15 minutes prior

    if (now < openTimeMs) {
      return { 
        locked: true, 
        reason: 'upcoming', 
        openTime: new Date(openTimeMs), 
        kickoffTime: new Date(kickoffMs) 
      };
    } else if (now >= lockTimeMs) {
      return { 
        locked: true, 
        reason: 'past', 
        openTime: new Date(openTimeMs), 
        kickoffTime: new Date(kickoffMs) 
      };
    }

    return { 
      locked: false, 
      reason: 'open', 
      openTime: new Date(openTimeMs), 
      kickoffTime: new Date(kickoffMs) 
    };
  };

  const getDynamicNotifications = () => {
    const notifications: { id: string; title: string; message: string; type: 'info' | 'warning'; time: string }[] = [];
    const now = Date.now();
    const allMatches = [...r32Matches, ...r16Matches, ...qfMatches, ...sfMatches, finalMatch];

    allMatches.forEach(match => {
      if (!match || !match.date || match.date === 'TBA') return;
      if (!match.teamA || !match.teamB) return;

      let kickoffMs = Infinity;
      try {
        kickoffMs = Date.parse(match.date);
      } catch {
        return;
      }

      if (isNaN(kickoffMs)) return;

      const diffMs = kickoffMs - now;
      const hoursToKickoff = diffMs / (1000 * 60 * 60);
      const isUnpredicted = match.scoreA === '' || match.scoreB === '';

      if (hoursToKickoff > 0 && hoursToKickoff <= 5 && isUnpredicted && notify5h) {
        notifications.push({
          id: `5h_${match.id}`,
          title: 'Last Chance to Predict!',
          message: `Only ${Math.ceil(hoursToKickoff)}h remaining to predict ${match.teamA?.name} vs ${match.teamB?.name}!`,
          type: 'warning',
          time: 'Urgent'
        });
      } else if (hoursToKickoff > 5 && hoursToKickoff <= 48 && notify48h) {
        notifications.push({
          id: `48h_${match.id}`,
          title: 'Predictions Open',
          message: `You can now start predictions for ${match.teamA?.name} vs ${match.teamB?.name}.`,
          type: 'info',
          time: 'New'
        });
      }
    });

    return notifications.filter(n => !dismissedNotifications.includes(n.id));
  };

  const dismissNotification = (id: string) => {
    const updated = [...dismissedNotifications, id];
    setDismissedNotifications(updated);
    localStorage.setItem('wc_dismissed_notifs', JSON.stringify(updated));
  };

  const activeNotifs = getDynamicNotifications();

  // Handle Score Input
  const handleScoreLock = (matchId: string | number, scoreA: string, scoreB: string) => {
    const id = matchId.toString();
    
    let targetMatch = [...r32Matches, ...r16Matches, ...qfMatches, ...sfMatches, finalMatch].find(m => m.id === id);
    if (targetMatch && getMatchLockState(targetMatch.date).locked) {
      return;
    }

    let nextR32 = r32Matches;
    let nextR16 = r16Matches;
    let nextQF = qfMatches;
    let nextSF = sfMatches;
    let nextFinal = finalMatch;

    if (id.startsWith('m')) {
      nextR32 = r32Matches.map(m => m.id === id ? { ...m, scoreA, scoreB } : m);
      setR32Matches(nextR32);
      updateProgression(nextR32, r16Matches, qfMatches, sfMatches, finalMatch);
    } else if (id.startsWith('r16')) {
      nextR16 = r16Matches.map(m => m.id === id ? { ...m, scoreA, scoreB } : m);
      setR16Matches(nextR16);
      updateProgression(r32Matches, nextR16, qfMatches, sfMatches, finalMatch);
    } else if (id.startsWith('qf')) {
      nextQF = qfMatches.map(m => m.id === id ? { ...m, scoreA, scoreB } : m);
      setQfMatches(nextQF);
      updateProgression(r32Matches, r16Matches, nextQF, sfMatches, finalMatch);
    } else if (id.startsWith('sf')) {
      nextSF = sfMatches.map(m => m.id === id ? { ...m, scoreA, scoreB } : m);
      setSfMatches(nextSF);
      updateProgression(r32Matches, r16Matches, qfMatches, nextSF, finalMatch);
    } else if (id === 'final') {
      nextFinal = { ...finalMatch, scoreA, scoreB };
      setFinalMatch(nextFinal);
    }

    // Auto-save user predictions to Firestore
    if (currentUser) {
      const allPredictions: Record<string, { scoreA: string; scoreB: string }> = {};
      [...nextR32, ...nextR16, ...nextQF, ...nextSF, nextFinal].forEach(m => {
        allPredictions[m.apiId || m.id] = { scoreA: m.scoreA, scoreB: m.scoreB };
      });
      authService.savePredictions(currentUser.uid, allPredictions);
    }
  };

  // Count predicted matches
  const totalPredicted = [
    ...r32Matches,
    ...r16Matches,
    ...qfMatches,
    ...sfMatches,
    finalMatch
  ].filter(m => m.scoreA !== '' && m.scoreB !== '').length;

  const buildListMatch = (
    round: string,
    tag: string,
    index: number,
    match: PredictionMatch,
    date: string,
  ) => {
    const hasTeams = Boolean(match.teamA && match.teamB);
    const isActuallyFinished = match.actualScoreA !== undefined && match.actualScoreB !== undefined;
    const status = isActuallyFinished ? 'FT' : hasTeams ? 'Soon' : 'TBD';

    return {
      id: match.id,
      round,
      tag,
      date,
      status,
      teamA: match.teamA?.name ?? 'TBD',
      teamB: match.teamB?.name ?? 'TBD',
      flagA: getFlagUrl(match.teamA?.code),
      flagB: getFlagUrl(match.teamB?.code),
      // Show actual API result scores when available, otherwise null
      scoreA: isActuallyFinished ? match.actualScoreA! : null,
      scoreB: isActuallyFinished ? match.actualScoreB! : null,
      index,
      note: isActuallyFinished
        ? 'Final score'
        : hasTeams
          ? 'Kickoff pending'
          : 'Awaiting bracket winners',
    };
  };

  const matchListSections = [
    {
      round: 'Round of 32',
      tag: 'R32',
      summary: `${r32Matches.filter(m => m.scoreA !== '' && m.scoreB !== '').length}/16 finished`,
      matches: r32Matches.map((match, index) => buildListMatch('Round of 32', 'R32', index + 1, match, formatMatchDate(match.date))),
    },
    {
      round: 'Round of 16',
      tag: 'R16',
      summary: `${r16Matches.filter(m => m.teamA && m.teamB && m.scoreA !== '' && m.scoreB !== '').length}/8 ready`,
      matches: r16Matches.map((match, index) => buildListMatch('Round of 16', 'R16', index + 1, match, formatMatchDate(match.date))),
    },
    {
      round: 'Quarterfinals',
      tag: 'QF',
      summary: 'Bracket winners pending',
      matches: qfMatches.map((match, index) => buildListMatch('Quarterfinals', 'QF', index + 1, match, formatMatchDate(match.date))),
    },
    {
      round: 'Semifinals',
      tag: 'SF',
      summary: 'Bracket winners pending',
      matches: sfMatches.map((match, index) => buildListMatch('Semifinals', 'SF', index + 1, match, formatMatchDate(match.date))),
    },
    {
      round: 'Final',
      tag: 'FIN',
      summary: 'Champion decider',
      matches: [buildListMatch('Final', 'FIN', 1, finalMatch, formatMatchDate(finalMatch.date))],
    },
  ];
  // Show ALL matches in the list — TBD matches render as skeleton cards
  const matchListSectionsFiltered = matchListSections;

  const listTotals = {
    finished: matchListSectionsFiltered.flatMap(section => section.matches).filter(match => match.status === 'FT').length,
    upcoming: matchListSectionsFiltered.flatMap(section => section.matches).filter(match => match.status === 'Soon').length,
    tbd: matchListSectionsFiltered.flatMap(section => section.matches).filter(match => match.status === 'TBD').length,
  };

  const flatMatchList = matchListSectionsFiltered
    .flatMap((section) =>
      section.matches.map((match) => ({
        ...match,
        round: section.round,
        roundTag: section.tag,
      }))
    )
    .sort((left, right) => {
      // Sort by round progression first, then by date within round, then by index
      const ROUND_ORDER: Record<string, number> = {
        'Round of 32': 1,
        'Round of 16': 2,
        'Quarterfinals': 3,
        'Semifinals': 4,
        'Final': 5,
      };
      const roundL = ROUND_ORDER[left.round] ?? 9;
      const roundR = ROUND_ORDER[right.round] ?? 9;
      if (roundL !== roundR) return roundL - roundR;

      // Within same round: sort by date
      const parseDate = (d: string): number => {
        if (!d || d === 'TBA') return Infinity;
        const months: Record<string, number> = {
          Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
          Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
        };
        const parts = d.split(' ');
        if (parts.length < 2) return Infinity;
        const month = months[parts[0]] ?? Infinity;
        const day = parseInt(parts[1]) || 0;
        return month * 100 + day;
      };
      const dateL = parseDate(left.date);
      const dateR = parseDate(right.date);
      if (dateL !== dateR) return dateL - dateR;

      return left.index - right.index;
    });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-body flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.03] pointer-events-none" />
        
        <div className="flex flex-col items-center gap-6 bg-white border-4 border-slate-950 p-8 rounded-3xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center max-w-sm relative overflow-hidden w-full">
          {/* Logo Header */}
          <div className="flex items-center gap-2">
            <span className="font-sans text-xl font-black uppercase text-slate-950 flex items-center gap-1">
              PREDICTS <Fifa26Logo />
            </span>
          </div>

          {/* Floating Flag Carousel */}
          <div className="w-full overflow-hidden py-2 flex items-center relative border-y-2 border-slate-950 bg-slate-50 -mx-8 px-8">
            <div className="marquee-row-left gap-4 flex w-max">
              {[
                { name: 'us', code: 'USA' },
                { name: 'mx', code: 'MEX' },
                { name: 'ca', code: 'CAN' },
                { name: 'br', code: 'BRA' },
                { name: 'ar', code: 'ARG' },
                { name: 'fr', code: 'FRA' }
              ].concat([
                { name: 'us', code: 'USA' },
                { name: 'mx', code: 'MEX' },
                { name: 'ca', code: 'CAN' },
                { name: 'br', code: 'BRA' },
                { name: 'ar', code: 'ARG' },
                { name: 'fr', code: 'FRA' }
              ]).map((c, idx) => (
                <img
                  key={idx}
                  src={`https://flagcdn.com/w40/${c.name}.png`}
                  alt=""
                  className="w-10 h-6 object-cover border border-slate-950 rounded-sm shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex-shrink-0"
                />
              ))}
            </div>
          </div>

          <div className="font-sans font-black text-xs uppercase tracking-widest text-slate-950">
            LOADING PREDICTIONS...
          </div>
          
          <div className="w-48 h-3 bg-slate-100 border-2 border-slate-950 rounded-full overflow-hidden shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            <div className="h-full bg-blue-600 w-2/3 rounded-full animate-[pulse_1.5s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        if (authMode === 'signup') {
          if (!loginUsername.trim()) {
            setLoginError('Please enter a username');
            return;
          }
          if (!email.trim() || !email.includes('@')) {
            setLoginError('Please enter a valid email address');
            return;
          }
          if (password.length < 6) {
            setLoginError('Password must be at least 6 characters');
            return;
          }
          setLoginError('');
          const user = await authService.registerWithEmail(email, password, loginUsername);
          localStorage.setItem(`wc_profile_setup_done_${user.uid}`, 'true');
          setCurrentUser(user);
          setIsLoggedIn(true);
          setNeedsProfileSetup(false);
        } else {
          if (!email.trim() || !email.includes('@')) {
            setLoginError('Please enter a valid email address');
            return;
          }
          if (password.length < 6) {
            setLoginError('Password must be at least 6 characters');
            return;
          }
          setLoginError('');
          const user = await authService.signInWithEmail(email, password);
          setCurrentUser(user);
          setIsLoggedIn(true);
          const setupDone = localStorage.getItem(`wc_profile_setup_done_${user.uid}`);
          if (!setupDone) {
            setNeedsProfileSetup(true);
            setProfileSetupName(user.displayName || '');
            setProfileSetupUsername((user.displayName || user.email || '').toLowerCase().replace(/\s+/g, ''));
          } else {
            setNeedsProfileSetup(false);
          }
        }
      } catch (err: any) {
        setLoginError(err.message || 'Authentication failed');
      }
    };

    const handleGoogleLogin = async () => {
      try {
        setLoginError('');
        const user = await authService.signInWithGoogle();
        setCurrentUser(user);
        setIsLoggedIn(true);
        const setupDone = localStorage.getItem(`wc_profile_setup_done_${user.uid}`);
        if (!setupDone) {
          setNeedsProfileSetup(true);
          setProfileSetupName(user.displayName || '');
          setProfileSetupUsername((user.displayName || user.email || '').toLowerCase().replace(/\s+/g, ''));
        } else {
          setNeedsProfileSetup(false);
        }
      } catch (err: any) {
        setLoginError(err.message || 'Google login failed');
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-body flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden select-none">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.03] pointer-events-none" />

        {/* Global wrapper */}
        <div className="w-full max-w-5xl flex flex-col gap-8 relative z-10">
          
          {/* Header Card */}
          <header className="w-full bg-white border-4 border-slate-950 p-5 rounded-2xl flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <span className="font-sans text-2xl font-black uppercase text-slate-950 flex items-center gap-1.5">
              PREDICTS <Fifa26Logo />
            </span>
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">KO STAGE PREDICTOR</span>
            </div>
          </header>

          {/* Main Grid */}
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left side: Game Intro + Leaderboard / Stats */}
            <section className="lg:col-span-6 bg-white border-4 border-slate-950 p-6 md:p-8 rounded-3xl flex flex-col gap-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-left min-h-[450px]">
              <div>
                <span className="px-3 py-1.5 rounded-lg border-2 border-slate-950 bg-blue-50 text-blue-700 font-sans font-black text-xs uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block mb-6">
                  CHALLENGE THE BRACKET
                </span>
                
                <h1 className="font-sans font-black text-3xl sm:text-4xl md:text-5xl leading-none text-slate-950 uppercase tracking-tight mb-6">
                  PREDICT THE WORLD CHAMPION.
                </h1>
                
                <p className="font-sans text-sm font-semibold text-slate-600 leading-relaxed mb-4">
                  Stare down the bracket from the Round of 32 all the way to the Finals at MetLife Stadium. Lock in your predictions, compete with friends, and claim your place on the global leaderboard.
                </p>
              </div>

              {/* Moving flag carousel marquee */}
              <div className="overflow-hidden relative w-full pt-4 border-t-2 border-slate-100 flex flex-col gap-4">
                
                <h3 className="font-sans font-black text-xs text-slate-950 uppercase tracking-wider mb-2 text-left">NATIONS COMPETING IN 2026</h3>
                
                {/* Row 1: Scrolling Left (24 Teams) */}
                <div className="w-full overflow-hidden py-1 flex items-center relative">
                  <div className="marquee-row-left gap-8 px-2">
                    {[
                      { name: 'Algeria', code: 'ALG' },
                      { name: 'Argentina', code: 'ARG' },
                      { name: 'Australia', code: 'AUS' },
                      { name: 'Austria', code: 'AUT' },
                      { name: 'Belgium', code: 'BEL' },
                      { name: 'Bosnia & Herz.', code: 'BIH' },
                      { name: 'Brazil', code: 'BRA' },
                      { name: 'Canada', code: 'CAN' },
                      { name: 'Cape Verde', code: 'CPV' },
                      { name: 'Colombia', code: 'COL' },
                      { name: 'Croatia', code: 'CRO' },
                      { name: 'Curaçao', code: 'CUW' },
                      { name: 'Czech Republic', code: 'CZE' },
                      { name: 'DR Congo', code: 'COD' },
                      { name: 'Ecuador', code: 'ECU' },
                      { name: 'Egypt', code: 'EGY' },
                      { name: 'England', code: 'ENG' },
                      { name: 'France', code: 'FRA' },
                      { name: 'Germany', code: 'GER' },
                      { name: 'Ghana', code: 'GHA' },
                      { name: 'Haiti', code: 'HAI' },
                      { name: 'Iran', code: 'IRN' },
                      { name: 'Iraq', code: 'IRQ' },
                      { name: 'Ivory Coast', code: 'CIV' }
                    ].concat([
                      { name: 'Algeria', code: 'ALG' },
                      { name: 'Argentina', code: 'ARG' },
                      { name: 'Australia', code: 'AUS' },
                      { name: 'Austria', code: 'AUT' },
                      { name: 'Belgium', code: 'BEL' },
                      { name: 'Bosnia & Herz.', code: 'BIH' },
                      { name: 'Brazil', code: 'BRA' },
                      { name: 'Canada', code: 'CAN' },
                      { name: 'Cape Verde', code: 'CPV' },
                      { name: 'Colombia', code: 'COL' },
                      { name: 'Croatia', code: 'CRO' },
                      { name: 'Curaçao', code: 'CUW' },
                      { name: 'Czech Republic', code: 'CZE' },
                      { name: 'DR Congo', code: 'COD' },
                      { name: 'Ecuador', code: 'ECU' },
                      { name: 'Egypt', code: 'EGY' },
                      { name: 'England', code: 'ENG' },
                      { name: 'France', code: 'FRA' },
                      { name: 'Germany', code: 'GER' },
                      { name: 'Ghana', code: 'GHA' },
                      { name: 'Haiti', code: 'HAI' },
                      { name: 'Iran', code: 'IRN' },
                      { name: 'Iraq', code: 'IRQ' },
                      { name: 'Ivory Coast', code: 'CIV' }
                    ]).map((country, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1.5 w-20 flex-shrink-0">
                        <img
                          src={`https://flagcdn.com/w80/${flagMap[country.code].toLowerCase()}.png`}
                          alt={`${country.name} flag`}
                          className="w-14 h-9 object-cover border-2 border-slate-950 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] bg-white flex-shrink-0"
                        />
                        <span className="font-sans font-black text-[9px] text-slate-700 uppercase tracking-tight text-center leading-none truncate w-full">
                          {country.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 2: Scrolling Right (24 Teams) */}
                <div className="w-full overflow-hidden py-1 flex items-center relative">
                  <div className="marquee-row-right gap-8 px-2">
                    {[
                      { name: 'Japan', code: 'JPN' },
                      { name: 'Jordan', code: 'JOR' },
                      { name: 'Mexico', code: 'MEX' },
                      { name: 'Morocco', code: 'MAR' },
                      { name: 'Netherlands', code: 'NED' },
                      { name: 'New Zealand', code: 'NZL' },
                      { name: 'Norway', code: 'NOR' },
                      { name: 'Panama', code: 'PAN' },
                      { name: 'Paraguay', code: 'PAR' },
                      { name: 'Portugal', code: 'POR' },
                      { name: 'Qatar', code: 'QAT' },
                      { name: 'Saudi Arabia', code: 'KSA' },
                      { name: 'Scotland', code: 'SCO' },
                      { name: 'Senegal', code: 'SEN' },
                      { name: 'South Africa', code: 'RSA' },
                      { name: 'South Korea', code: 'KOR' },
                      { name: 'Spain', code: 'ESP' },
                      { name: 'Sweden', code: 'SWE' },
                      { name: 'Switzerland', code: 'SUI' },
                      { name: 'Tunisia', code: 'TUN' },
                      { name: 'Turkey', code: 'TUR' },
                      { name: 'United States', code: 'USA' },
                      { name: 'Uruguay', code: 'URU' },
                      { name: 'Uzbekistan', code: 'UZB' }
                    ].concat([
                      { name: 'Japan', code: 'JPN' },
                      { name: 'Jordan', code: 'JOR' },
                      { name: 'Mexico', code: 'MEX' },
                      { name: 'Morocco', code: 'MAR' },
                      { name: 'Netherlands', code: 'NED' },
                      { name: 'New Zealand', code: 'NZL' },
                      { name: 'Norway', code: 'NOR' },
                      { name: 'Panama', code: 'PAN' },
                      { name: 'Paraguay', code: 'PAR' },
                      { name: 'Portugal', code: 'POR' },
                      { name: 'Qatar', code: 'QAT' },
                      { name: 'Saudi Arabia', code: 'KSA' },
                      { name: 'Scotland', code: 'SCO' },
                      { name: 'Senegal', code: 'SEN' },
                      { name: 'South Africa', code: 'RSA' },
                      { name: 'South Korea', code: 'KOR' },
                      { name: 'Spain', code: 'ESP' },
                      { name: 'Sweden', code: 'SWE' },
                      { name: 'Switzerland', code: 'SUI' },
                      { name: 'Tunisia', code: 'TUN' },
                      { name: 'Turkey', code: 'TUR' },
                      { name: 'United States', code: 'USA' },
                      { name: 'Uruguay', code: 'URU' },
                      { name: 'Uzbekistan', code: 'UZB' }
                    ]).map((country, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1.5 w-20 flex-shrink-0">
                        <img
                          src={`https://flagcdn.com/w80/${flagMap[country.code].toLowerCase()}.png`}
                          alt={`${country.name} flag`}
                          className="w-14 h-9 object-cover border-2 border-slate-950 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] bg-white flex-shrink-0"
                        />
                        <span className="font-sans font-black text-[9px] text-slate-700 uppercase tracking-tight text-center leading-none truncate w-full">
                          {country.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


            </section>

            {/* Right side: Login / Sign Up form */}
            <section className="lg:col-span-6 bg-white border-4 border-slate-950 p-6 md:p-8 rounded-3xl flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-left relative overflow-hidden">
              <div>
                {/* Sign-In / Sign-Up tab toggle */}
                <div className="flex border-2 border-slate-950 rounded-xl p-1 bg-slate-100 mb-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setLoginError(''); }}
                    className={`flex-1 py-2 rounded-lg font-sans font-black text-xs uppercase tracking-wider text-center transition-all ${
                      authMode === 'login'
                        ? 'bg-slate-950 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setLoginError(''); }}
                    className={`flex-1 py-2 rounded-lg font-sans font-black text-xs uppercase tracking-wider text-center transition-all ${
                      authMode === 'signup'
                        ? 'bg-slate-950 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                <h2 className="font-sans font-black text-xl text-slate-950 uppercase tracking-tight mb-2">
                  {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-xs font-semibold text-slate-400 mb-6">
                  {authMode === 'login' ? 'Access your bracket predictions and leagues.' : 'Sign up to start predicting World Cup fixtures.'}
                </p>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2.5 py-3 border-2 border-slate-950 bg-white rounded-xl font-sans font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer mb-5"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.015c1.55 0 2.902.59 3.94 1.547l3.12-3.12C19.123 3.097 16.744 2 13.99 2 8.163 2 3.5 6.663 3.5 12.5S8.163 23 13.99 23c5.36 0 9.87-3.847 9.87-10.5 0-.712-.082-1.397-.22-2.215H12.24Z"
                    />
                  </svg>
                  Sign In with Google
                </button>

                <div className="flex items-center gap-3 my-4">
                  <div className="h-[2px] bg-slate-200 flex-1" />
                  <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-widest">OR EMAIL</span>
                  <div className="h-[2px] bg-slate-200 flex-1" />
                </div>

                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                  {authMode === 'signup' && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="username" className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-950">Username</label>
                      <input
                        id="username"
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="Enter username"
                        className="w-full font-sans font-extrabold text-sm border-2 border-slate-950 p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-[-1px] focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-950">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full font-sans font-extrabold text-sm border-2 border-slate-950 p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-[-1px] focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-950">Password</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full font-sans font-extrabold text-sm border-2 border-slate-950 p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-[-1px] focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                    />
                  </div>

                  {loginError && (
                    <p className="text-xs font-bold text-red-650 bg-red-50 p-2.5 rounded-lg border border-red-200">
                      {loginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full mt-2 py-3.5 px-4 rounded-xl border-2 border-slate-950 bg-blue-600 text-white font-sans font-black text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer text-center"
                  >
                    {authMode === 'login' ? 'ENTER THE LEAGUE' : 'CREATE ACCOUNT'}
                  </button>
                </form>
              </div>


            </section>

          </main>

        </div>
      </div>
    );
  }

  if (needsProfileSetup) {
    const handleProfileSetupSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profileSetupName.trim()) {
        setDialogConfig({ isOpen: true, title: 'Error', message: 'Please enter your full name', type: 'alert' });
        return;
      }
      if (!profileSetupUsername.trim()) {
        setDialogConfig({ isOpen: true, title: 'Error', message: 'Please enter a username', type: 'alert' });
        return;
      }
      try {
        await authService.updateUserProfile(profileSetupName, profileSetupUsername);
        if (currentUser) {
          localStorage.setItem(`wc_profile_setup_done_${currentUser.uid}`, 'true');
          setCurrentUser({
            ...currentUser,
            displayName: profileSetupName,
            username: profileSetupUsername
          });
        }
        setNeedsProfileSetup(false);
      } catch (err: any) {
        setDialogConfig({ isOpen: true, title: 'Error', message: err.message || 'Failed to update profile', type: 'alert' });
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-body flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.03] pointer-events-none" />
        
        <div className="w-full max-w-md bg-white border-4 border-slate-950 p-6 md:p-8 rounded-3xl flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-left relative overflow-hidden">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="font-sans text-xl font-black uppercase text-slate-950 flex items-center gap-1">
                PREDICTS <Fifa26Logo />
              </span>
            </div>

            <h2 className="font-sans font-black text-xl text-slate-950 uppercase tracking-tight mb-2">
              Setup Your Profile
            </h2>
            <p className="text-xs font-semibold text-slate-400 mb-6">
              Confirm your name and pick a username to join the predictor tournament.
            </p>

            <form onSubmit={handleProfileSetupSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="setup-name" className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-950">Full Name</label>
                <input
                  id="setup-name"
                  type="text"
                  value={profileSetupName}
                  onChange={(e) => setProfileSetupName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full font-sans font-extrabold text-sm border-2 border-slate-950 p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-[-1px] focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="setup-username" className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-950">Username</label>
                <input
                  id="setup-username"
                  type="text"
                  value={profileSetupUsername}
                  onChange={(e) => setProfileSetupUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full font-sans font-extrabold text-sm border-2 border-slate-950 p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-[-1px] focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-slate-950 text-white border-2 border-slate-950 rounded-xl font-sans font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                Complete Setup & Enter
              </button>

              <button
                type="button"
                onClick={async () => {
                  await authService.logOut();
                }}
                className="w-full mt-1 flex items-center justify-center gap-2 py-2 border-2 border-slate-300 rounded-xl font-sans font-black text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all cursor-pointer text-slate-500"
              >
                Cancel & Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-body flex flex-col md:flex-row md:items-stretch">


      
      {/* Sidebar Drawer Container */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-screen z-50 flex flex-col py-6 px-5 bg-white border-r-2 border-slate-950 transition-all duration-300 w-64 md:w-64 md:min-w-64 md:max-w-64 md:flex-none md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex justify-between items-center md:block select-none">
          <span className="font-sans text-xl font-black uppercase text-slate-950 flex items-center gap-1">
            PREDICTS <Fifa26Logo />
          </span>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-900"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        </div>
        
        {/* Navigation links */}
        <nav className="flex flex-col gap-1 flex-grow">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'leaderboard', icon: Trophy, label: 'Leaderboard' },
            { id: 'rules', icon: BookOpen, label: 'Scoring Rules' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = sidebarTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSidebarTab(item.id as any);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg font-sans font-extrabold text-sm tracking-tight transition-all border-2 text-left ${
                  isActive
                    ? 'bg-slate-950 text-white border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'} stroke-[2.5]`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Overlay backdrop for mobile menu */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Right Column Layout Wrapper */}
      <div className="flex-grow flex flex-col min-w-0">
        
        {/* Sticky Header */}
        <header className="sticky top-0 z-45 bg-white border-b-2 border-slate-950 px-4 md:px-8 h-16 flex justify-between items-center select-none">
              <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-900 focus:outline-none"
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-sans text-xl font-black uppercase text-slate-950 flex items-center gap-1">
                PREDICTS <Fifa26Logo />
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 h-full pl-12 mr-auto">
            {[
              { id: 'bracket', label: 'My Bracket' },
              { id: 'list', label: 'Match List' },
              { id: 'leagues', label: 'My Leagues' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTopTabChange(tab.id as 'bracket' | 'list' | 'leagues')}
                className={`h-full px-2 border-b-4 font-sans font-black text-xs uppercase tracking-widest transition-all duration-150 relative ${
                  sidebarTab === 'dashboard' && activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div ref={notificationsMenuRef} className="relative">
              <button 
                onClick={() => setNotificationsOpen(open => !open)}
                className="p-2 text-slate-900 hover:bg-slate-100 rounded-lg transition-all relative border border-transparent hover:border-slate-200"
              >
                <Bell className="w-5 h-5 stroke-[2.5]" />
                {activeNotifs.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full border border-white" />
                )}
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-slate-950 rounded-xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-50 overflow-hidden flex flex-col">
                  <div className="p-3 border-b-2 border-slate-950 bg-slate-50 flex justify-between items-center">
                    <span className="font-sans font-black text-xs uppercase tracking-widest text-slate-900">Notifications</span>
                    {activeNotifs.length > 0 && (
                      <button 
                        onClick={() => {
                          const updated = [...dismissedNotifications, ...activeNotifs.map(n => n.id)];
                          setDismissedNotifications(updated);
                          localStorage.setItem('wc_dismissed_notifs', JSON.stringify(updated));
                        }}
                        className="text-[10px] font-sans font-black text-slate-500 hover:text-slate-900 uppercase underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {activeNotifs.length > 0 ? (
                      <div className="flex flex-col divide-y-2 divide-slate-100">
                        {activeNotifs.map((notif) => (
                          <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors relative group">
                            <div className="flex justify-between items-start mb-1 pr-6">
                              <span className={`font-sans font-black text-xs uppercase ${notif.type === 'warning' ? 'text-red-600' : 'text-blue-600'}`}>
                                {notif.title}
                              </span>
                              <span className="text-[10px] font-sans font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{notif.time}</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-600 leading-snug pr-4">
                              {notif.message}
                            </p>
                            <button 
                              onClick={() => dismissNotification(notif.id)}
                              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 font-semibold text-xs">
                        No active match notifications.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-[2px] bg-slate-950 hidden sm:block" />

            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-xl hover:bg-slate-50 border-2 border-transparent hover:border-slate-200 transition-all text-left"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                <img
                  src={currentUser?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                  alt="User avatar"
                  className="w-8 h-8 rounded-full object-cover border-2 border-slate-950"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-black text-slate-900 leading-none">{currentUser?.displayName || 'Sophia Perez'}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl border-2 border-slate-950 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-[60] overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-slate-950 bg-slate-50">
                    <p className="font-sans font-black text-sm text-slate-900">{currentUser?.displayName || 'Sophia Perez'}</p>
                  </div>
                  <div className="p-2 flex flex-col gap-1">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border-2 border-slate-950 bg-slate-950 text-white hover:bg-slate-800 font-sans font-black text-xs uppercase tracking-wider text-left transition-all"
                      onClick={async () => {
                        await authService.logOut();
                        setProfileMenuOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 stroke-[2.5]" />
                      Log out
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border-2 border-transparent hover:border-slate-950 hover:bg-slate-50 font-sans font-black text-xs uppercase tracking-wider text-slate-900 text-left transition-all"
                      onClick={() => {
                        setSidebarTab('settings');
                        setProfileMenuOpen(false);
                      }}
                    >
                      <Settings className="w-4 h-4 stroke-[2.5]" />
                      Account Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow py-6 px-4 md:px-8 pb-4 w-full max-w-[1600px] mx-auto flex flex-col gap-6">
          {sidebarTab === 'dashboard' && (activeTab === 'bracket' || (activeTab === 'leagues' && viewingBracketUser)) && (
            viewingBracketUser ? (
              /* Viewed User Profile Header */
              <section className="bg-white border-2 border-slate-950 rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4 text-left">
                  {/* Avatar */}
                  {viewedUserInfo?.avatar ? (
                    <img src={viewedUserInfo.avatar} className="w-16 h-16 rounded-full object-cover border-2 border-slate-950 shadow-sm" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-slate-950 flex items-center justify-center font-sans text-2xl text-slate-500 font-black">
                      {viewingBracketUser.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md border-2 border-slate-950 bg-slate-950 text-white font-sans font-black text-[9px] uppercase tracking-widest">
                        PREDICTOR PROFILE
                      </span>
                    </div>
                    <h1 className="font-sans text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase mt-1">
                      {viewingBracketUser}
                    </h1>
                    <p className="font-body text-slate-550 font-semibold text-xs mt-1">
                      {activeTab === 'leagues' && selectedLeague 
                        ? `Viewing ${viewingBracketUser}'s Bracket in ${selectedLeague}`
                        : "Viewing read-only prediction bracket."}
                    </p>
                  </div>
                </div>

                {/* Stats & Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                  <div className="bg-slate-50 border-2 border-slate-950 p-4 rounded-xl text-left min-w-36 flex flex-col justify-center">
                    <span className="font-sans font-black text-[9px] uppercase tracking-wider text-slate-450">League Rank</span>
                    <span className="font-sans font-black text-2xl text-blue-600 leading-tight">
                      #{viewedUserInfo?.rank}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 mt-0.5">{selectedLeague || 'Global Board'}</span>
                  </div>

                  <div className="bg-slate-50 border-2 border-slate-950 p-4 rounded-xl text-left min-w-36 flex flex-col justify-center">
                    <span className="font-sans font-black text-[9px] uppercase tracking-wider text-slate-450">Total Points</span>
                    <span className="font-mono font-black text-2xl text-slate-950 leading-tight">
                      {viewedUserInfo?.points} pts
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 mt-0.5">Prediction score</span>
                  </div>

                  <button 
                    onClick={() => {
                      setViewingBracketUser(null);
                      setViewingBracketUserId(null);
                    }}
                    className="px-5 py-3 bg-slate-950 text-white border-2 border-slate-950 font-sans font-black text-xs uppercase tracking-wider rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-800 transition-all select-none cursor-pointer text-center"
                  >
                    {activeTab === 'leagues' ? 'Back to League Standings' : 'Return to My Bracket'}
                  </button>
                </div>
              </section>
            ) : (
              /* Hero Section */
              <section className="bg-white border-2 border-slate-950 rounded-2xl p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="relative z-10 max-w-xl text-left">
                  <h1 className="font-sans text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                    The Knockout Stage
                  </h1>
                  <p className="font-body text-slate-500 font-semibold text-sm mt-2 max-w-lg">
                    Predict from the Round of 32 to the Finals. Lock in your predictions before each matchday to secure points and dominate the leaderboard.
                  </p>
                </div>

                {/* User Progress Widget */}
                <div className="w-full md:w-80 bg-slate-50 border-2 border-slate-950 p-4 rounded-xl relative z-10 text-left">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-450">Picks Progress</span>
                    <span className="font-sans font-black text-xs text-blue-600 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 stroke-[2.5]" /> {totalPredicted} / 31 Predicted
                    </span>
                  </div>
                  
                  {/* Custom segmented progress bar */}
                  <div className="w-full bg-slate-200 h-5 flex rounded-sm overflow-hidden p-0.5 border-2 border-slate-950">
                    <div 
                      className="h-full bg-blue-600 rounded-none transition-all duration-500" 
                      style={{ width: `${(totalPredicted / 31) * 100}%` }} 
                    />
                  </div>

                  <div className="flex justify-between items-center mt-2 text-[10px] font-sans font-black uppercase tracking-wider text-slate-450">
                    <span>{r32Matches.filter(m => m.scoreA !== '' && m.scoreB !== '').length} / 16 R32 Picks</span>
                    <span>R16 Unlocked</span>
                  </div>
                </div>
              </section>
            )
          )}

        {/* Dashboard Content Grid */}
        <div className="flex flex-col gap-6 w-full">
          
          {/* Column 1: Main Content Panels */}
          <div className="w-full flex flex-col gap-6">
            
            {sidebarTab === 'dashboard' && (activeTab === 'bracket' || (activeTab === 'leagues' && viewingBracketUser)) && (
              <div className="w-full bg-white rounded-2xl border-2 border-slate-950 p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[500px] overflow-hidden">
            {/* Header with Title and Scroll Guide */}
            <div className="flex justify-between items-center pb-4 border-b-2 border-slate-950">
              <div className="text-left">
                <h2 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">Tournament Bracket</h2>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Scroll horizontally to view matches. Predict scores to advance teams.</p>
              </div>
              <div className="hidden sm:flex gap-2">
                {['R32', 'R16', 'QF', 'SF', 'Final'].map((label) => {
                  const targetId = `col-${label.toLowerCase()}`;
                  const isActive = activeRound === label;
                  return (
                    <button 
                      key={label}
                      onClick={() => {
                        setActiveRound(label);
                        const element = document.getElementById(targetId);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border-2 font-sans font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-white text-slate-900 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="scroll-container overflow-x-auto pb-4 pt-2 -mx-6 px-6 relative min-h-[400px]">
              {!isInitialDataLoaded ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="font-sans font-black text-xs uppercase tracking-widest text-slate-950 mb-4 bg-white px-4 py-2 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg">
                    LOADING BRACKET DATA...
                  </div>
                  <div className="w-48 h-4 bg-slate-100 border-2 border-slate-950 rounded-full overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div className="h-full bg-blue-600 w-2/3 rounded-full animate-[pulse_1.5s_infinite]" />
                  </div>
                </div>
              ) : null}
              <div className={`flex gap-16 min-w-max items-start relative select-none transition-opacity duration-300 ${isInitialDataLoaded ? 'opacity-100' : 'opacity-0'}`}>
                {/* Round of 32 Column */}
                <div id="col-r32" className="flex flex-col gap-6 w-[270px] flex-shrink-0 relative scroll-ms-8">
                  <div className="absolute top-[-24px] left-0 font-sans font-black text-[10px] uppercase text-slate-455 tracking-wider">
                    Round of 32
                  </div>
                  {viewedBracket.r32.map((match, idx) => (
                    <MatchCard
                      key={match.id}
                      id={match.id}
                      teamA={match.teamA}
                      teamB={match.teamB}
                      scoreA={match.scoreA}
                      scoreB={match.scoreB}
                      status={getMatchLockState(match.date).locked ? 'locked' : match.status}
                      actualScoreA={match.actualScoreA}
                      actualScoreB={match.actualScoreB}
                      pointsEarned={getMatchPoints(match.id, match.scoreA, match.scoreB, match.actualScoreA, match.actualScoreB, viewingBracketUser)}

                      onScoreLock={handleScoreLock}
                      connectorType={idx % 2 === 0 ? 'top' : 'bottom'}
                      hasConnectorLine={idx % 2 === 0}
                      connectorHeight="calc(50% + 12px)"
                      isReadOnly={viewingBracketUser !== null}
                    />
                  ))}
                </div>

                {/* Round of 16 Column */}
                <div id="col-r16" className="flex flex-col w-[270px] flex-shrink-0 relative pt-[93px] gap-[210px] scroll-ms-8">
                  <div className="absolute top-[-24px] left-0 font-sans font-black text-[10px] uppercase text-slate-455 tracking-wider">
                    Round of 16
                  </div>
                  {viewedBracket.r16.map((match, idx) => (
                    <MatchCard
                      key={match.id}
                      id={match.id}
                      teamA={match.teamA}
                      teamB={match.teamB}
                      scoreA={match.scoreA}
                      scoreB={match.scoreB}
                      status={getMatchLockState(match.date).locked ? 'locked' : match.status}
                      actualScoreA={match.actualScoreA}
                      actualScoreB={match.actualScoreB}
                      pointsEarned={getMatchPoints(match.id, match.scoreA, match.scoreB, match.actualScoreA, match.actualScoreB, viewingBracketUser)}
                      onScoreLock={handleScoreLock}
                      connectorType={idx % 2 === 0 ? 'top' : 'bottom'}
                      hasConnectorLine={idx % 2 === 0}
                      connectorHeight="calc(50% + 105px)"
                      isReadOnly={viewingBracketUser !== null}
                    />
                  ))}
                </div>

                {/* Quarterfinals Column */}
                <div id="col-qf" className="flex flex-col w-[270px] flex-shrink-0 relative pt-[279px] gap-[582px] scroll-ms-8">
                  <div className="absolute top-[-24px] left-0 font-sans font-black text-[10px] uppercase text-slate-455 tracking-wider">
                    Quarterfinals
                  </div>
                  {viewedBracket.qf.map((match, idx) => (
                    <MatchCard
                      key={match.id}
                      id={match.id}
                      teamA={match.teamA}
                      teamB={match.teamB}
                      scoreA={match.scoreA}
                      scoreB={match.scoreB}
                      status={getMatchLockState(match.date).locked ? 'locked' : match.status}
                      actualScoreA={match.actualScoreA}
                      actualScoreB={match.actualScoreB}
                      pointsEarned={getMatchPoints(match.id, match.scoreA, match.scoreB, match.actualScoreA, match.actualScoreB, viewingBracketUser)}
                      onScoreLock={handleScoreLock}
                      connectorType={idx % 2 === 0 ? 'top' : 'bottom'}
                      hasConnectorLine={idx % 2 === 0}
                      connectorHeight="calc(50% + 291px)"
                      isReadOnly={viewingBracketUser !== null}
                    />
                  ))}
                </div>

                {/* Semifinals Column */}
                <div id="col-sf" className="flex flex-col w-[270px] flex-shrink-0 relative pt-[651px] gap-[1326px] scroll-ms-8">
                  <div className="absolute top-[-24px] left-0 font-sans font-black text-[10px] uppercase text-slate-455 tracking-wider">
                    Semifinals
                  </div>
                  {viewedBracket.sf.map((match, idx) => (
                    <MatchCard
                      key={match.id}
                      id={match.id}
                      teamA={match.teamA}
                      teamB={match.teamB}
                      scoreA={match.scoreA}
                      scoreB={match.scoreB}
                      status={getMatchLockState(match.date).locked ? 'locked' : match.status}
                      actualScoreA={match.actualScoreA}
                      actualScoreB={match.actualScoreB}
                      pointsEarned={getMatchPoints(match.id, match.scoreA, match.scoreB, match.actualScoreA, match.actualScoreB, viewingBracketUser)}
                      onScoreLock={handleScoreLock}
                      connectorType={idx % 2 === 0 ? 'top' : 'bottom'}
                      hasConnectorLine={idx % 2 === 0}
                      connectorHeight="calc(50% + 663px)"
                      isReadOnly={viewingBracketUser !== null}
                    />
                  ))}
                </div>

                {/* Finals Column */}
                <div id="col-final" className="flex flex-col w-[270px] flex-shrink-0 relative pt-[1395px] gap-6 scroll-ms-8 mr-24 md:mr-48">
                  <div className="absolute top-[-24px] left-0 font-sans font-black text-[10px] uppercase text-slate-455 tracking-wider">
                    Finals
                  </div>
                  <div className="w-full">
                    <MatchCard
                      id={viewedBracket.fn.id}
                      teamA={viewedBracket.fn.teamA}
                      teamB={viewedBracket.fn.teamB}
                      scoreA={viewedBracket.fn.scoreA}
                      scoreB={viewedBracket.fn.scoreB}
                      status={getMatchLockState(viewedBracket.fn.date).locked ? 'locked' : viewedBracket.fn.status}
                      actualScoreA={viewedBracket.fn.actualScoreA}
                      actualScoreB={viewedBracket.fn.actualScoreB}
                      pointsEarned={getMatchPoints(viewedBracket.fn.id, viewedBracket.fn.scoreA, viewedBracket.fn.scoreB, viewedBracket.fn.actualScoreA, viewedBracket.fn.actualScoreB, viewingBracketUser)}
                      onScoreLock={handleScoreLock}
                      connectorType="none"
                      isReadOnly={viewingBracketUser !== null}
                    />
                  </div>
                  
                  {/* Champion predicted display or skeleton placeholder */}
                  {getMatchWinner(viewedBracket.fn) ? (
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-600 rounded-xl flex flex-col items-center gap-2 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)] w-full text-center">
                      <CheckCircle className="w-7 h-7 text-emerald-600 fill-emerald-100 stroke-[2]" />
                      <h4 className="font-sans font-black text-slate-900 text-xs uppercase tracking-tight">Predicted Champion</h4>
                      <span className="font-sans font-black text-emerald-700 text-base uppercase tracking-wider flex items-center gap-2.5 justify-center">
                        <Trophy className="w-5 h-5 text-amber-500 fill-amber-400 stroke-[2]" />
                        {getMatchWinner(viewedBracket.fn)?.name}
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 bg-white border-2 border-slate-950 border-dashed rounded-xl flex flex-col items-center gap-2 w-full text-center select-none">
                      <Trophy className="w-7 h-7 text-slate-300 stroke-[2]" />
                      <h4 className="font-sans font-black text-slate-400 text-xs uppercase tracking-tight">Predicted Champion</h4>
                      <span className="font-sans font-extrabold text-slate-400 text-sm tracking-tight italic">
                        TBD
                      </span>
                    </div>
                  )}
                </div>

                {/* Right spacer to preserve end-of-scroll padding */}
                <div className="w-16 md:w-32 flex-shrink-0" aria-hidden />

              </div>
            </div>
          </div>
        )}

        {/* Match List Panel */}
        {sidebarTab === 'dashboard' && activeTab === 'list' && (
          <div className="w-full bg-white rounded-2xl border-2 border-slate-950 p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[500px] text-left">
              <div className="flex flex-col gap-5 pb-5 border-b-2 border-slate-950">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                  <div>
                    <h2 className="font-sans font-black text-lg md:text-2xl text-slate-900 uppercase tracking-tight">Match List</h2>
                    <p className="text-xs font-semibold text-slate-400 mt-1 max-w-2xl">A card-based fixture view for completed scores, upcoming matches, and dates across every knockout round.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 rounded-lg border-2 border-slate-950 bg-slate-950 text-white font-sans font-black text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {listTotals.finished} Finished
                    </span>
                    <span className="px-3 py-1.5 rounded-lg border-2 border-blue-600 bg-blue-50 text-blue-700 font-sans font-black text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {listTotals.upcoming} Upcoming
                    </span>
                    <span className="px-3 py-1.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-slate-500 font-sans font-black text-[10px] uppercase tracking-widest">
                      {listTotals.tbd} TBD
                    </span>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {flatMatchList.map((match) => {
                  const isFinished = match.status === 'FT';
                  const isUpcoming = match.status === 'Soon';
                  const isTbd = match.status === 'TBD';

                  return (
                    <article
                      key={match.id}
                      className={`border-2 border-slate-950 rounded-2xl p-4 md:p-5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-y-[-1px] ${isTbd ? 'bg-slate-50/80' : 'bg-white'}`}
                    >
                      {/* Header row: round badge + date + status */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-md border-2 border-slate-950 bg-slate-950 text-white font-sans font-black text-[9px] uppercase tracking-widest shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                            {match.roundTag}
                          </span>
                          <span className="font-mono font-black text-[11px] text-slate-500 uppercase tracking-[0.2em]">
                            {String(match.index).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2.5 py-1 rounded-full border-2 border-slate-950 bg-slate-50 text-slate-700 font-sans font-black text-[9px] uppercase tracking-widest">
                            {match.date}
                          </span>
                          {isFinished ? (
                            <span className="px-2.5 py-1 rounded-full border-2 border-emerald-600 bg-emerald-50 text-emerald-700 font-sans font-black text-[9px] leading-none uppercase tracking-widest min-w-[3rem] text-center inline-flex items-center justify-center">
                              FT
                            </span>
                          ) : isUpcoming ? (
                            <span className="px-2.5 py-1 rounded-full border-2 border-blue-600 bg-blue-50 text-blue-700 font-sans font-black text-[9px] leading-none uppercase tracking-widest min-w-[3rem] text-center inline-flex items-center justify-center">
                              Upcoming
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full border-2 border-slate-300 bg-slate-50 text-slate-400 font-sans font-black text-[9px] leading-none uppercase tracking-widest min-w-[3rem] text-center inline-flex items-center justify-center">
                              TBD
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Teams row */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        {/* Team A */}
                        <div className="flex items-center gap-3 min-w-0 justify-end">
                          <span className={`block min-w-0 whitespace-nowrap font-sans font-extrabold text-sm md:text-base leading-none tracking-tight text-right ${isTbd ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                            {match.teamA}
                          </span>
                          {match.flagA ? (
                            <img
                              src={match.flagA}
                              alt={match.teamA}
                              className="w-[22px] h-[16px] object-cover border-2 border-slate-950 rounded-sm shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex-shrink-0"
                            />
                          ) : (
                            <span className="w-[22px] h-[16px] bg-slate-50 border-2 border-slate-300 border-dashed rounded-sm flex-shrink-0" />
                          )}
                        </div>

                        {/* Score / VS box */}
                        <div className={`px-3 py-2 rounded-xl border-2 border-slate-950 min-w-20 text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isFinished ? 'bg-slate-950 text-white' : isUpcoming ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400'}`}>
                          {isFinished && match.scoreA !== null && match.scoreB !== null ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono font-black text-base md:text-lg">{match.scoreA}</span>
                              <span className="font-sans font-black text-xs uppercase tracking-widest text-slate-300">-</span>
                              <span className="font-mono font-black text-base md:text-lg">{match.scoreB}</span>
                            </div>
                          ) : (
                            <span className="font-sans font-black text-xs uppercase tracking-widest">vs</span>
                          )}
                        </div>

                        {/* Team B */}
                        <div className="flex items-center gap-3 min-w-0">
                          {match.flagB ? (
                            <img
                              src={match.flagB}
                              alt={match.teamB}
                              className="w-[22px] h-[16px] object-cover border-2 border-slate-950 rounded-sm shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex-shrink-0"
                            />
                          ) : (
                            <span className="w-[22px] h-[16px] bg-slate-50 border-2 border-slate-300 border-dashed rounded-sm flex-shrink-0" />
                          )}
                          <span className={`block min-w-0 whitespace-nowrap font-sans font-extrabold text-sm md:text-base leading-none tracking-tight ${isTbd ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                            {match.teamB}
                          </span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{match.round}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isFinished ? 'text-emerald-700' : isUpcoming ? 'text-blue-700' : 'text-slate-400'}`}>
                          {isFinished ? 'Score locked' : isUpcoming ? 'Scheduled' : 'Waiting on bracket'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

        {/* My Leagues Panel */}
        {sidebarTab === 'dashboard' && activeTab === 'leagues' && !viewingBracketUser && (
          <div className="w-full bg-white rounded-2xl border-2 border-slate-950 p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[500px] text-left">
            {(() => {




              if (selectedLeague) {
                const members = activeLeagueMembers;
                const leagueInfo = leaguesList.find(l => l.name === selectedLeague);
                
                return (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b-2 border-slate-950 gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setSelectedLeague(null)}
                            className="px-2.5 py-1 bg-white text-slate-900 border-2 border-slate-950 font-sans font-black text-xs uppercase tracking-wider rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none transition-all select-none cursor-pointer"
                          >
                            &larr; Back
                          </button>
                          <h2 className="font-sans font-black text-lg md:text-2xl text-slate-900 uppercase tracking-tight">{selectedLeague}</h2>
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-1.5">
                          Code: <span className="font-black text-slate-700">{leagueInfo?.code}</span> · {leagueInfo?.members ? (typeof leagueInfo.members === 'number' ? leagueInfo.members : (Array.isArray(leagueInfo.members) ? leagueInfo.members.length : 1)) : 1} members · Your Rank: <span className="font-black text-blue-600">#{leagueInfo?.rank}</span>
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          if (leagueInfo) {
                            setDialogConfig({
                              isOpen: true,
                              title: 'Leave League',
                              message: `Are you sure you want to leave ${selectedLeague}?`,
                              type: 'confirm',
                              onConfirm: async () => {
                                try {
                                  const targetCode = leagueInfo.code;
                                  // Update local UI state immediately for responsiveness
                                  setLeaguesList(prev => prev.filter(l => l.name !== selectedLeague));
                                  setSelectedLeague(null);
                                  
                                  if (currentUser) {
                                    await authService.leaveLeague(currentUser.uid, targetCode);
                                  }
                                } catch (err) {
                                  console.error('Error leaving league:', err);
                                }
                              }
                            });
                          }
                        }}
                        className="px-4 py-2 bg-red-50 text-red-650 border-2 border-red-600 font-sans font-black text-xs uppercase tracking-wider rounded-lg shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] hover:bg-red-100 transition-all select-none cursor-pointer"
                      >
                        Leave League
                      </button>
                    </div>

                    <div className="overflow-x-auto border-2 border-slate-950 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-950 font-sans text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            <th className="py-3.5 px-4 w-20">Rank</th>
                            <th className="py-3.5 px-4">Predictor</th>
                            <th className="py-3.5 px-4 text-center">Correct picks</th>
                            <th className="py-3.5 px-4 text-center">Accuracy</th>
                            <th className="py-3.5 px-4 text-right pr-6">Total Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-150 font-sans text-xs">
                          {isLoadingRoster ? (
                            Array(3).fill(null).map((_, idx) => (
                              <tr key={idx} className="animate-pulse">
                                <td className="py-4 px-4">
                                  <div className="w-10 h-5 bg-slate-200 border border-slate-950 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" />
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-950" />
                                    <div className="w-24 h-4 bg-slate-200 rounded" />
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="w-10 h-4 bg-slate-200 rounded mx-auto" />
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="w-10 h-4 bg-slate-200 rounded mx-auto" />
                                </td>
                                <td className="py-4 px-4 text-right pr-6">
                                  <div className="w-12 h-4 bg-slate-200 rounded ml-auto" />
                                </td>
                              </tr>
                            ))
                          ) : members.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center font-sans font-black uppercase text-xs text-slate-400 tracking-wider">
                                No members in this league yet.
                              </td>
                            </tr>
                          ) : (
                            members.map((row, idx) => (
                              <tr 
                                key={idx} 
                                onClick={() => {
                                  setViewingBracketUser(row.name);
                                  setViewingBracketUserId(row.uid);
                                }}
                                className={`transition-colors font-bold cursor-pointer ${
                                  row.isUser 
                                    ? 'bg-yellow-50 hover:bg-yellow-100/80 border-y-2 border-slate-950 font-extrabold text-slate-950' 
                                    : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <td className="py-4 px-4 font-sans font-black text-sm">
                                  {row.isUser ? (
                                    <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 border border-slate-950 rounded font-black text-xs">
                                      #{row.rank}
                                    </span>
                                  ) : (
                                    `#${row.rank}`
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2.5">
                                    {row.isUser ? (
                                      <img src={currentUser?.photoURL || row.avatar} className="w-6 h-6 rounded-full object-cover border border-slate-950" alt="" />
                                    ) : row.avatar ? (
                                      <img src={row.avatar} className="w-6 h-6 rounded-full object-cover border border-slate-950" alt="" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-950 flex items-center justify-center font-sans text-[10px] text-slate-500 font-black">
                                        {row.name.charAt(0)}
                                      </div>
                                    )}
                                    <span>{row.isUser ? (currentUser?.displayName || row.name) : row.name} {row.isUser && <span className="text-[10px] text-slate-400 font-sans font-bold">(You)</span>}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center font-sans font-extrabold text-slate-600">{row.picks}</td>
                                <td className="py-4 px-4 text-center font-sans font-extrabold text-slate-600">{row.accuracy}</td>
                                <td className="py-4 px-4 text-right pr-6 font-sans text-sm font-black text-slate-950">{row.points} pts</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <div className="flex justify-between items-center pb-4 border-b-2 border-slate-950">
                    <div>
                      <h2 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">My Leagues</h2>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">Compete against friends, colleagues, and custom groups.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowCreateLeagueModal(true);
                        setCreatedLeagueCode(null);
                        setCreatedLeagueNameValue('');
                        setLeaguesError(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 text-white font-sans font-black text-xs uppercase tracking-wider rounded-lg border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-800 transition-all select-none cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" /> Create League
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {leaguesList.map((league) => (
                      <div 
                        key={league.name} 
                        onClick={() => setSelectedLeague(league.name)}
                        className="border-2 border-slate-950 rounded-xl p-5 flex items-center gap-5 bg-slate-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] transition-transform cursor-pointer"
                      >
                        <div className={`w-12 h-12 rounded-xl border-2 border-slate-950 flex flex-col items-center justify-center flex-shrink-0 ${
                          league.color === 'emerald' ? 'bg-emerald-400' : league.color === 'blue' ? 'bg-blue-600' : 'bg-slate-200'
                        }`}>
                          <span className={`font-sans font-black text-[9px] uppercase tracking-wider leading-none ${league.color === 'slate' ? 'text-slate-600' : 'text-white'}`}>Rank</span>
                          <span className={`font-sans font-black text-base leading-tight ${league.color === 'slate' ? 'text-slate-800' : 'text-white'}`}>#{league.rank}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-sans font-black text-sm text-slate-900 uppercase tracking-tight truncate">{league.name}</h3>
                          <p className="font-sans font-semibold text-[11px] text-slate-400 mt-0.5">{league.members ? (typeof league.members === 'number' ? league.members : (Array.isArray(league.members) ? league.members.length : 1)) : 1} members · Code: <span className="font-black text-slate-700">{league.code}</span></p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono font-black text-2xl text-slate-950">{league.pts}</div>
                          <div className="font-sans font-black text-[10px] uppercase tracking-wider text-slate-400">pts</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 stroke-[2.5] flex-shrink-0" />
                      </div>
                    ))}

                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
                        <Plus className="w-5 h-5 text-slate-300 stroke-[2.5]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-sans font-black text-sm text-slate-500 uppercase tracking-tight">Join a League</h3>
                        <p className="font-sans font-semibold text-[11px] text-slate-400 mt-0.5">Enter a league code to compete with a group.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setShowJoinLeagueModal(true);
                          setJoinedLeagueNameValue(null);
                          setLeaguesError(null);
                        }}
                        className="px-4 py-2 border-2 border-slate-950 rounded-lg font-sans font-black text-xs uppercase tracking-wider text-slate-900 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 transition-all select-none cursor-pointer"
                      >
                        Enter Code
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {sidebarTab === 'leaderboard' && (
          <div className="bg-white rounded-2xl border-2 border-slate-950 p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[500px] text-left">
            <div className="pb-4 border-b-2 border-slate-950">
              <h2 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">Global Leaderboard</h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Rankings are calculated dynamically based on score prediction accuracy and tournament stage weight.</p>
            </div>

            <div className="overflow-x-auto border-2 border-slate-950 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-950 font-sans text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3.5 px-4 w-20">Rank</th>
                    <th className="py-3.5 px-4">Predictor</th>
                    <th className="py-3.5 px-4 text-center">Correct picks</th>
                    <th className="py-3.5 px-4 text-center">Accuracy</th>
                    <th className="py-3.5 px-4 text-right pr-6">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-150 font-sans text-xs">
                  {[]?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 px-4 text-center">
                        <div className="font-sans font-black text-slate-400 text-sm uppercase tracking-widest mb-1">Leaderboard Updating</div>
                        <div className="font-body font-semibold text-slate-500 text-xs">Check back soon for the latest global rankings.</div>
                      </td>
                    </tr>
                  ) : (
                    [].map((row: any, idx: number) => (
                      <tr 
                        key={idx} 
                        className={`transition-colors font-bold ${
                          row.isUser 
                            ? 'bg-yellow-50 hover:bg-yellow-100/80 border-y-2 border-slate-950 font-extrabold text-slate-950' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <td className="py-4 px-4 font-sans font-black text-sm">
                          {row.isUser ? (
                            <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 border border-slate-950 rounded font-black text-xs">
                              #{row.rank}
                            </span>
                          ) : (
                            `#${row.rank}`
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            {row.isUser ? (
                              <img src={currentUser?.photoURL || row.avatar} className="w-6 h-6 rounded-full object-cover border border-slate-950" alt="" />
                            ) : row.avatar ? (
                              <img src={row.avatar} className="w-6 h-6 rounded-full object-cover border border-slate-950" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-950 flex items-center justify-center font-sans text-[10px] text-slate-500 font-black">
                                {row.name.charAt(0)}
                              </div>
                            )}
                            <span>{row.isUser ? (currentUser?.displayName || row.name) : row.name} {row.isUser && <span className="text-[10px] text-slate-400 font-sans font-bold">(You)</span>}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-sans font-extrabold text-slate-600">{row.picks}</td>
                        <td className="py-4 px-4 text-center font-sans font-extrabold text-slate-600">{row.accuracy}</td>
                        <td className="py-4 px-4 text-right font-sans font-black text-slate-900 text-sm pr-6">{row.points}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sidebarTab === 'settings' && (
          <div className="bg-white rounded-2xl border-2 border-slate-950 p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[500px] text-left">
            <div className="pb-4 border-b-2 border-slate-950">
              <h2 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">Account Settings</h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Manage your predictor profile, email notifications, and preferences.</p>
            </div>

            {settingsFeedback && (
              <div className={`border-2 border-slate-950 p-4 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-sans font-black text-xs uppercase tracking-wider ${
                settingsFeedback.type === 'success' ? 'bg-emerald-450 text-slate-950' : 'bg-red-400 text-slate-950'
              }`}>
                {settingsFeedback.message}
              </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Details Card */}
              <div className="border-2 border-slate-950 p-5 rounded-xl bg-slate-50 flex flex-col gap-4">
                <h3 className="font-sans font-black text-xs uppercase tracking-wider text-slate-400 mb-2">Profile Details</h3>
                <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                  <img 
                    src={currentUser?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} 
                    alt="User avatar" 
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-950 shadow-sm"
                  />
                  <div>
                    {/* Hidden File Input */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            setSettingsFeedback({ type: 'error', message: 'File is too large! Maximum allowed is 2MB.' });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64Url = reader.result as string;
                            try {
                              await authService.updateUserProfile(settingsName, settingsUsername, base64Url);
                              setCurrentUser(prev => prev ? { ...prev, photoURL: base64Url } : null);
                              setSettingsFeedback({ type: 'success', message: 'Avatar photo updated successfully!' });
                              setTimeout(() => setSettingsFeedback(null), 4000);
                            } catch (err: any) {
                              setSettingsFeedback({ type: 'error', message: err.message || 'Failed to update avatar' });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-950 font-sans font-black px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] select-none cursor-pointer"
                    >
                      Change Avatar
                    </button>
                    <p className="text-[10px] text-slate-450 mt-1.5 font-semibold">JPG or PNG, max 2MB</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-black uppercase text-slate-455 mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full bg-white border-2 border-slate-950 px-3 py-2 rounded-lg font-sans font-extrabold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-black uppercase text-slate-455 mb-1.5">Username</label>
                  <input 
                    type="text" 
                    value={settingsUsername}
                    onChange={(e) => setSettingsUsername(e.target.value)}
                    className="w-full bg-white border-2 border-slate-950 px-3 py-2 rounded-lg font-sans font-extrabold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              {/* Notifications & Prefs Card */}
              <div className="border-2 border-slate-950 p-5 rounded-xl bg-slate-50 flex flex-col justify-between">
                <div>
                  <h3 className="font-sans font-black text-xs uppercase tracking-wider text-slate-400 mb-4">Notifications</h3>
                  <div className="flex flex-col gap-4">
                    {[
                      { 
                        title: '48-Hour Alerts', 
                        desc: 'Notify me when predictions open 48 hours before kickoff.',
                        checked: notify48h,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          setNotify48h(e.target.checked);
                          localStorage.setItem('wc_notify48h', e.target.checked.toString());
                        }
                      },
                      { 
                        title: '5-Hour Last Chance', 
                        desc: 'Remind me when 5 hours remain and I haven\'t made a prediction.',
                        checked: notify5h,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          setNotify5h(e.target.checked);
                          localStorage.setItem('wc_notify5h', e.target.checked.toString());
                        }
                      }
                    ].map((item, idx) => (
                      <label key={idx} className="flex gap-3 items-start cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={item.checked}
                          onChange={item.onChange}
                          className="mt-1 w-4 h-4 rounded border-2 border-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0 accent-blue-600"
                        />
                        <div>
                          <span className="block font-sans font-black text-xs text-slate-900">{item.title}</span>
                          <span className="block text-[10px] font-semibold text-slate-400 mt-0.5 leading-normal">{item.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={async () => {
                  try {
                    await authService.updateUserProfile(settingsName, settingsUsername);
                    setCurrentUser(prev => prev ? { ...prev, displayName: settingsName, username: settingsUsername } : null);
                    setSettingsFeedback({ type: 'success', message: 'Profile details saved successfully!' });
                    setTimeout(() => setSettingsFeedback(null), 4000);
                  } catch (err: any) {
                    setSettingsFeedback({ type: 'error', message: err.message || 'Failed to update profile' });
                  }
                }}
                className="bg-slate-950 hover:bg-slate-900 text-white font-sans font-black px-6 py-3 rounded-lg text-sm uppercase tracking-wider transition-all border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] select-none cursor-pointer active:translate-y-[2px] active:translate-x-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {sidebarTab === 'rules' && (
          <div className="bg-white rounded-2xl border-2 border-slate-950 p-6 md:p-8 flex flex-col gap-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[500px] text-left">
            <div className="pb-6 border-b-2 border-slate-950">
              <h2 className="font-sans font-black text-2xl text-slate-900 uppercase tracking-tight">Scoring Rules</h2>
              <p className="text-sm font-semibold text-slate-500 mt-1 max-w-2xl leading-relaxed">Points are awarded based on prediction accuracy and are uniform across all rounds of the tournament.</p>
            </div>

            {/* MatchCard Visual States Demo */}
            <div className="w-full flex flex-col gap-5 overflow-x-auto pb-4 border-b-2 border-slate-100">
              <h3 className="font-sans font-black text-base text-slate-900 uppercase tracking-tight">Card Visual States</h3>
              <div className="flex gap-6 min-w-max pt-3 pb-2 px-1">
                <div className="w-[270px] relative">
                  <div className="absolute top-[-22px] left-0 text-[10px] font-black text-red-500 uppercase tracking-wider">Wrong (0 pts)</div>
                  <MatchCard 
                    id="demo1" teamA={{name:'USA',code:'USA',colorKey:'#000'}} teamB={{name:'Mexico',code:'MEX',colorKey:'#000'}} 
                    scoreA="1" scoreB="0" actualScoreA="0" actualScoreB="2" status="incorrect" pointsEarned={0} isReadOnly={true}
                  />
                </div>
                <div className="w-[270px] relative">
                  <div className="absolute top-[-22px] left-0 text-[10px] font-black text-yellow-500 uppercase tracking-wider">Correct Winner (+1 pt)</div>
                  <MatchCard 
                    id="demo2" teamA={{name:'Argentina',code:'ARG',colorKey:'#000'}} teamB={{name:'Brazil',code:'BRA',colorKey:'#000'}} 
                    scoreA="2" scoreB="0" actualScoreA="1" actualScoreB="0" status="correct" pointsEarned={1} isReadOnly={true}
                  />
                </div>
                <div className="w-[270px] relative">
                  <div className="absolute top-[-22px] left-0 text-[10px] font-black text-emerald-500 uppercase tracking-wider">Correct Winner & Score (+3 pts)</div>
                  <MatchCard 
                    id="demo3" teamA={{name:'France',code:'FRA',colorKey:'#000'}} teamB={{name:'Germany',code:'GER',colorKey:'#000'}} 
                    scoreA="2" scoreB="1" actualScoreA="2" actualScoreB="1" status="correct" pointsEarned={3} isReadOnly={true}
                  />
                </div>
                <div className="w-[270px] relative">
                  <div className="absolute top-[-22px] left-0 text-[10px] font-black text-fuchsia-600 uppercase tracking-wider">Sole Predictor (+4 pts)</div>
                  <MatchCard 
                    id="demo4" teamA={{name:'England',code:'ENG',colorKey:'#000'}} teamB={{name:'Spain',code:'ESP',colorKey:'#000'}} 
                    scoreA="3" scoreB="1" actualScoreA="3" actualScoreB="1" status="correct" pointsEarned={4} isReadOnly={true}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Correct Winner Card */}
              <div className="border-2 border-slate-950 rounded-xl p-6 bg-white flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-slate-950 text-white font-sans font-black text-sm flex items-center justify-center tracking-tight flex-shrink-0">
                    1P
                  </span>
                  <h3 className="font-sans font-black text-base text-slate-900 uppercase tracking-tight">Correct Winner</h3>
                </div>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-4">Predict the correct winner or result (excluding ties if clear winner is required) to earn baseline points.</p>
                <div className="bg-white border-2 border-slate-950 rounded-lg py-3 px-4 text-center mt-auto shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="font-sans font-black text-base text-slate-900 uppercase tracking-wider">1 Point</div>
                </div>
              </div>

              {/* Exact Score Card */}
              <div className="border-2 border-slate-950 rounded-xl p-6 bg-white flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-amber-400 text-slate-950 border-2 border-slate-950 font-sans font-black text-sm flex items-center justify-center tracking-tight flex-shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    3P
                  </span>
                  <h3 className="font-sans font-black text-base text-slate-900 uppercase tracking-tight">Exact Score</h3>
                </div>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-4">Correctly predict the exact scoreline of both teams at the end of the match.</p>
                <div className="bg-amber-400 border-2 border-slate-950 rounded-lg py-3 px-4 text-center mt-auto shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-300 transition-colors">
                  <div className="font-sans font-black text-base text-slate-950 uppercase tracking-wider">3 Points</div>
                </div>
              </div>

              {/* Sole Predictor Card */}
              <div className="border-2 border-slate-950 rounded-xl p-6 bg-white flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-emerald-400 text-slate-950 border-2 border-slate-950 font-sans font-black text-sm flex items-center justify-center tracking-tight flex-shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    +1
                  </span>
                  <h3 className="font-sans font-black text-base text-slate-900 uppercase tracking-tight">Sole Predictor</h3>
                </div>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-4">Earn a special bonus if you are the only predictor in your league to call the exact scoreline.</p>
                <div className="bg-emerald-400 border-2 border-slate-950 rounded-lg py-3 px-4 text-center mt-auto shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-300 transition-colors">
                  <div className="font-sans font-black text-base text-slate-950 uppercase tracking-wider">+1 Bonus Point</div>
                </div>
              </div>

              {/* General Rules Box */}
              <div className="border-2 border-slate-950 rounded-xl p-6 md:p-8 bg-slate-50 flex flex-col gap-4 lg:col-span-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] mt-2">
                <div className="flex items-center gap-3 mb-2 pb-4 border-b-2 border-slate-200">
                  <BookOpen className="w-6 h-6 text-slate-950 stroke-[2.5] flex-shrink-0" />
                  <h3 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">General Rules</h3>
                </div>
                <ul className="flex flex-col gap-4">
                  {[
                    'Match predictions open 48 hours before kickoff and strictly lock 15 minutes before the match begins.',
                    'The bracket progresses based on real-world results. You can only predict a match once the preceding real-world matches have concluded and teams are confirmed.',
                    'Tied scores in the prediction are not valid — a clear winner must be chosen for knockout progression.',
                    'The sole predictor bonus applies dynamically per active league.',
                  ].map((rule, i) => (
                    <li key={i} className="flex items-start gap-4 text-xs font-bold text-slate-700 leading-relaxed">
                      <span className="w-6 h-6 rounded-md bg-slate-950 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{i + 1}</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

          </div>

        </div>
      </main>
      
      {/* Create League Modal */}
      {showCreateLeagueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border-4 border-slate-950 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-left flex flex-col gap-5 relative">
            <button 
              onClick={() => { 
                setShowCreateLeagueModal(false); 
                setNewLeagueName(''); 
                setCreatedLeagueCode(null);
                setCreatedLeagueNameValue('');
                setLeaguesError(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border-2 border-slate-950 flex items-center justify-center font-sans font-black hover:bg-slate-100 transition-all select-none cursor-pointer"
            >
              &times;
            </button>

            {createdLeagueCode ? (
              /* Success View */
              <div className="flex flex-col items-center text-center gap-4 py-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-amber-500">
                  <Trophy className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="font-sans font-black text-xl text-slate-900 uppercase tracking-tight">League Created!</h3>
                <p className="text-xs font-semibold text-slate-500 max-w-sm">
                  Your private league <strong className="text-slate-900">"{createdLeagueNameValue}"</strong> has been successfully registered. Share this code with friends so they can join:
                </p>
                
                <div className="w-full flex items-center gap-2 mt-2 bg-slate-50 border-2 border-slate-950 p-3.5 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <span className="font-mono font-black text-xl tracking-wider text-slate-950 flex-1 text-center select-all">
                    {createdLeagueCode}
                  </span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(createdLeagueCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-4 py-2 border-2 border-slate-950 rounded-lg font-sans font-black text-[11px] uppercase tracking-wider text-slate-900 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 transition-all select-none cursor-pointer"
                  >
                    {copiedCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setShowCreateLeagueModal(false);
                    setCreatedLeagueCode(null);
                    setCreatedLeagueNameValue('');
                  }}
                  className="w-full mt-4 bg-slate-950 hover:bg-slate-800 text-white font-sans font-black py-3 rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider text-xs transition-all select-none cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Input Form View */
              <>
                <div>
                  <h3 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">Create Private League</h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1">Challenge your friends or coworkers by starting a custom group.</p>
                </div>
                
                {leaguesError && (
                  <div className="bg-red-50 border-2 border-red-650 text-red-650 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <span>{leaguesError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-sans font-black uppercase text-slate-455 mb-1.5">League Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dream Team Predictors"
                    value={newLeagueName}
                    onChange={(e) => {
                      setNewLeagueName(e.target.value);
                      if (leaguesError) setLeaguesError(null);
                    }}
                    className="w-full bg-white border-2 border-slate-950 px-3 py-2 rounded-lg font-sans font-extrabold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button 
                  disabled={isCreatingLeague}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!newLeagueName.trim()) {
                      setLeaguesError('Please enter a league name');
                      return;
                    }
                    if (currentUser) {
                      try {
                        setIsCreatingLeague(true);
                        setLeaguesError(null);
                        const res = await authService.createLeague(currentUser.uid, newLeagueName);
                        
                        // Refresh leagues list
                        const list = await authService.loadUserLeagues(currentUser.uid);
                        const mapped = (list || []).map((l: any) => ({
                          name: l.name,
                          code: l.code,
                          members: l.members ? (Array.isArray(l.members) ? l.members.length : l.members) : 1,
                          pts: '--',
                          rank: '--',
                          color: 'blue'
                        }));
                        setLeaguesList(mapped);
                        
                        // Set success states
                        setCreatedLeagueNameValue(newLeagueName);
                        setCreatedLeagueCode(res.code);
                        setNewLeagueName('');
                        setIsCreatingLeague(false);
                      } catch (err: any) {
                        setIsCreatingLeague(false);
                        setLeaguesError(err.message || 'Failed to create league');
                      }
                    }
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-800 text-white font-sans font-black py-3 rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider text-xs transition-all select-none cursor-pointer disabled:opacity-50"
                >
                  {isCreatingLeague ? 'Starting...' : 'Start League'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoinLeagueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border-4 border-slate-950 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-left flex flex-col gap-5 relative">
            <button 
              onClick={() => { 
                setShowJoinLeagueModal(false); 
                setJoinLeagueCode(''); 
                setJoinedLeagueNameValue(null);
                setLeaguesError(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border-2 border-slate-950 flex items-center justify-center font-sans font-black hover:bg-slate-100 transition-all select-none cursor-pointer"
            >
              &times;
            </button>

            {joinedLeagueNameValue ? (
              /* Success View */
              <div className="flex flex-col items-center text-center gap-4 py-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-emerald-500">
                  <CheckCircle className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="font-sans font-black text-xl text-slate-900 uppercase tracking-tight">Successfully Joined!</h3>
                <p className="text-xs font-semibold text-slate-500 max-w-sm">
                  You are now a member of <strong className="text-slate-900">"{joinedLeagueNameValue}"</strong>! You are now competing with other members.
                </p>
                
                <button 
                  onClick={() => {
                    const targetName = joinedLeagueNameValue;
                    setShowJoinLeagueModal(false);
                    setJoinedLeagueNameValue(null);
                    if (targetName) setSelectedLeague(targetName);
                  }}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-sans font-black py-3 rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider text-xs transition-all select-none cursor-pointer"
                >
                  View League Standings
                </button>
              </div>
            ) : (
              /* Input Form View */
              <>
                <div>
                  <h3 className="font-sans font-black text-lg text-slate-900 uppercase tracking-tight">Join Private League</h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1">Enter a unique invitation code to join a friend's active league.</p>
                </div>

                {leaguesError && (
                  <div className="bg-red-50 border-2 border-red-650 text-red-650 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <span>{leaguesError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-sans font-black uppercase text-slate-455 mb-1.5">League Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ABCXYZ"
                    value={joinLeagueCode}
                    onChange={(e) => {
                      setJoinLeagueCode(e.target.value);
                      if (leaguesError) setLeaguesError(null);
                    }}
                    className="w-full bg-white border-2 border-slate-950 px-3 py-2 rounded-lg font-sans font-extrabold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button 
                  disabled={isJoiningLeague}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!joinLeagueCode.trim()) {
                      setLeaguesError('Please enter a league code');
                      return;
                    }
                    if (currentUser) {
                      try {
                        setIsJoiningLeague(true);
                        setLeaguesError(null);
                        const name = await authService.joinLeague(currentUser.uid, joinLeagueCode);
                        const list = await authService.loadUserLeagues(currentUser.uid);
                        const mapped = (list || []).map((l: any) => ({
                          name: l.name,
                          code: l.code,
                          members: l.members ? (Array.isArray(l.members) ? l.members.length : l.members) : 1,
                          pts: '--',
                          rank: '--',
                          color: 'blue'
                        }));
                        setLeaguesList(mapped);
                        
                        // Set success states
                        setJoinedLeagueNameValue(name);
                        setJoinLeagueCode('');
                        setIsJoiningLeague(false);
                      } catch (err: any) {
                        setIsJoiningLeague(false);
                        setLeaguesError(err.message || 'Failed to join league');
                      }
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-sans font-black py-3 rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider text-xs transition-all select-none cursor-pointer disabled:opacity-50"
                >
                  {isJoiningLeague ? 'Joining...' : 'Enter Code'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-slate-950 rounded-2xl p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="font-sans font-black text-xl text-slate-900 uppercase tracking-tight">{dialogConfig.title}</h3>
            <p className="font-body text-slate-700 font-semibold text-sm leading-snug">{dialogConfig.message}</p>
            <div className="flex gap-3 justify-end mt-2">
              {dialogConfig.type === 'confirm' && (
                <button
                  onClick={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-100 text-slate-700 border-2 border-slate-950 font-sans font-black text-xs uppercase tracking-wider rounded-lg hover:bg-slate-200 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (dialogConfig.onConfirm) {
                    dialogConfig.onConfirm();
                  }
                  setDialogConfig(prev => ({ ...prev, isOpen: false }));
                }}
                className={`px-4 py-2 text-white border-2 border-slate-950 font-sans font-black text-xs uppercase tracking-wider rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none transition-all ${
                  dialogConfig.type === 'confirm' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {dialogConfig.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

export default App;
