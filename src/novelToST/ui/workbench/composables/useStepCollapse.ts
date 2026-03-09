import { ref } from 'vue';

export function useStepCollapse<StepId extends string>(defaultState: Record<StepId, boolean>) {
  const stepCollapseState = ref<Record<StepId, boolean>>({ ...defaultState });

  const isStepCollapsed = (stepId: StepId): boolean => {
    return stepCollapseState.value[stepId];
  };

  const setStepCollapsed = (stepId: StepId, collapsed: boolean) => {
    stepCollapseState.value[stepId] = collapsed;
  };

  const toggleStepCollapse = (stepId: StepId) => {
    stepCollapseState.value[stepId] = !stepCollapseState.value[stepId];
  };

  const resetStepCollapseState = () => {
    stepCollapseState.value = { ...defaultState };
  };

  return {
    stepCollapseState,
    isStepCollapsed,
    setStepCollapsed,
    toggleStepCollapse,
    resetStepCollapseState,
  };
}
