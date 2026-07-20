import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { heroes, NarrativeStateMachine, type Choice, type Ending, type FinalChoice, type Hero, type PsycheLine } from './lib/gameEngine'

type Phase = 'home' | 'briefing' | 'game' | 'ending' | 'terminal'
const FINAL_MESSAGE = 'salut chers joueur je suis "x" tu peux me voir comme le createur de ce jeu, parvenu à la fin de ton aventure j\'aimerais juste savoir une chose : est ce que tu as aimé cette partie ? est ce qu\'elle t\'as plus ? ou plus precisement aurais tu vraiment mais alors vraiment fais ce choix dans la vrai vie en sachant ce qui te serais arrivé ? bien sûr tu n\'as pas me repondre immédiatement juste à garder cela dans un coin de ta tête '

function App() {
  const [phase, setPhase] = useState<Phase>('home')
  const [hero, setHero] = useState<Hero | null>(null)
  const engineRef = useRef<NarrativeStateMachine | null>(null)
  const [tick, setTick] = useState(0)
  const [ending, setEnding] = useState<Ending | null>(null)
  const [endingId, setEndingId] = useState('')
  const [discovered, setDiscovered] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('lucifer-endings') ?? '[]') } catch { return [] }
  })

  const recordEnding = useCallback((id: string) => {
    if (!hero) return
    setEnding(hero.endings[id])
    setEndingId(id)
    setDiscovered((current) => {
      const next = current.includes(id) ? current : [...current, id]
      localStorage.setItem('lucifer-endings', JSON.stringify(next))
      return next
    })
    window.setTimeout(() => setPhase('ending'), 360)
  }, [hero])

  const complete = useCallback((choice: Choice | FinalChoice) => {
    const result = engineRef.current?.choose(choice)
    if (result) recordEnding(result)
    setTick((value) => value + 1)
  }, [recordEnding])

  const panic = useCallback(() => {
    const result = engineRef.current?.panic()
    if (result?.ending) recordEnding(result.ending)
    setTick((value) => value + 1)
  }, [recordEnding])

  const start = () => {
    if (!hero) return
    engineRef.current = new NarrativeStateMachine(hero)
    setTick((value) => value + 1)
    setPhase('game')
  }

  const reset = () => {
    setHero(null); setEnding(null); setEndingId(''); engineRef.current = null; setPhase('home')
  }

  return (
    <main className="app-shell">
      <AnimatePresence mode="wait">
        {phase === 'home' && <Home key="home" onSelect={(selected) => { setHero(selected); setPhase('briefing') }} discovered={discovered.length} />}
        {phase === 'briefing' && hero && <Briefing key="briefing" hero={hero} onBack={() => setPhase('home')} onStart={start} />}
        {phase === 'game' && engineRef.current && <GameScreen key={`scene-${tick}`} engine={engineRef.current} onChoose={complete} onPanic={panic} />}
        {phase === 'ending' && ending && hero && <EndingScreen key="ending" ending={ending} endingId={endingId} hero={hero} onContinue={() => setPhase('terminal')} />}
        {phase === 'terminal' && <Terminal key="terminal" onRestart={reset} />}
      </AnimatePresence>
    </main>
  )
}

function Home({ onSelect, discovered }: { onSelect: (hero: Hero) => void; discovered: number }) {
  return <motion.section className="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <header className="topbar"><div className="brand"><span className="brand-mark">L</span><span>PROTOCOLE LUCIFER</span></div><div className="archive"><Eye size={14} /> {discovered.toString().padStart(2, '0')} / 36 ISSUES OBSERVÉES</div></header>
    <div className="home-intro"><p className="eyebrow">EXPÉRIENCE NARRATIVE COMPORTEMENTALE</p><h1>Il n’y a pas de<br/><em>bon choix.</em></h1><p className="manifesto">Seulement une situation, un système, et le temps qu’il vous reste pour décider qui vous serez à l’intérieur.</p></div>
    <div className="case-grid">{heroes.map((item) => <button className="case-card" key={item.id} onClick={() => onSelect(item)}><span className="case-index">{item.index}</span><span className="case-role">{item.role}</span><span className="case-name">{item.name}</span><span className="case-premise">{item.premise}</span><span className="case-action">OUVRIR LE DOSSIER <ArrowRight size={16}/></span></button>)}</div>
    <footer className="home-footer"><span>3 TRAJECTOIRES</span><span>36 FINS</span><span>AUCUN RETOUR EN ARRIÈRE</span></footer>
  </motion.section>
}

function Briefing({ hero, onBack, onStart }: { hero: Hero; onBack: () => void; onStart: () => void }) {
  return <motion.section className="briefing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> RETOUR AUX DOSSIERS</button>
    <div className="briefing-file"><div className="briefing-meta"><span>{hero.index}</span><span>SUJET : {hero.name}</span><span>STATUT : NON ÉVALUÉ</span></div><h2>{hero.role}</h2><p className="briefing-premise">{hero.premise}</p><div className="briefing-question">« {hero.question} »</div><div className="rules"><p><span>01</span> Le temps ne s’arrête jamais.</p><p><span>02</span> L’inaction est aussi une décision.</p><p><span>03</span> Vos choix modifient les choix proposés.</p></div><button className="primary-button" onClick={onStart}>ACCEPTER LE RÔLE <ArrowRight size={18}/></button></div>
  </motion.section>
}

