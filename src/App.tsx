import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Plus, Trash2, Clock, Activity, FolderOpen, ChevronRight, Home, CornerLeftUp, Archive, ArchiveRestore, AlertTriangle, Database, X, Copy, Download, History, Edit2, MonitorSmartphone } from 'lucide-react';
import { Goal } from './types';

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
  const [importData, setImportData] = useState('');
  const [historyGoalId, setHistoryGoalId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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

  // Load from localStorage
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
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('chrono-goals', JSON.stringify(goals));
    }
  }, [goals, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      if (activeGoalId && sessionStartTime) {
        localStorage.setItem('chrono-active', JSON.stringify({ id: activeGoalId, start: sessionStartTime }));
      } else {
        localStorage.removeItem('chrono-active');
      }
    }
  }, [activeGoalId, sessionStartTime, isLoaded]);

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
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
            history: [...(g.history || []), newSession]
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

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importData);
      if (Array.isArray(parsed)) {
        setGoals(parsed);
        setImportData('');
        setShowSyncModal(false);
        alert("Data imported successfully!");
      } else {
        alert("Invalid data format.");
      }
    } catch (e) {
      alert("Failed to parse data. Please check the format.");
    }
  };

  if (!isLoaded) return null;

  const activeGoal = goals.find(g => g.id === activeGoalId);
  const currentGoals = goals.filter(g => g.parentId === currentParentId && (showArchived ? g.isArchived : !g.isArchived));
  const breadcrumbs = getBreadcrumbs();

  // Day Cycle Calculation
  const nowObj = new Date(now);
  const startOfDay = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate()).getTime();
  const secondsPassed = Math.floor((now - startOfDay) / 1000);
  const dayPercent = (secondsPassed / 86400) * 100;
  const remainingPercent = 100 - dayPercent;
  const secondsLeft = 86400 - secondsPassed;

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto flex flex-col gap-8 pb-32">
      
      {/* Day Cycle Progress */}
      <div className="w-full hardware-card rounded-xl p-4 flex flex-col gap-2 border-t-2 border-t-[#00E5FF]">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-2 text-[#00E5FF]">
            <Clock size={16} />
            <span className="font-mono text-xs tracking-widest uppercase font-bold">Day Cycle</span>
          </div>
          <div className="font-mono text-sm text-white/80">
            {formatTime(secondsLeft)} <span className="text-white/40 text-xs">REMAINING</span>
          </div>
        </div>
        <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/10">
          <div 
            className="h-full bg-[#00E5FF] transition-all duration-1000 ease-linear"
            style={{ width: `${remainingPercent}%`, boxShadow: '0 0 10px #00E5FF' }}
          />
        </div>
        <div className="text-right font-mono text-[10px] text-[#00E5FF]/60 tracking-widest">
          {remainingPercent.toFixed(1)}% REMAINING
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
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors font-mono text-xs border border-white/10 px-3 py-1.5 rounded-lg bg-white/5"
            >
              <Database size={14} />
              <span>DATA SYNC</span>
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
          {currentParentId !== null && !showArchived && (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => {
                const current = goals.find(g => g.id === currentParentId);
                setCurrentParentId(current?.parentId || null);
              }}
              className="hardware-card rounded-2xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-colors border-dashed min-h-[300px]"
            >
              <CornerLeftUp size={32} className="text-white/30" />
              <span className="font-mono text-sm text-white/50 uppercase tracking-widest">Go Back Up</span>
            </motion.div>
          )}

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
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
                        {goal.name}
                        {childCount > 0 && (
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/60 font-mono">
                            {childCount} SUB
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-white/40 font-mono text-xs uppercase tracking-wider">
                        <Clock size={12} />
                        <span>Created {new Date(goal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 -mr-2 -mt-2">
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
                  <Database size={24} />
                  <h2 className="text-2xl font-bold tracking-tight">DATA SYNCHRONIZATION</h2>
                </div>
                <button onClick={() => setShowSyncModal(false)} className="text-white/50 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 font-mono text-xs text-white/70 leading-relaxed">
                <strong className="text-white">How to sync PC & Mobile:</strong><br/>
                Since this app runs securely in your browser without a central server, you can manually sync your data. 
                Copy the Export Data below, send it to yourself (via KakaoTalk, Notes, or Email), and paste it into the Import section on your other device.
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-widest text-white/50">Export Data (Copy this)</label>
                <div className="relative">
                  <textarea 
                    readOnly
                    value={JSON.stringify(goals)}
                    className="w-full h-24 bg-black border border-white/10 rounded-xl p-4 font-mono text-xs text-white/50 focus:outline-none resize-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(goals));
                      alert("Copied to clipboard!");
                    }}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-white"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase tracking-widest text-white/50">Import Data (Paste here)</label>
                <textarea 
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste your exported JSON data here..."
                  className="w-full h-24 bg-black border border-white/10 rounded-xl p-4 font-mono text-xs text-white focus:outline-none focus:border-[#00E5FF]/50 resize-none transition-colors"
                />
                <button 
                  onClick={handleImport}
                  disabled={!importData.trim()}
                  className="w-full py-3 rounded-xl font-bold bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  <span>OVERWRITE & IMPORT DATA</span>
                </button>
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

    </div>
  );
}
