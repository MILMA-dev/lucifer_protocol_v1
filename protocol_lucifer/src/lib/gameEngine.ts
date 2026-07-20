import gameData from '../data/gameData.json'

export type PsycheBranch = 'descent' | 'resistance' | 'panic'
export type HeroId = 'civil' | 'agent' | 'banker'
export type Speaker = 'voice' | 'thought'

export interface PsycheLine { speaker: Speaker; text: string }
export interface Choice {
  id: string
  text: string
  tone: PsycheBranch
  dehumanization: number
  hunted: number
}
export interface Scene {
  id: string
  reality: string
  detail: string
  timer: number
  psyche: PsycheLine[]
  choices: Choice[]
}
export interface FinalChoice extends Choice { ending: string }
export interface FinalScene extends Omit<Scene, 'choices'> { choices: FinalChoice[] }
export interface Ending { title: string; verdict: string; text: string }
export interface Hero {
  id: HeroId
  index: string
  name: string
  role: string
  premise: string
  question: string
  scenes: Scene[]
  finals: Record<PsycheBranch, FinalScene>
  endings: Record<string, Ending>
}

export interface GameState {
  hero: Hero
  sceneIndex: number
  dehumanization: number
  hunted: number
  branch: PsycheBranch
  history: string[]
}

export class NarrativeStateMachine {
  private state: GameState

  constructor(hero: Hero) {
    this.state = { hero, sceneIndex: 0, dehumanization: 0, hunted: 0, branch: 'resistance', history: [] }
  }

  snapshot(): GameState { return { ...this.state, history: [...this.state.history] } }

  currentScene(): Scene | FinalScene {
    if (this.state.sceneIndex < this.state.hero.scenes.length) return this.state.hero.scenes[this.state.sceneIndex]
    return this.state.hero.finals[this.state.branch]
  }

  choose(choice: Choice | FinalChoice) {
    this.state.dehumanization += choice.dehumanization
    this.state.hunted += choice.hunted
    this.state.history.push(choice.id)
    if (choice.tone === 'panic') this.state.branch = 'panic'
    else if (this.state.dehumanization >= 4) this.state.branch = 'descent'
    else if (this.state.dehumanization <= 0) this.state.branch = 'resistance'
    this.state.sceneIndex += 1
    return 'ending' in choice ? choice.ending : null
  }

  panic() {
    const scene = this.currentScene()
    const panicChoice = scene.choices.find((choice) => choice.tone === 'panic') ?? scene.choices[0]
    return { choice: panicChoice, ending: this.choose(panicChoice) }
  }
}

export const heroes = gameData.heroes as unknown as Hero[]
