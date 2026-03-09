export type FoundationPositioning = {
  title: string;
  genre: string;
  mainType: string;
  subType: string;
  targetExperience: string[];
  length: string;
  audience: string;
  contentIntensity: string[];
};

export type FoundationCore = {
  logline: string;
  coreConflict: string;
  coreSuspense: string;
  coreSellPoint: string;
  themeKeywords: string[];
  emotionalTone: string;
};

export type FoundationProtagonist = {
  name: string;
  identity: string;
  visibleGoal: string;
  deepNeed: string;
  coreDesire: string;
  coreFear: string;
  coreFlaw: string;
  behaviorStyle: string;
  moralLeaning: string;
  mostCaredAbout: string;
  bottomLine: string;
  temptation: string;
  arcDirection: string;
};

export type FoundationAntagonist = {
  name: string;
  goal: string;
  conflict: string;
};

export type FoundationKeyCharacter = {
  id: string;
  name: string;
  role: string;
  relationArc: string;
};

export type FoundationKeyRelations = {
  antagonist: FoundationAntagonist;
  keyCharacters: FoundationKeyCharacter[];
};

export type FoundationConflictFramework = {
  mainConflict: string;
  innerConflict: string;
  relationConflict: string;
  externalObstacle: string;
  failureCost: string;
  timePressure: string;
  irreversibleEvents: string[];
  escalationPattern: string;
};

export type FoundationNarrativeRules = {
  pov: string;
  tenseAndStyle: string;
  languageQuality: string;
  infoDisclosure: string;
  allowExposition: boolean;
  plotDriver: string;
  romanceWeight: string;
  ensembleWeight: string;
  emphasisTags: string[];
  forbiddenPatterns: string[];
};

export type FoundationWorldBrief = {
  worldType: string;
  requiredRules: string[];
  keyScenes: string[];
  settingPivots: string[];
  conflictGeneratingRules: string[];
  forbiddenSettings: string[];
};

export type FoundationEndgame = {
  overallDirection: string;
  endingType: string;
  protagonistChanges: boolean;
  rootProblem: string;
  readerFeeling: string;
  mustResolve: string[];
};

export type FoundationModuleId =
  | 'positioning'
  | 'core'
  | 'protagonist'
  | 'keyRelations'
  | 'conflictFramework'
  | 'narrativeRules'
  | 'worldBrief'
  | 'endgame';

export type FoundationModuleStatus = 'empty' | 'partial' | 'complete';

export type FoundationExtensionModule = {
  id: string;
  title: string;
  fields: Record<string, unknown>;
};

export type StoryFoundation = {
  positioning: FoundationPositioning;
  core: FoundationCore;
  protagonist: FoundationProtagonist;
  keyRelations: FoundationKeyRelations;
  conflictFramework: FoundationConflictFramework;
  narrativeRules: FoundationNarrativeRules;
  worldBrief: FoundationWorldBrief;
  endgame: FoundationEndgame;
  extensions: FoundationExtensionModule[];
};

export type FoundationMessageRole = 'user' | 'assistant' | 'system';

export type FoundationMessage = {
  id: string;
  role: FoundationMessageRole;
  text: string;
  createdAt: string;
  parseError?: string | null;
  rawResponse?: string;
};

export type FoundationState = {
  foundation: StoryFoundation;
  messages: FoundationMessage[];
  moduleStatuses: Record<FoundationModuleId, FoundationModuleStatus>;
  updatedAt: string;
};

export type FoundationPersistedState = Pick<FoundationState, 'foundation' | 'messages' | 'updatedAt'>;

export const FOUNDATION_MODULE_IDS: FoundationModuleId[] = [
  'positioning',
  'core',
  'protagonist',
  'keyRelations',
  'conflictFramework',
  'narrativeRules',
  'worldBrief',
  'endgame',
];

export const REQUIRED_FIELDS: Record<FoundationModuleId, string[]> = {
  positioning: ['genre', 'mainType'],
  core: ['logline', 'coreConflict', 'coreSellPoint', 'emotionalTone'],
  protagonist: ['visibleGoal', 'deepNeed', 'coreFlaw'],
  keyRelations: ['antagonist.name', 'antagonist.goal', 'antagonist.conflict'],
  conflictFramework: ['mainConflict', 'failureCost'],
  narrativeRules: ['languageQuality'],
  worldBrief: [],
  endgame: ['endingType'],
};
