import React from 'react';
import { Lock, Check, X, Pen } from 'lucide-react';

export interface Team {
  name: string;
  code: string;
  colorKey: string; // matches the --color-nation-{colorKey} variable
}

export interface MatchCardProps {
  id: string | number;
  round?: string;
  teamA: Team | null;
  teamB: Team | null;
  scoreA: string;
  scoreB: string;
  onScoreLock?: (matchId: string | number, teamAVal: string, teamBVal: string) => void;
  status: 'locked' | 'open' | 'correct' | 'incorrect';
  actualScoreA?: string;
  actualScoreB?: string;
  popularityText?: string;
  connectorType?: 'top' | 'bottom' | 'none';
  hasConnectorLine?: boolean;
  connectorHeight?: string;
  pointsEarned?: number | null;
  isReadOnly?: boolean;
}

const flagMap: Record<string, string> = {
  USA: 'us', NED: 'nl', ENG: 'gb-eng', SEN: 'sn', ARG: 'ar', AUS: 'au',
  FRA: 'fr', POL: 'pl', BRA: 'br', GER: 'de', CAN: 'ca', BEL: 'be',
  MEX: 'mx', ESP: 'es', POR: 'pt', URU: 'uy', ITA: 'it', SUI: 'ch',
  CRO: 'hr', JPN: 'jp', MAR: 'ma', COL: 'co', DEN: 'dk', TUN: 'tn',
  KOR: 'kr', GHA: 'gh', ECU: 'ec', IRN: 'ir', CMR: 'cm', SRB: 'rs',
  SWE: 'se', UKR: 'ua', RSA: 'za', BIH: 'ba', CIV: 'ci', NOR: 'no',
  // Additional 2026 nations
  CZE: 'cz', PAR: 'py', QAT: 'qa', TUR: 'tr', CUW: 'cw', NZL: 'nz',
  CPV: 'cv', KSA: 'sa', HAI: 'ht', SCO: 'gb-sct', PAN: 'pa', ALG: 'dz',
  AUT: 'at', JOR: 'jo', IRQ: 'iq', COD: 'cd', UZB: 'uz', EGY: 'eg',
};

