import {
  computeFoundationGenerationReadiness,
  getFoundationTierSummary,
  hasAdvancedFoundationContent,
  hasMeaningfulFoundationValue,
} from '@/novelToST/core/foundation-tier';
import { createEmptyFoundationPersistedState } from '@/novelToST/stores/foundation/foundation.normalize';
import type { StoryFoundation } from '@/novelToST/types/foundation';

function createFoundation(patch?: (foundation: StoryFoundation) => void): StoryFoundation {
  const state = createEmptyFoundationPersistedState();
  patch?.(state.foundation);
  return state.foundation;
}

describe('foundation-tier', () => {
  it('should use conservative meaningful-value rules for booleans and nested values', () => {
    expect(hasMeaningfulFoundationValue('  ')).toBe(false);
    expect(hasMeaningfulFoundationValue('题材')).toBe(true);
    expect(hasMeaningfulFoundationValue(false)).toBe(false);
    expect(hasMeaningfulFoundationValue(true)).toBe(true);
    expect(hasMeaningfulFoundationValue(['', '  ', '有效项'])).toBe(true);
    expect(hasMeaningfulFoundationValue({ a: '', b: false, c: [] })).toBe(false);
    expect(hasMeaningfulFoundationValue({ a: '', b: { c: '有效值' } })).toBe(true);
  });

  it('should block generation until minimum readiness requirements are satisfied', () => {
    const emptyFoundation = createFoundation();
    const emptyReadiness = computeFoundationGenerationReadiness(emptyFoundation);

    expect(emptyReadiness.canGenerate).toBe(false);
    expect(emptyReadiness.minimumSatisfiedCount).toBe(0);
    expect(emptyReadiness.minimumTotalCount).toBe(3);
    expect(emptyReadiness.blockingItems.map(item => item.key)).toEqual([
      'positioning.genre',
      'core.logline',
      'protagonist.identity-or-name-or-visibleGoal',
    ]);
    expect(emptyReadiness.shouldRemind).toBe(false);

    const readyFoundation = createFoundation(foundation => {
      foundation.positioning.genre = '古风权谋';
      foundation.core.logline = '失势世子在乱局中以假死反制对手。';
      foundation.protagonist.identity = '失势世子';
    });
    const readyReadiness = computeFoundationGenerationReadiness(readyFoundation);

    expect(readyReadiness.canGenerate).toBe(true);
    expect(readyReadiness.minimumSatisfiedCount).toBe(3);
    expect(readyReadiness.blockingItems).toEqual([]);
  });

  it('should mark missing basic and intermediate recommendations for reminder', () => {
    const foundation = createFoundation(base => {
      base.positioning.genre = '古风权谋';
      base.core.logline = '失势世子在乱局中以假死反制对手。';
      base.protagonist.name = '沈砚';
    });

    const readiness = computeFoundationGenerationReadiness(foundation);

    expect(readiness.canGenerate).toBe(true);
    expect(readiness.shouldRemind).toBe(true);
    expect(readiness.recommendedItems.map(item => item.key)).toEqual([
      'positioning.title',
      'positioning.mainType',
      'core.coreConflict',
      'core.emotionalTone',
      'protagonist.deepNeed',
      'protagonist.coreFlaw',
      'keyRelations.antagonist-core',
      'conflictFramework.mainConflict',
      'conflictFramework.failureCost',
      'worldBrief.worldType',
      'worldBrief.requiredRules',
    ]);
  });

  it('should summarize tiers and detect advanced content without counting empty extensions', () => {
    const emptyAdvancedFoundation = createFoundation(foundation => {
      foundation.positioning.genre = '古风权谋';
      foundation.core.logline = '失势世子在乱局中以假死反制对手。';
      foundation.protagonist.visibleGoal = '夺回兵权';
      foundation.worldBrief.worldType = '架空王朝';
      foundation.extensions = [{ id: 'ext-1', title: '', fields: {} }];
    });

    expect(hasAdvancedFoundationContent(emptyAdvancedFoundation)).toBe(false);

    const advancedFoundation = createFoundation(foundation => {
      foundation.positioning.genre = '古风权谋';
      foundation.core.logline = '失势世子在乱局中以假死反制对手。';
      foundation.protagonist.visibleGoal = '夺回兵权';
      foundation.worldBrief.worldType = '架空王朝';
      foundation.narrativeRules.languageQuality = '冷峻克制';
      foundation.extensions = [{ id: 'ext-2', title: '平台限制', fields: {} }];
    });

    expect(hasAdvancedFoundationContent(advancedFoundation)).toBe(true);
    expect(getFoundationTierSummary(advancedFoundation)).toEqual({
      basic: {
        filled: 3,
        total: 3,
        ready: true,
      },
      intermediate: {
        filled: 1,
        total: 3,
      },
      advanced: {
        filled: 2,
        total: 3,
        hasContent: true,
      },
    });
  });
});
