export type WorkbenchTab = 'foundation' | 'worldbuilding' | 'outline' | 'llm' | 'detail' | 'generation';

export type WorkbenchOpenDetail = {
  tab?: WorkbenchTab;
  chapter?: number;
};

export const WORKBENCH_OPEN_EVENT = 'novelToST:workbench:open';
export const WORKBENCH_CLOSE_EVENT = 'novelToST:workbench:close';
export const WORKBENCH_FOCUS_EVENT = 'novelToST:workbench:focus';

export function emitWorkbenchOpen(detail: WorkbenchOpenDetail = {}): void {
  window.dispatchEvent(
    new CustomEvent<WorkbenchOpenDetail>(WORKBENCH_OPEN_EVENT, {
      detail,
    }),
  );
}

export function emitWorkbenchClose(): void {
  window.dispatchEvent(new CustomEvent(WORKBENCH_CLOSE_EVENT));
}

export function emitWorkbenchFocus(): void {
  window.dispatchEvent(new CustomEvent(WORKBENCH_FOCUS_EVENT));
}
