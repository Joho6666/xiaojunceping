'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnalysisJob, AnswerValue, EvaluationMode, PersistedState, Project, ProjectReport } from '../types';
import { detectProjectKind } from '../data/questions';
import { createAnalysisJob } from '../services/analysisService';

const KEY = 'agentscope:state:v3';
const HISTORY_KEY = 'agentscope:history:v1';
type HistoryEntry = Omit<PersistedState, "project"> & { project:Project; savedAt:string };
type Ctx = PersistedState & { hydrated:boolean; history:HistoryEntry[]; createProject:(idea:string,mode?:EvaluationMode,connection?:{id:string;model?:string})=>string; openHistory:(id:string)=>void; setAnswer:(id:string,value:AnswerValue)=>void; setCurrentQuestion:(n:number)=>void; setReport:(r:ProjectReport|null)=>void; setAnalysisJob:(j:AnalysisJob|null)=>void; setEvaluationMode:(mode:EvaluationMode)=>void; setReportView:(mode:EvaluationMode)=>void; setUpgradePending:(pending:boolean)=>void; reset:()=>void };
const Context = createContext<Ctx|null>(null);
const initial:PersistedState = { version:3, project:null, answers:{}, currentQuestion:0, report:null, analysisJob:null, reportView:'quick', upgradePending:false };

export function AppProvider({children}:{children:React.ReactNode}) {
  const [state,setState] = useState<PersistedState>(initial);
  const [history,setHistory] = useState<HistoryEntry[]>([]);
  const [hydrated,setHydrated] = useState(false);
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem('agentscope:state:v2');
      if(raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if(parsed.project) {
          const kind = ['video','web','cad','pcb','automation','general'].includes(parsed.project.kind) ? parsed.project.kind : 'general';
          const mode = parsed.project.evaluationMode === 'expert' ? 'expert' : 'quick';
          setState({...initial,...parsed,version:3,project:{...parsed.project,kind,evaluationMode:mode},reportView:parsed.reportView === 'expert' ? 'expert' : mode});
        }
      }
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        const parsedHistory = JSON.parse(rawHistory) as HistoryEntry[];
        // Persisted history may predate the current kind enum; normalize like
        // the main-state restore above so consumers can rely on project.kind.
        const kinds = ['video','web','cad','pcb','automation','general'];
        if (Array.isArray(parsedHistory)) setHistory(parsedHistory
          .filter((entry) => entry?.project?.id && typeof entry.project.idea === 'string')
          .map((entry) => ({ ...entry, project: { ...entry.project, kind: kinds.includes(entry.project.kind) ? entry.project.kind : 'general' } })));
      }
    } catch { localStorage.removeItem(KEY); localStorage.removeItem('agentscope:state:v2'); }
    finally { setHydrated(true); }
  },[]);
  useEffect(()=>{
    if (!hydrated) return;
    localStorage.setItem(KEY,JSON.stringify(state));
    const project = state.project;
    if (project) {
      setHistory((current) => {
        const entry:HistoryEntry = {...state, project, savedAt:new Date().toISOString()};
        const next = [entry, ...current.filter((item) => item.project.id !== project.id)].slice(0, 20);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    }
  },[state,hydrated]);
  const value = useMemo<Ctx>(()=>({...state,hydrated,history,
    createProject:(idea,mode='quick',connection)=>{const id=crypto.randomUUID();const project:Project={id,idea,kind:detectProjectKind(idea),evaluationMode:mode,createdAt:new Date().toISOString(),selectedConnectionId:connection?.id,selectedModel:connection?.model};setState({...initial,project,answers:{idea},reportView:mode});return id;},
    openHistory:(id)=>{const entry=history.find((item)=>item.project?.id===id);if(entry)setState({...entry,version:3});},
    setAnswer:(id,value)=>setState(s=>({...s,answers:{...s.answers,[id]:value}})),
    setCurrentQuestion:n=>setState(s=>({...s,currentQuestion:n})),
    setReport:report=>setState(s=>({...s,report})),
    setAnalysisJob:analysisJob=>setState(s=>({...s,analysisJob})),
    setEvaluationMode:mode=>setState(s=>({...s,project:s.project?{...s.project,evaluationMode:mode}:null,reportView:mode})),
    setReportView:reportView=>setState(s=>({...s,reportView})),
    setUpgradePending:upgradePending=>setState(s=>({...s,upgradePending})),
    reset:()=>{setState(initial);localStorage.removeItem(KEY);localStorage.removeItem('agentscope:state:v2');}
  }),[state,hydrated,history]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp(){const value=useContext(Context);if(!value)throw new Error('AppProvider missing');return value;}
export function newJob(mode:EvaluationMode='expert'){return createAnalysisJob(mode);}
