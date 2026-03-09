import { z } from 'zod';

export const FoundationModuleIdSchema = z.enum([
  'positioning',
  'core',
  'protagonist',
  'keyRelations',
  'conflictFramework',
  'narrativeRules',
  'worldBrief',
  'endgame',
]);

export const FoundationModuleStatusSchema = z.enum(['empty', 'partial', 'complete']);

export const FoundationMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const FoundationPositioningSchema = z
  .object({
    title: z.string().default(''),
    genre: z.string().default(''),
    mainType: z.string().default(''),
    subType: z.string().default(''),
    targetExperience: z.array(z.string()).default([]),
    length: z.string().default(''),
    audience: z.string().default(''),
    contentIntensity: z.array(z.string()).default([]),
  })
  .prefault({});

export const FoundationCoreSchema = z
  .object({
    logline: z.string().default(''),
    coreConflict: z.string().default(''),
    coreSuspense: z.string().default(''),
    coreSellPoint: z.string().default(''),
    themeKeywords: z.array(z.string()).default([]),
    emotionalTone: z.string().default(''),
  })
  .prefault({});

export const FoundationProtagonistSchema = z
  .object({
    name: z.string().default(''),
    identity: z.string().default(''),
    visibleGoal: z.string().default(''),
    deepNeed: z.string().default(''),
    coreDesire: z.string().default(''),
    coreFear: z.string().default(''),
    coreFlaw: z.string().default(''),
    behaviorStyle: z.string().default(''),
    moralLeaning: z.string().default(''),
    mostCaredAbout: z.string().default(''),
    bottomLine: z.string().default(''),
    temptation: z.string().default(''),
    arcDirection: z.string().default(''),
  })
  .prefault({});

export const FoundationAntagonistSchema = z
  .object({
    name: z.string().default(''),
    goal: z.string().default(''),
    conflict: z.string().default(''),
  })
  .prefault({});

export const FoundationKeyCharacterSchema = z
  .object({
    id: z.string().default(''),
    name: z.string().default(''),
    role: z.string().default(''),
    relationArc: z.string().default(''),
  })
  .prefault({});

export const FoundationKeyRelationsSchema = z
  .object({
    antagonist: FoundationAntagonistSchema,
    keyCharacters: z.array(FoundationKeyCharacterSchema).default([]),
  })
  .prefault({});

export const FoundationConflictFrameworkSchema = z
  .object({
    mainConflict: z.string().default(''),
    innerConflict: z.string().default(''),
    relationConflict: z.string().default(''),
    externalObstacle: z.string().default(''),
    failureCost: z.string().default(''),
    timePressure: z.string().default(''),
    irreversibleEvents: z.array(z.string()).default([]),
    escalationPattern: z.string().default(''),
  })
  .prefault({});

export const FoundationNarrativeRulesSchema = z
  .object({
    pov: z.string().default(''),
    tenseAndStyle: z.string().default(''),
    languageQuality: z.string().default(''),
    infoDisclosure: z.string().default(''),
    allowExposition: z.boolean().default(false),
    plotDriver: z.string().default(''),
    romanceWeight: z.string().default(''),
    ensembleWeight: z.string().default(''),
    emphasisTags: z.array(z.string()).default([]),
    forbiddenPatterns: z.array(z.string()).default([]),
  })
  .prefault({});

export const FoundationWorldBriefSchema = z
  .object({
    worldType: z.string().default(''),
    requiredRules: z.array(z.string()).default([]),
    keyScenes: z.array(z.string()).default([]),
    settingPivots: z.array(z.string()).default([]),
    conflictGeneratingRules: z.array(z.string()).default([]),
    forbiddenSettings: z.array(z.string()).default([]),
  })
  .prefault({});

export const FoundationEndgameSchema = z
  .object({
    overallDirection: z.string().default(''),
    endingType: z.string().default(''),
    protagonistChanges: z.boolean().default(false),
    rootProblem: z.string().default(''),
    readerFeeling: z.string().default(''),
    mustResolve: z.array(z.string()).default([]),
  })
  .prefault({});

export const FoundationExtensionModuleSchema = z
  .object({
    id: z.string().default(''),
    title: z.string().default(''),
    fields: z.record(z.string(), z.unknown()).default({}),
  })
  .prefault({});

export const StoryFoundationSchema = z
  .object({
    positioning: FoundationPositioningSchema,
    core: FoundationCoreSchema,
    protagonist: FoundationProtagonistSchema,
    keyRelations: FoundationKeyRelationsSchema,
    conflictFramework: FoundationConflictFrameworkSchema,
    narrativeRules: FoundationNarrativeRulesSchema,
    worldBrief: FoundationWorldBriefSchema,
    endgame: FoundationEndgameSchema,
    extensions: z.array(FoundationExtensionModuleSchema).default([]),
  })
  .prefault({});

export const FoundationMessageSchema = z
  .object({
    id: z.string().default(''),
    role: FoundationMessageRoleSchema.default('user'),
    text: z.string().default(''),
    createdAt: z.string().default(''),
    parseError: z.string().nullable().optional(),
    rawResponse: z.string().optional(),
  })
  .prefault({});

export const FoundationPersistedStateSchema = z
  .object({
    foundation: StoryFoundationSchema,
    messages: z.array(FoundationMessageSchema).default([]),
    updatedAt: z.string().default(''),
  })
  .prefault({});
