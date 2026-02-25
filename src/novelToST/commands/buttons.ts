type NovelButtonHandlers = {
  start: () => Promise<void> | void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  exportTXT: () => void;
};

const BUTTONS: ScriptButton[] = [
  { name: 'NovelToST-开始生成', visible: true },
  { name: 'NovelToST-暂停', visible: true },
  { name: 'NovelToST-恢复', visible: true },
  { name: 'NovelToST-停止', visible: true },
  { name: 'NovelToST-导出TXT', visible: true },
];

export function registerNovelButtons(handlers: NovelButtonHandlers): { unregister: () => void } {
  replaceScriptButtons(BUTTONS);

  const listeners: EventOnReturn[] = [
    eventOn(getButtonEvent('NovelToST-开始生成'), () => {
      void handlers.start();
    }),
    eventOn(getButtonEvent('NovelToST-暂停'), () => {
      handlers.pause();
    }),
    eventOn(getButtonEvent('NovelToST-恢复'), () => {
      handlers.resume();
    }),
    eventOn(getButtonEvent('NovelToST-停止'), () => {
      handlers.stop();
    }),
    eventOn(getButtonEvent('NovelToST-导出TXT'), () => {
      handlers.exportTXT();
    }),
  ];

  return {
    unregister: () => {
      listeners.forEach(listener => listener.stop());
      replaceScriptButtons([]);
    },
  };
}
