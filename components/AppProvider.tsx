'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnalysisJob, AnswerValue, EvaluationMode, PersistedState, Project, ProjectReport } from '../types';
import { detectProjectKind } from '../data/questions';
import { createAnalysisJob } from '../services/analysisService';

const KEY = 'agentscope:state:v3';
type Ctx = PersistedState & { hydrated:boolean; createProject:(idea:string,mode?:EvaluationMode)=>string; setAnswer:(id:string,value:AnswerValue)=>void; setCurrentQuestion:(n:number)=>void; setReport:(r:ProjectReport|null)=>void; setAnalysisJob:(j:AnalysisJob|null)=>void; setEvaluationMode:(mode:EvaluationMode)=>void; setReportView:(mode:EvaluationMode)=>void; setUpgradePending:(pending:boolean)=>void; reset:()=>void };
const Context = createContext<Ctx|null>(null);
const initial:PersistedState = { version:3, project:null, answers:{}, currentQuestion:0, report:null, analysisJob:null, reportView:'quick', upgradePending:false };

export function AppProvider({children}:{children:React.ReactNode}) {
  const [state,setState] = useState<PersistedState>(initial);
  const [hydrated,setHydrated] = useState(false);
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem('agentscope:state:v2');
      if(raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if(parsed.project) setState({...initial,...parsed,version:3,project:{...parsed.project,evaluationMode:parsed.project.evaluationMode||'expert'},reportView:parsed.reportView||parsed.project.evaluationMode||'expert'});
      }
    } catch { localStorage.removeItem(KEY); localStorage.removeItem('agentscope:state:v2'); }
    finally { setHydrated(true); }
  },[]);
  useEffect(()=>{ if(hydrated) localStorage.setItem(KEY,JSON.stringify(state)); },[state,hydrated]);
  const value = useMemo<Ctx>(()=>({...state,hydrated,
    createProject:(idea,mode='quick')=>{const id=crypto.randomUUID();const project:Project={id,idea,kind:detectProjectKind(idea),evaluationMode:mode,createdAt:new Date().toISOString()};setState({...initial,project,answers:{idea},reportView:mode});return id;},
    setAnswer:(id,value)=>setState(s=>({...s,answers:{...s.answers,[id]:value}})),
    setCurrentQuestion:n=>setState(s=>({...s,currentQuestion:n})),
    setReport:report=>setState(s=>({...s,report})),
    setAnalysisJob:analysisJob=>setState(s=>({...s,analysisJob})),
    setEvaluationMode:mode=>setState(s=>({...s,project:s.project?{...s.project,evaluationMode:mode}:null,reportView:mode})),
    setReportView:reportView=>setState(s=>({...s,reportView})),
    setUpgradePending:upgradePending=>setState(s=>({...s,upgradePending})),
    reset:()=>{setState(initial);localStorage.removeItem(KEY);localStorage.removeItem('agentscope:state:v2');}
  }),[state,hydrated]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp(){const value=useContext(Context);if(!value)throw new Error('AppProvider missing');return value;}
export function newJob(mode:EvaluationMode='expert'){return createAnalysisJob(mode);}