export const MatchCard: React.FC<MatchCardProps> = ({
  id,
  teamA,
  teamB,
  scoreA,
  scoreB,
  onScoreLock,
  status,
  actualScoreA,
  actualScoreB,
  popularityText,
  connectorType = 'none',
  hasConnectorLine = false,
  connectorHeight,
  pointsEarned,
  isReadOnly = false,
  round = 'R32',
}) => {
  const [localScoreA, setLocalScoreA] = React.useState(scoreA);
  const [localScoreB, setLocalScoreB] = React.useState(scoreB);
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    setLocalScoreA(scoreA);
    setLocalScoreB(scoreB);
  }, [scoreA, scoreB]);

  const isLocked = !teamA || !teamB || status === 'locked' || status === 'correct' || status === 'incorrect';
  const isCorrect = status === 'correct';
  const isIncorrect = status === 'incorrect';

  // Determine card border based on points earned
  let borderClass = 'border-slate-950';
  let badgeColorClass = 'text-slate-500 bg-slate-100 border-slate-200';
  
  // NOTE: importing SCORING_SCHEME dynamically here to avoid circular dep just for coloring
  const scheme = { winner: 1, exact: 3, sole: 1 };
  if (round === 'R16') { scheme.winner = 2; scheme.exact = 5; scheme.sole = 2; }
  else if (round === 'QF') { scheme.winner = 3; scheme.exact = 7; scheme.sole = 3; }
  else if (round === 'SF' || round === 'Third') { scheme.winner = 4; scheme.exact = 9; scheme.sole = 4; }
  else if (round === 'Final') { scheme.winner = 5; scheme.exact = 12; scheme.sole = 5; }

  if (pointsEarned !== undefined && pointsEarned !== null) {
    if (pointsEarned === 0) {
      // Wrong prediction (0 points)
      borderClass = 'border-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)]';
      badgeColorClass = 'text-red-700 bg-red-50 border-red-200';
    } else if (pointsEarned === scheme.winner) {
      // Correct winner
      borderClass = 'border-yellow-500 shadow-[2px_2px_0px_0px_rgba(234,179,8,1)]';
      badgeColorClass = 'text-yellow-700 bg-yellow-50 border-yellow-200';
    } else if (pointsEarned === scheme.exact) {
      // Correct winner & score
      borderClass = 'border-emerald-500 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]';
      badgeColorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (pointsEarned === (scheme.exact + scheme.sole)) {
      // Correct winner & score + Bonus
      borderClass = 'border-fuchsia-600 shadow-[2px_2px_0px_0px_rgba(192,38,211,1)]';
      badgeColorClass = 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200';
    } else {
      borderClass = 'border-emerald-500 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]';
      badgeColorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
  } else {
    // Fallback to legacy status styling for points not calculated yet
    if (isCorrect) {
      borderClass = 'border-emerald-600 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]';
      badgeColorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (isIncorrect) {
      borderClass = 'border-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)]';
      badgeColorClass = 'text-red-700 bg-red-50 border-red-200';
    }
  }

  const handlePredict = (team: 'A' | 'B', val: string) => {
    if (val === '' || /^\d+$/.test(val)) {
      if (team === 'A') setLocalScoreA(val);
      else setLocalScoreB(val);
    }
  };

  const handleLock = () => {
    if (localScoreA !== '' && localScoreB !== '') {
      onScoreLock?.(id, localScoreA, localScoreB);
      setIsEditing(false);
    }
  };

  const getPointsEarned = (): number | null => {
    if (!teamA || !teamB || scoreA === '' || scoreB === '') return null;
    if (actualScoreA === undefined || actualScoreB === undefined) return null;
    
    const predA = parseInt(scoreA);
    const predB = parseInt(scoreB);
    
    const actA = parseInt(actualScoreA);
    const actB = parseInt(actualScoreB);
    
    if (isNaN(predA) || isNaN(predB) || isNaN(actA) || isNaN(actB)) return 0;
    
    if (predA === actA && predB === actB) {
      return scheme.exact;
    }
    
    const predWinner = predA > predB ? 'A' : predB > predA ? 'B' : 'Draw';
    const actWinner = actA > actB ? 'A' : actB > actA ? 'B' : 'Draw';
    
    if (predWinner === actWinner && predWinner !== 'Draw') {
      return scheme.winner;
    }
    
    return 0;
  };

  const points = pointsEarned !== undefined && pointsEarned !== null ? pointsEarned : getPointsEarned();

  const finalConnectorHeight = connectorHeight || 'calc(50% + 12px)';

  const hasUnsavedChanges = localScoreA !== scoreA || localScoreB !== scoreB;
  const canLock = localScoreA !== '' && localScoreB !== '' && hasUnsavedChanges;

  return (
    <div className="relative h-[162px]">
      {/* Thick connecting lines */}
      {connectorType === 'top' && (
        <div 
          className="bracket-connector top" 
          style={{ height: finalConnectorHeight, borderRightWidth: '2px', borderTopWidth: '2px' }}
        >
          {hasConnectorLine && <div className="bracket-line" />}
        </div>
      )}
      {connectorType === 'bottom' && (
        <div 
          className="bracket-connector bottom" 
          style={{ height: finalConnectorHeight, borderRightWidth: '2px', borderBottomWidth: '2px' }} 
        />
      )}

      {/* Card Body — fixed 162px height per design spec */}
      <div 
        className={`match-card border-2 ${borderClass} h-[162px] px-5 pt-4 pb-2 rounded-xl flex flex-col bg-white overflow-hidden`}
      >
        {/* Teams section — flex-1 so it fills remaining card height evenly */}
        <div className="flex flex-col flex-1 min-h-0 justify-around">

        {/* Team A Entry */}
        <div className="flex justify-between items-center z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {teamA ? (
              <>
                <img 
                  src={`https://flagcdn.com/w40/${flagMap[teamA.code] || 'un'}.png`} 
                  alt={`${teamA.name} flag`}
                  className="w-[22px] h-[16px] object-cover border-2 border-slate-950 rounded-sm shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex-shrink-0" 
                />
                <span className="font-sans font-extrabold text-slate-900 text-sm tracking-tight truncate">
                  {teamA.name}
                </span>
              </>
            ) : (
              <>
                <div className="w-[22px] h-[16px] bg-slate-50 border-2 border-slate-300 border-dashed rounded-sm flex-shrink-0" />
                <span className="font-sans font-extrabold text-slate-400 text-sm tracking-tight italic select-none">
                  TBD
                </span>
              </>
            )}
            {isCorrect && actualScoreA !== undefined && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
            {isIncorrect && actualScoreA !== undefined && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </div>
          <input
            type="text"
            maxLength={2}
            disabled={!teamA || !teamB || isLocked || isReadOnly || (!hasUnsavedChanges && localScoreA !== '' && localScoreB !== '' && !isEditing)}
            value={teamA && teamB ? localScoreA : ''}
            placeholder="-"
            onChange={(e) => handlePredict('A', e.target.value)}
            className="input-score font-sans font-black text-sm border-2 flex-shrink-0"
          />
        </div>

        {/* Divider */}
        <div className="h-[2px] bg-slate-950 w-full flex-shrink-0" />

        {/* Team B Entry */}
        <div className="flex justify-between items-center z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {teamB ? (
              <>
                <img 
                  src={`https://flagcdn.com/w40/${flagMap[teamB.code] || 'un'}.png`} 
                  alt={`${teamB.name} flag`}
                  className="w-[22px] h-[16px] object-cover border-2 border-slate-950 rounded-sm shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex-shrink-0" 
                />
                <span className="font-sans font-extrabold text-slate-900 text-sm tracking-tight truncate">
                  {teamB.name}
                </span>
              </>
            ) : (
              <>
                <div className="w-[22px] h-[16px] bg-slate-50 border-2 border-slate-300 border-dashed rounded-sm flex-shrink-0" />
                <span className="font-sans font-extrabold text-slate-400 text-sm tracking-tight italic select-none">
                  TBD
                </span>
              </>
            )}
          </div>
          <input
            type="text"
            maxLength={2}
            disabled={!teamA || !teamB || isLocked || isReadOnly || (!hasUnsavedChanges && localScoreA !== '' && localScoreB !== '' && !isEditing)}
            value={teamA && teamB ? localScoreB : ''}
            placeholder="-"
            onChange={(e) => handlePredict('B', e.target.value)}
            className="input-score font-sans font-black text-sm border-2 flex-shrink-0"
          />
        </div>

        </div> {/* end teams section */}

        {/* Footer */}
        <div className="flex justify-between items-center pt-1 z-10 border-t border-slate-100">
          {/* Footer Action Area */}
          <div className="flex items-center gap-1.5 font-sans text-[10px] font-black uppercase tracking-wider">
            {!teamA || !teamB ? (
              <span className="flex items-center gap-1 text-slate-400">
                Awaiting Teams
              </span>
            ) : isReadOnly ? (
              localScoreA !== '' && localScoreB !== '' ? (
                <span className="flex items-center gap-1 text-blue-600">
                  <Check className="w-3 h-3 stroke-[3]" /> PICKED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  NO PICK YET
                </span>
              )
            ) : isLocked ? (
              <span className="flex items-center gap-1 text-slate-400">
                <Lock className="w-3 h-3 stroke-[2.5]" /> Locked
              </span>
            ) : hasUnsavedChanges || isEditing ? (
              <button 
                onClick={handleLock}
                disabled={!canLock}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border-2 border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${canLock ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-300' : 'bg-slate-200 text-slate-400 border-slate-300 shadow-none'}`}
              >
                <Check className="w-3 h-3 stroke-[3]" /> LOCK PICK
              </button>
            ) : !hasUnsavedChanges && localScoreA !== '' && localScoreB !== '' ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded border-2 border-slate-950 bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                <Pen className="w-3 h-3 stroke-[3]" /> EDIT PICK
              </button>
            ) : (
              <button 
                disabled
                className="flex items-center gap-1 px-2 py-0.5 rounded border-2 border-slate-300 bg-slate-100 text-slate-400 shadow-none"
              >
                <Check className="w-3 h-3 stroke-[3]" /> LOCK PICK
              </button>
            )}
          </div>

          {/* Actual score status or user popularity percentage */}
          <div className="flex items-center gap-2 font-sans text-[10px] font-black uppercase tracking-wider">
            {points !== null && pointsEarned !== null && pointsEarned !== undefined && (
              <span className={`px-1.5 py-0.5 rounded border-2 font-mono shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-[9px] ${
                points === (scheme.exact + scheme.sole) ? 'bg-fuchsia-400 border-fuchsia-950 text-fuchsia-950 font-black' :
                points === scheme.exact ? 'bg-emerald-400 border-slate-950 text-slate-950 font-black' :
                points === scheme.winner ? 'bg-yellow-400 border-slate-950 text-slate-950 font-black' :
                'bg-red-450 border-slate-300 text-slate-500 shadow-none'
              }`}>
                {points > 0 ? `+${points}` : '0'} PTS
              </span>
            )}
            {teamA && teamB && actualScoreA !== undefined && actualScoreB !== undefined ? (
              <span className={`px-2 py-0.5 rounded border ${badgeColorClass}`}>
                Res: {actualScoreA}-{actualScoreB}
              </span>
            ) : (
              <span className="text-slate-400">
                {teamA && teamB ? popularityText || 'No picks' : ''}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
