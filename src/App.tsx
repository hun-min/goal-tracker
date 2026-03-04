import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Plus, Trash2, Clock, Activity, FolderOpen, ChevronRight, Home, CornerLeftUp, Archive, ArchiveRestore, AlertTriangle, Database, X, Copy, Download, History, Edit2, MonitorSmartphone, Cloud, CloudOff, CloudDownload, CloudUpload, RefreshCw, Layers } from 'lucide-react';
import { Goal } from './types';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COLORS = ['#00FF00', '#00E5FF', '#FF00FF', '#FFAA00', '#FF4444'];

export default function App() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [newGoalName, setNewGoalName] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  
  // New States
  const [showArchived, setShowArchived] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [historyGoalId, setHistoryGoalId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Goal Editing States
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalName, setEditingGoalName] = useState('');

  // Cloud Sync States
  const [syncKey, setSyncKey] = useState<string>('');
  const [syncKeyInput, setSyncKeyInput] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const isPulling = React.useRef(false);

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Load from localStorage & Cloud
  useEffect(() => {
    const saved = localStorage.getItem('chrono-goals');
    if (saved) {
      const parsed = JSON.parse(saved);
      const migrated = parsed.map((g: any) => ({ 
        ...g, 
        parentId: g.parentId || null,
        isArchived: g.isArchived || false,
        history: g.history ? g.history.map((h: any) => ({
          ...h,
          id: h.id || crypto.randomUUID()
        })) : []
      }));
      setGoals(migrated);
    }
    
    const savedActive = localStorage.getItem('chrono-active');
    if (savedActive) {
      const { id, start } = JSON.parse(savedActive);
      setActiveGoalId(id);
      setSessionStartTime(start);
    }

    const savedSyncKey = localStorage.getItem('chrono-sync-key');
    if (savedSyncKey) {
      setSyncKey(savedSyncKey);
      setSyncKeyInput(savedSyncKey);
      pullFromCloud(savedSyncKey);
    }

    setIsLoaded(true);
  }, []);

  // Save to localStorage & Auto-Push to Cloud
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('chrono-goals', JSON.stringify(goals));
      if (activeGoalId && sessionStartTime) {
        localStorage.setItem('chrono-active', JSON.stringify({ id: activeGoalId, start: sessionStartTime }));
      } else {
        localStorage.removeItem('chrono-active');
      }
      if (syncKey && !isPulling.current) {
        pushToCloud(syncKey, goals, activeGoalId, sessionStartTime);
      }
    }
  }, [goals, activeGoalId, sessionStartTime, isLoaded, syncKey]);

  // Timer tick & Visibility Change (Background optimization)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;
    
    const newGoal: Goal = {
      id: crypto.randomUUID(),
      parentId: currentParentId,
      name: newGoalName.trim(),
      totalSeconds: 0,
      color: COLORS[goals.length % COLORS.length],
      createdAt: Date.now(),
      isArchived: false,
    };
    
    setGoals([newGoal, ...goals]);
    setNewGoalName('');
  };

  const confirmDelete = (id: string) => {
    setGoalToDelete(id);
  };

  const executeDelete = () => {
    if (!goalToDelete) return;
    
    const getDescendantIds = (parentId: string): string[] => {
      const children = goals.filter(g => g.parentId === parentId);
      let ids = children.map(c => c.id);
      for (const child of children) {
        ids = [...ids, ...getDescendantIds(child.id)];
      }
      return ids;
    };
    
    const idsToDelete = [goalToDelete, ...getDescendantIds(goalToDelete)];
    
    if (activeGoalId && idsToDelete.includes(activeGoalId)) {
      stopTimer();
    }
    setGoals(goals.filter(g => !idsToDelete.includes(g.id)));
    setGoalToDelete(null);
  };

  const toggleArchive = (id: string) => {
    if (activeGoalId === id) stopTimer();
    setGoals(goals.map(g => g.id === id ? { ...g, isArchived: !g.isArchived } : g));
  };

  const toggleTimer = (id: string) => {
    if (activeGoalId === id) {
      stopTimer();
    } else {
      if (activeGoalId) stopTimer();
      setActiveGoalId(id);
      setSessionStartTime(Date.now());
      setNow(Date.now());
      setGoals(goals.map(g => g.id === id ? { ...g, lastTrackedAt: Date.now() } : g));
    }
  };

  const stopTimer = () => {
    if (activeGoalId && sessionStartTime) {
      const endTime = Date.now();
      const elapsed = Math.floor((endTime - sessionStartTime) / 1000);
      setGoals(goals.map(g => {
        if (g.id === activeGoalId) {
          const newSession = { id: crypto.randomUUID(), startTime: sessionStartTime, endTime, durationSeconds: elapsed };
          return { 
            ...g, 
            totalSeconds: g.totalSeconds + elapsed,
            history: [...(g.history || []), newSession],
            lastTrackedAt: Date.now()
          };
        }
        return g;
      }));
    }
    setActiveGoalId(null);
    setSessionStartTime(null);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getActiveElapsed = () => {
    if (!sessionStartTime) return 0;
    return Math.floor((now - sessionStartTime) / 1000);
  };

  const getAggregateSeconds = (goalId: string): number => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return 0;
    let total = goal.totalSeconds;
    if (activeGoalId === goalId) total += getActiveElapsed();

    const children = goals.filter(g => g.parentId === goalId);
    for (const child of children) {
      total += getAggregateSeconds(child.id);
    }
    return total;
  };

  const getChildCount = (goalId: string): number => {
    return goals.filter(g => g.parentId === goalId).length;
  };

  const getBreadcrumbs = () => {
    const crumbs = [];
    let current = goals.find(g => g.id === currentParentId);
    while (current) {
      crumbs.unshift(current);
      current = goals.find(g => g.id === current.parentId);
    }
    return crumbs;
  };

  const getAggregateHistory = (goalId: string) => {
    let allSessions: { id: string; startTime: number; endTime: number; durationSeconds: number; goalName: string; goalId: string }[] = [];
    
    const gather = (id: string, prefix: string) => {
      const goal = goals.find(g => g.id === id);
      if (!goal) return;
      
      const name = prefix ? `${prefix} > ${goal.name}` : goal.name;
      
      if (goal.history) {
        allSessions = [...allSessions, ...goal.history.map(h => ({ ...h, goalName: name, goalId: goal.id }))];
      }
      
      const children = goals.filter(g => g.parentId === id);
      for (const child of children) {
        gather(child.id, name);
      }
    };
    
    gather(goalId, "");
    return allSessions.sort((a, b) => b.startTime - a.startTime);
  };

  const handleDeleteSession = (goalId: string, sessionId: string, durationSeconds: number) => {
    setGoals(goals.map(g => {
      if (g.id === goalId) {
        return {
          ...g,
          totalSeconds: Math.max(0, g.totalSeconds - durationSeconds),
          history: g.history?.filter(h => h.id !== sessionId)
        };
      }
      return g;
    }));
  };

  const startEditingSession = (session: any) => {
    setEditingSessionId(session.id);
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    setEditStartTime(new Date(session.startTime - tzOffset).toISOString().slice(0, 16));
    setEditEndTime(new Date(session.endTime - tzOffset).toISOString().slice(0, 16));
  };

  const saveSessionEdit = (goalId: string, sessionId: string, oldDuration: number) => {
    const start = new Date(editStartTime).getTime();
    const end = new Date(editEndTime).getTime();
    if (isNaN(start) || isNaN(end) || end < start) {
      alert("Invalid time range.");
      return;
    }
    const newDuration = Math.floor((end - start) / 1000);
    const durationDiff = newDuration - oldDuration;

    setGoals(goals.map(g => {
      if (g.id === goalId) {
        return {
          ...g,
          totalSeconds: Math.max(0, g.totalSeconds + durationDiff),
          history: g.history?.map(h => h.id === sessionId ? { ...h, startTime: start, endTime: end, durationSeconds: newDuration } : h)
        };
      }
      return g;
    }));
    setEditingSessionId(null);
  };

  const pullFromCloud = async (key: string) => {
    setIsSyncing(true);
    try {
      const docRef = doc(db, "user_sync", key);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const json = docSnap.data();
        if (json.data) {
          isPulling.current = true;
          if (Array.isArray(json.data)) {
            setGoals(json.data);
          } else {
            setGoals(json.data.goals || []);
            setActiveGoalId(json.data.activeGoalId || null);
            setSessionStartTime(json.data.sessionStartTime || null);
          }
          setTimeout(() => isPulling.current = false, 100);
        }
      }
    } catch (e) {
      console.error("Failed to pull from Firebase", e);
      alert("Firebase sync failed. Please check your Firestore rules.");
    } finally {
      setIsSyncing(false);
    }
  };

  const pushToCloud = async (key: string, data: Goal[], activeId: string | null, startTime: number | null) => {
    setIsSyncing(true);
    try {
      const docRef = doc(db, "user_sync", key);
      await setDoc(docRef, {
        data: { goals: data, activeGoalId: activeId, sessionStartTime: startTime },
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error("Failed to push to Firebase", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const startEditingGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditingGoalName(goal.name);
  };

  const saveGoalName = (id: string) => {
    if (editingGoalName.trim()) {
      setGoals(goals.map(g => g.id === id ? { ...g, name: editingGoalName.trim() } : g));
    }
    setEditingGoalId(null);
  };

  const renderTree = (parentId: string | null, depth: number = 0) => {
    const children = goals.filter(g => g.parentId === parentId && !g.isArchived);
    if (children.length === 0) return null;
    
    return (
      <div className="flex flex-col w-full">
        {children.map(goal => {
          const hasChildren = goals.some(g => g.parentId === goal.id && !g.isArchived);
          return (
            <div key={goal.id} className="flex flex-col w-full">
              <div 
                className={`flex items-center justify-between py-2.5 px-3 hover:bg-white/10 cursor-pointer border-l-2 ${depth === 0 ? 'border-[#00E5FF]' : 'border-white/20'} transition-colors group`}
                style={{ marginLeft: `${depth * 16}px` }}
                onClick={() => {
                  setCurrentParentId(hasChildren ? goal.id : goal.parentId);
                  setShowOverviewModal(false);
                }}
              >
                <div className="flex items-center gap-3">
                  {hasChildren ? <FolderOpen size={14} className="text-[#00E5FF]" /> : <Activity size={14} className="text-white/40" />}
                  <span className="text-white/80 font-mono text-sm group-hover:text-white">{goal.name}</span>
                </div>
                <span className="text-[#00E5FF] font-mono text-xs">
                  {formatTime(getAggregateSeconds(goal.id))}
                </span>
              </div>
              {renderTree(goal.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  if (!isLoaded) return null;

  const activeGoal = goals.find(g => g.id === activeGoalId);
  const currentGoals = goals
    .filter(g => g.parentId === currentParentId && (showArchived ? g.isArchived : !g.isArchived))
    .sort((a, b) => {
      const aTime = a.lastTrackedAt || a.createdAt;
      const bTime = b.lastTrackedAt || b.createdAt;
      return bTime - aTime;
    });
  const breadcrumbs = getBreadcrumbs();

  // Day Cycle & Timeline Calculation
  const nowObj = new Date(now);
  const startOfDay = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate()).getTime();
  const endOfDay = startOfDay + 86400000;
  const secondsPassed = Math.floor((now - startOfDay) / 1000);
  const dayPercent = (now - startOfDay) / 864000;
  const secondsLeft = 86400 - secondsPassed;

  let todayFocusSeconds = 0;
  const todaySessions: { startPercent: number; widthPercent: number; color: string }[] = [];

  goals.forEach(goal => {
    if (goal.history) {
      goal.history.forEach(session => {
        if (session.endTime > startOfDay && session.startTime < endOfDay) {
          const sTime = Math.max(session.startTime, startOfDay);
          const eTime = Math.min(session.endTime, endOfDay);
          const duration = Math.floor((eTime - sTime) / 1000);
          todayFocusSeconds += duration;

          todaySessions.push({
            startPercent: ((sTime - startOfDay) / 86400000) * 100,
            widthPercent: ((eTime - sTime) / 86400000) * 100,
            color: goal.color
          });
        }
      });
    }
  });

  if (activeGoalId && sessionStartTime) {
    const activeGoal = goals.find(g => g.id === activeGoalId);
    if (now > startOfDay && sessionStartTime < endOfDay) {
      const sTime = Math.max(sessionStartTime, startOfDay);
      const eTime = Math.min(now, endOfDay);
      const duration = Math.floor((eTime - sTime) / 1000);
      todayFocusSeconds += duration;

      todaySessions.push({
        startPercent: ((sTime - startOfDay) / 86400000) * 100,
        widthPercent: ((eTime - sTime) / 86400000) * 100,
        color: activeGoal?.color || '#00E5FF'
      });
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto flex flex-col gap-8 pb-32">
      
      {/* Day Cycle Progress */}
      <div className="w-full hardware-card rounded-xl p-4 flex flex-col gap-4 border-t-2 border-t-[#00E5FF]">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#00E5FF]">
              <Clock size={16} />
              <span className="font-mono text-xs tracking-widest uppercase font-bold">Today's Timeline</span>
            </div>
            <div className="font-mono text-sm text-white/80 mt-1">
              <span className="text-white/40 text-xs mr-2">FOCUSED</span>
              {formatTime(todayFocusSeconds)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-xs text-[#00E5FF] tracking-widest font-bold">
              {nowObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} <span className="text-white/40">NOW</span>
            </div>
            <div className="font-mono text-sm text-white/80 mt-1">
              {formatTime(secondsLeft)} <span className="text-white/40 text-xs">REMAINING</span>
            </div>
          </div>
        </div>
        
        <div className="relative h-2.5 w-full mt-2">
          {/* Background & Sessions (Clipped) */}
          <div className="absolute inset-0 bg-black/80 rounded-full overflow-hidden border border-white/10">
            {/* 24 Hour Markers */}
            <div className="absolute inset-0 flex justify-between px-0 pointer-events-none">
              {[...Array(24)].map((_, i) => (
                <div key={i} className={`h-full w-px ${i % 6 === 0 ? 'bg-white/20' : 'bg-white/5'}`} />
              ))}
            </div>

            {/* Focus Sessions */}
            {todaySessions.map((session, i) => (
              <div 
                key={i}
                className="absolute top-0 bottom-0 opacity-80"
                style={{ 
                  left: `${session.startPercent}%`, 
                  width: `${Math.max(session.widthPercent, 0.1)}%`,
                  backgroundColor: session.color,
                  boxShadow: `0 0 10px ${session.color}`
                }}
              />
            ))}
          </div>

          {/* Current Time Indicator (Unclipped) */}
          <div 
            className="absolute -top-2 -bottom-2 w-[1px] bg-[#00E5FF] z-10 shadow-[0_0_10px_#00E5FF,0_0_2px_#00E5FF] transition-all duration-1000 ease-linear"
            style={{ left: `${dayPercent}%` }}
          />
        </div>
      </div>

      {/* Header */}
      <header className="flex flex-col gap-2 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 text-white/50">
            <Activity size={20} className="text-[#00FF00]" />
            <span className="font-mono text-xs tracking-widest uppercase">Investment Tracker v2.1</span>
          </div>
          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-2 text-[#00FF00] hover:text-[#00FF00]/80 transition-colors font-mono text-xs border border-[#00FF00]/30 px-3 py-1.5 rounded-lg bg-[#00FF00]/10"
              >
                <MonitorSmartphone size={14} />
                <span className="hidden sm:inline">INSTALL APP</span>
              </button>
            )}
            <button 
              onClick={() => setShowOverviewModal(true)}
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors font-mono text-xs border border-white/10 px-3 py-1.5 rounded-lg bg-white/5"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">OVERVIEW</span>
            </button>
            <button 
              onClick={() => setShowSyncModal(true)}
              className={`flex items-center gap-2 transition-colors font-mono text-xs border px-3 py-1.5 rounded-lg ${
                syncKey 
                  ? 'text-[#00E5FF] border-[#00E5FF]/30 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20' 
                  : 'text-white/50 hover:text-white border-white/10 bg-white/5'
              }`}
            >
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : (syncKey ? <Cloud size={14} /> : <CloudOff size={14} />)}
              <span>{syncKey ? 'CLOUD SYNCED' : 'CLOUD SYNC'}</span>
            </button>
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter">
          TIME <span className="text-white/20">CANVAS</span>
        </h1>
        <p className="text-white/50 font-mono text-sm mt-2">
          Allocate your most valuable asset. Watch your mastery grow.
        </p>
      </header>

      {/* Breadcrumbs & Add Goal */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/50 font-mono text-sm overflow-x-auto pb-2 scrollbar-hide flex-1">
            {currentParentId !== null && !showArchived && (
              <button 
                onClick={() => {
                  const current = goals.find(g => g.id === currentParentId);
                  setCurrentParentId(current?.parentId || null);
                }}
                className="hover:text-white transition-colors flex items-center justify-center w-6 h-6 rounded bg-white/10 shrink-0 mr-2"
                title="Go Back Up"
              >
                <CornerLeftUp size={14} />
              </button>
            )}
            <button 
              onClick={() => setCurrentParentId(null)}
              className={`hover:text-white transition-colors flex items-center gap-1 shrink-0 ${currentParentId === null ? 'text-white' : ''}`}
            >
              <Home size={14} />
              <span>ROOT</span>
            </button>
            {breadcrumbs.map(crumb => (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={14} className="opacity-50 shrink-0" />
                <button 
                  onClick={() => setCurrentParentId(crumb.id)}
                  className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${currentParentId === crumb.id ? 'text-white' : ''}`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`shrink-0 flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-lg transition-colors border ${
              showArchived 
                ? 'bg-[#FFAA00]/20 text-[#FFAA00] border-[#FFAA00]/30' 
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
            }`}
          >
            <Archive size={14} />
            {showArchived ? 'VIEWING ARCHIVE' : 'SHOW ARCHIVED'}
          </button>
        </div>

        {!showArchived && (
          <form onSubmit={handleAddGoal} className="flex gap-4">
            <input
              type="text"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              placeholder={currentParentId ? "Add a sub-task..." : "What do you want to master? (e.g., Work, Exercise)"}
              className="flex-1 bg-[#151619] border border-white/10 rounded-xl px-6 py-4 text-lg focus:outline-none focus:border-white/30 transition-colors font-sans"
            />
            <button 
              type="submit"
              disabled={!newGoalName.trim()}
              className="bg-white text-black px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-white/90 disabled:opacity-50 transition-all shrink-0"
            >
              <Plus size={24} />
              <span className="hidden sm:inline">Initialize</span>
            </button>
          </form>
        )}
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {currentGoals.map(goal => {
            const isActive = activeGoalId === goal.id;
            const displaySeconds = getAggregateSeconds(goal.id);
            const childCount = getChildCount(goal.id);
            
            // 1 dot = 1 hour (3600 seconds)
            const hoursInvested = Math.floor(displaySeconds / 3600);
            const dots = Array.from({ length: Math.max(24, hoursInvested + (24 - (hoursInvested % 24))) });

            return (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`hardware-card rounded-2xl p-6 relative overflow-hidden transition-all duration-300 flex flex-col min-h-[300px] ${isActive ? 'ring-1 ring-offset-4 ring-offset-[#0a0a0a]' : ''} ${goal.isArchived ? 'opacity-70 grayscale' : ''}`}
                style={{ '--tw-ring-color': goal.color } as React.CSSProperties}
              >
                {/* Background Glow if active */}
                {isActive && (
                  <div 
                    className="absolute inset-0 opacity-10 blur-3xl transition-opacity duration-1000 pointer-events-none"
                    style={{ backgroundColor: goal.color }}
                  />
                )}

                <div className="relative z-10 flex flex-col h-full gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="text-2xl font-bold tracking-tight mb-1 flex items-start gap-2 group">
                        {editingGoalId === goal.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingGoalName}
                            onChange={(e) => setEditingGoalName(e.target.value)}
                            onBlur={() => saveGoalName(goal.id)}
                            onKeyDown={(e) => e.key === 'Enter' && saveGoalName(goal.id)}
                            className="bg-black/50 border border-[#00E5FF]/50 rounded px-2 py-1 w-full text-white focus:outline-none text-xl"
                          />
                        ) : (
                          <>
                            <span className="break-words flex-1">{goal.name}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); startEditingGoal(goal); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white p-1 shrink-0 mt-1"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                        {childCount > 0 && editingGoalId !== goal.id && (
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/60 font-mono shrink-0 mt-2">
                            {childCount} SUB
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-white/40 font-mono text-xs uppercase tracking-wider">
                        <Clock size={12} />
                        <span>Created {new Date(goal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 -mr-2 -mt-2 shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setHistoryGoalId(goal.id); }}
                        className="text-white/20 hover:text-[#00E5FF] transition-colors p-2"
                        title="View History"
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleArchive(goal.id); }}
                        className="text-white/20 hover:text-[#FFAA00] transition-colors p-2"
                        title={goal.isArchived ? "Restore" : "Archive"}
                      >
                        {goal.isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); confirmDelete(goal.id); }}
                        className="text-white/20 hover:text-red-500 transition-colors p-2"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Time Display */}
                  <div className="flex-1 flex flex-col justify-center py-2">
                    <div className="timer-display text-5xl font-light tracking-tight" style={{ color: isActive ? goal.color : 'white' }}>
                      {formatTime(displaySeconds)}
                    </div>
                    <div className="text-white/30 font-mono text-xs mt-2 uppercase tracking-widest">
                      {childCount > 0 ? 'Total Aggregate Time' : 'Total Time Invested'}
                    </div>
                  </div>

                  {/* Dot Matrix (Hours) */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/40 font-mono text-[10px] uppercase tracking-widest">Mastery Matrix (1 dot = 1 hr)</span>
                      <span className="text-white/60 font-mono text-xs" style={{ color: goal.color }}>{hoursInvested} HRS</span>
                    </div>
                    <div className="dot-matrix">
                      {dots.map((_, i) => (
                        <div 
                          key={i} 
                          className={`dot ${i < hoursInvested ? 'active' : ''}`}
                          style={{ 
                            backgroundColor: i < hoursInvested ? goal.color : undefined,
                            color: goal.color
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!goal.isArchived && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => toggleTimer(goal.id)}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${
                          isActive 
                            ? 'bg-white/10 text-white hover:bg-white/20' 
                            : 'bg-white text-black hover:bg-white/90'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Square size={16} fill="currentColor" />
                            <span>STOP</span>
                          </>
                        ) : (
                          <>
                            <Play size={16} fill="currentColor" />
                            <span>TRACK</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setCurrentParentId(goal.id)}
                        className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-[#1a1b1e] text-white hover:bg-[#2a2b2e] border border-white/5 text-sm"
                      >
                        <FolderOpen size={16} />
                        <span>ENTER</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {currentGoals.length === 0 && currentParentId === null && !showArchived && (
          <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl text-white/30 font-mono text-sm">
            No active investments. Initialize a goal to begin.
          </div>
        )}
        
        {currentGoals.length === 0 && currentParentId !== null && !showArchived && (
          <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl text-white/30 font-mono text-sm flex items-center justify-center min-h-[300px]">
            Directory empty. Initialize a sub-task.
          </div>
        )}

        {currentGoals.length === 0 && showArchived && (
          <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl text-white/30 font-mono text-sm">
            Archive is empty.
          </div>
        )}
      </div>

      {/* Floating Active Timer Banner */}
      <AnimatePresence>
        {activeGoal && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 hardware-card rounded-full px-8 py-4 flex items-center gap-6 z-50 border border-white/10 whitespace-nowrap"
            style={{ boxShadow: `0 10px 40px -10px ${activeGoal.color}40` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: activeGoal.color, boxShadow: `0 0 10px ${activeGoal.color}` }} />
              <span className="font-bold tracking-tight truncate max-w-[150px] sm:max-w-[300px]">{activeGoal.name}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="timer-display text-2xl" style={{ color: activeGoal.color }}>
              {formatTime(getAggregateSeconds(activeGoal.id))}
            </div>
            <button 
              onClick={stopTimer}
              className="ml-4 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <Square size={16} fill="currentColor" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {goalToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="hardware-card rounded-2xl p-6 max-w-sm w-full border border-white/10"
            >
              <div className="flex items-center gap-3 text-white mb-4">
                <Trash2 size={24} className="text-red-400" />
                <h2 className="text-xl font-bold">Delete Item</h2>
              </div>
              <p className="text-white/60 mb-6 font-mono text-sm leading-relaxed">
                Are you sure? This will also delete all sub-tasks inside it.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setGoalToDelete(null)}
                  className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Modal */}
      <AnimatePresence>
        {showSyncModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="hardware-card rounded-2xl p-8 max-w-2xl w-full border border-white/10 flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#00E5FF]">
                  <Cloud size={24} />
                  <h2 className="text-2xl font-bold tracking-tight">CLOUD SYNCHRONIZATION</h2>
                </div>
                <button onClick={() => setShowSyncModal(false)} className="text-white/50 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 font-mono text-xs text-white/70 leading-relaxed">
                <strong className="text-white">How to sync PC & Mobile automatically:</strong><br/>
                Enter a unique <strong>Secret Sync Key</strong> (e.g., your email or a secret phrase). 
                Once linked, your data will automatically sync to the cloud whenever you make a change. 
                Enter the exact same key on your other device to link them.
              </div>

              <div className="space-y-4">
                <label className="font-mono text-xs uppercase tracking-widest text-white/50">Secret Sync Key</label>
                <input 
                  type="text"
                  value={syncKeyInput}
                  onChange={(e) => setSyncKeyInput(e.target.value)}
                  placeholder="Enter a unique secret key..."
                  className="w-full bg-black border border-white/10 rounded-xl p-4 font-mono text-sm text-white focus:outline-none focus:border-[#00E5FF] transition-colors"
                />
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => {
                      localStorage.setItem('chrono-sync-key', syncKeyInput);
                      setSyncKey(syncKeyInput);
                      pullFromCloud(syncKeyInput);
                      setShowSyncModal(false);
                    }}
                    disabled={!syncKeyInput.trim()}
                    className="flex-1 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <CloudDownload size={18} />
                    <span>PULL FROM CLOUD</span>
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.setItem('chrono-sync-key', syncKeyInput);
                      setSyncKey(syncKeyInput);
                      pushToCloud(syncKeyInput, goals, activeGoalId, sessionStartTime);
                      setShowSyncModal(false);
                    }}
                    disabled={!syncKeyInput.trim()}
                    className="flex-1 py-3 rounded-xl font-bold bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <CloudUpload size={18} />
                    <span>PUSH TO CLOUD</span>
                  </button>
                </div>

                {syncKey && (
                  <button 
                    onClick={() => {
                      localStorage.removeItem('chrono-sync-key');
                      setSyncKey('');
                      setSyncKeyInput('');
                    }}
                    className="w-full py-3 mt-4 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <CloudOff size={18} />
                    <span>UNLINK DEVICE</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {historyGoalId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="hardware-card rounded-2xl p-6 md:p-8 max-w-2xl w-full border border-white/10 flex flex-col gap-6 max-h-[90vh]"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-[#00E5FF]">
                  <History size={24} />
                  <h2 className="text-2xl font-bold tracking-tight">SESSION LOGS</h2>
                </div>
                <button onClick={() => setHistoryGoalId(null)} className="text-white/50 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                {getAggregateHistory(historyGoalId).length > 0 ? (
                  getAggregateHistory(historyGoalId).map((session) => (
                    <div key={session.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {editingSessionId === session.id ? (
                        <div className="flex flex-col gap-3 w-full">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Start Time</label>
                              <input 
                                type="datetime-local" 
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(e.target.value)}
                                className="bg-black border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00E5FF]"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[10px] text-white/40 font-mono uppercase tracking-widest">End Time</label>
                              <input 
                                type="datetime-local" 
                                value={editEndTime}
                                onChange={(e) => setEditEndTime(e.target.value)}
                                className="bg-black border border-white/20 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#00E5FF]"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setEditingSessionId(null)} className="px-4 py-2 rounded-lg font-bold bg-white/10 hover:bg-white/20 transition-colors text-xs">CANCEL</button>
                            <button onClick={() => saveSessionEdit(session.goalId, session.id, session.durationSeconds)} className="px-4 py-2 rounded-lg font-bold bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 transition-colors text-xs">SAVE</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-white/90 text-sm">{session.goalName}</span>
                            <div className="flex items-center gap-2 font-mono text-xs text-white/40">
                              <span>{new Date(session.startTime).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>{new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(session.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="font-mono text-xl text-[#00E5FF]">
                              {formatTime(session.durationSeconds)}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => startEditingSession(session)} className="p-2 text-white/20 hover:text-white transition-colors rounded-lg hover:bg-white/5" title="Edit Session">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDeleteSession(session.goalId, session.id, session.durationSeconds)} className="p-2 text-white/20 hover:text-red-500 transition-colors rounded-lg hover:bg-white/5" title="Delete Session">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center border border-dashed border-white/10 rounded-xl text-white/30 font-mono text-sm">
                    No sessions recorded yet.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview Modal */}
      <AnimatePresence>
        {showOverviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowOverviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl hardware-card rounded-2xl p-6 md:p-8 flex flex-col gap-6 max-h-[85vh]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#00E5FF]">
                  <Layers size={24} />
                  <h2 className="text-2xl font-bold tracking-tight">SYSTEM OVERVIEW</h2>
                </div>
                <button onClick={() => setShowOverviewModal(false)} className="text-white/50 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 font-mono text-xs text-white/70 leading-relaxed">
                <strong className="text-white">Directory Tree:</strong><br/>
                Click any item to jump directly to its location. Folders are marked with <FolderOpen size={12} className="inline text-[#00E5FF] mx-1" /> and tasks with <Activity size={12} className="inline text-white/40 mx-1" />.
              </div>

              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 bg-black/30 border border-white/10 rounded-xl p-4">
                {renderTree(null, 0)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