function GameScreen({ engine, onChoose, onPanic }: { engine: NarrativeStateMachine; onChoose: (choice: Choice | FinalChoice) => void; onPanic: () => void }) {
  const state = engine.snapshot()
  const scene = engine.currentScene()
  const totalTime = scene.timer + 10
  const [time, setTime] = useState(totalTime)
  const [visibleLines, setVisibleLines] = useState(0)
  const [locked, setLocked] = useState(false)
  const [muted, setMuted] = useState(false)
  const revealDone = visibleLines >= scene.psyche.length
  useEffect(() => {
    const dialogue = window.setInterval(() => setVisibleLines((count) => count >= scene.psyche.length ? count : count + 1), 1750)
    const timer = window.setInterval(() => setTime((value) => Math.max(0, value - 1)), 1000)
    return () => { window.clearInterval(dialogue); window.clearInterval(timer) }
  }, [scene])
  useEffect(() => {
    if (time !== 0 || locked) return
    setLocked(true); window.setTimeout(onPanic, 500)
  }, [time, locked, onPanic])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1
      if (!revealDone || locked || index < 0 || index >= scene.choices.length) return
      setLocked(true); onChoose(scene.choices[index])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [locked, onChoose, revealDone, scene.choices])
  const choose = (choice: Choice | FinalChoice) => { if (!locked && revealDone) { setLocked(true); onChoose(choice) } }
  const progress = Math.min(4, state.sceneIndex + 1)
  return <motion.section className="game" initial={{ opacity: 0 }} animate={{ opacity: locked ? .35 : 1 }} exit={{ opacity: 0 }}>
    <header className="game-header"><div className="brand compact"><span className="brand-mark">L</span><span>PROTOCOLE LUCIFER</span></div><div className="progress-dots" aria-label={`Séquence ${progress} sur 4`}>{[1,2,3,4].map((step) => <span key={step} className={step <= progress ? 'active' : ''}>{step.toString().padStart(2,'0')}</span>)}</div><button className="sound-button" aria-label={muted ? 'Activer le son' : 'Couper le son'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>} {muted ? 'MUET' : 'SON'}</button></header>
    <div className="split-screen">
      <section className="reality-panel"><div className="panel-number">{progress.toString().padStart(2,'0')}<span>/04</span></div><div className="reality-copy"><p className="scene-detail">{scene.detail}</p><h2>{scene.reality}</h2></div><div className={`timer ${time <= 5 ? 'critical' : ''}`}><span>AVANT DÉCISION AUTOMATIQUE</span><strong>00:{time.toString().padStart(2, '0')}</strong><div className="timer-track"><i style={{ width: `${(time / totalTime) * 100}%` }}/></div></div></section>
      <section className="psyche-panel"><div className="transcript" aria-live="polite">{scene.psyche.slice(0, visibleLines).map((line, index) => <PsycheMessage key={`${index}-${line.text}`} line={line} index={index} />)}{!revealDone && <div className="thinking"><i/><i/><i/></div>}</div><AnimatePresence>{revealDone && <motion.div className="choices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><p>QUE FAITES-VOUS ? <span>TOUCHES 1—4</span></p><div className="choice-list">{scene.choices.map((choice, index) => <button key={choice.id} onClick={() => choose(choice)}><span>{(index + 1).toString().padStart(2,'0')}</span><b>{choice.text}</b><ArrowRight size={15}/></button>)}</div></motion.div>}</AnimatePresence></section>
    </div>
  </motion.section>
}

function PsycheMessage({ line, index }: { line: PsycheLine; index: number }) {
  return <motion.div className={`psyche-message ${line.speaker}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span className="entity-glyph">{line.speaker === 'voice' ? '○' : '—'}</span><div><small>{(index + 1).toString().padStart(2,'0')} / FLUX INTERNE</small><p>{line.text}</p></div></motion.div>
}

function EndingScreen({ ending, endingId, hero, onContinue }: { ending: Ending; endingId: string; hero: Hero; onContinue: () => void }) {
  const number = Number(endingId.slice(1))
  return <motion.section className="ending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .15 } }}><div className="ending-code">FIN {number.toString().padStart(2,'0')} / 12 — {hero.name}</div><div className="ending-rule"/><p className="ending-verdict">{ending.verdict}</p><h2>{ending.title}</h2><p className="ending-text">{ending.text}</p><div className="ending-observed"><Check size={14}/> ISSUE CONSIGNÉE DANS LES ARCHIVES</div><button className="primary-button" onClick={onContinue}>TERMINER L’EXPÉRIENCE <ArrowRight size={18}/></button></motion.section>
}

function Terminal({ onRestart }: { onRestart: () => void }) {
  const [count, setCount] = useState(0)
  const done = count >= FINAL_MESSAGE.length
  useEffect(() => { const id = window.setInterval(() => setCount((value) => Math.min(FINAL_MESSAGE.length, value + 1)), 31); return () => window.clearInterval(id) }, [])
  return <motion.section className="terminal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .08 }}><div className="terminal-line">root@lucifer:~$ ./debrief --subject=player</div><p>{FINAL_MESSAGE.slice(0, count)}<span className="cursor">█</span></p>{done && <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="terminal-reset" onClick={onRestart}><RotateCcw size={14}/> recommencer l'expérience</motion.button>}</motion.section>
}

export default App
