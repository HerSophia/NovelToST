export type HelpTopicId = 'generate' | 'export' | 'extract' | 'advanced' | 'worldbook';

export type HelpTopicSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  codeBlock?: string;
};

export type HelpTopic = {
  id: HelpTopicId;
  title: string;
  summary: string;
  sections: HelpTopicSection[];
};

export const HELP_TOPIC_ORDER: HelpTopicId[] = [
  'generate',
  'advanced',
  'export',
  'extract',
  'worldbook',
];

export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  generate: {
    id: 'generate',
    title: '生成流程帮助',
    summary: '用于快速理解续写主流程、开始前检查项与常见失败排查顺序。',
    sections: [
      {
        heading: '推荐流程',
        bullets: [
          '先在「标签提取工具」刷新预览，确认正文内容正确。',
          '先导出少量 TXT 做小样验收，再开启长任务自动续写。',
          '执行中优先通过状态栏观察当前章节、重试次数与异常提示。',
        ],
      },
      {
        heading: '开始前检查',
        bullets: [
          '目标章节数 >= 当前章节数。',
          '提示词明确且与当前剧情上下文一致。',
          '最小章节长度不要设置过高，避免误判为失败。',
        ],
      },
      {
        heading: '常见问题',
        bullets: [
          '重复失败：先降低最小章节长度，再检查最大重试次数。',
          '输出偏离：先收敛提示词，再减少一次性目标跨度。',
          '暂停后恢复异常：确认页面未切换聊天上下文。',
        ],
      },
    ],
  },
  advanced: {
    id: 'advanced',
    title: '高级参数帮助',
    summary: '解释发送阶段与回复阶段检测参数、稳定判定、超时与兼容选项。',
    sections: [
      {
        heading: '回复稳定判定',
        bullets: [
          '稳定检查间隔：每次轮询回复变化的时间间隔（毫秒）。',
          '稳定所需次数：连续多少次检测无变化才判定“稳定”。',
          '回复后固定等待：稳定后额外等待，缓冲模型尾部补全。',
        ],
      },
      {
        heading: '发送 / 回复弹窗检测',
        bullets: [
          '发送阶段：检测发送后短时弹窗，避免过早进入下一步。',
          '回复阶段：检测生成中弹窗，降低“尚未结束就截断”的概率。',
          '若模型响应较慢，可优先提高 replyToastWaitTimeout。',
        ],
      },
      {
        heading: '兼容与调试建议',
        bullets: [
          '等待回复开始超时与等待稳定超时建议成组调整。',
          '失败重试间隔可用于规避短时拥塞与速率限制。',
          '必要时启用“导出/提取优先使用 raw 内容”进行对照排查。',
        ],
      },
    ],
  },
  export: {
    id: 'export',
    title: '导出设置帮助',
    summary: '说明楼层范围、角色过滤与 TXT/JSON 导出的使用方式。',
    sections: [
      {
        heading: '范围与角色',
        bullets: [
          '开启“导出全部楼层”时会忽略起止楼层。',
          '仅勾选 AI 时更适合做续写素材；勾选用户可保留对话上下文。',
          '导出前建议先看“最近导出”快照，避免重复操作。',
        ],
      },
      {
        heading: '格式差异',
        bullets: [
          'TXT：适合直接阅读、人工检查或喂给其他工具。',
          'JSON：保留结构化字段，适合二次处理与脚本化流程。',
        ],
      },
      {
        heading: '常见问题',
        bullets: [
          '导出为空：先检查楼层区间与角色过滤。',
          '条数不符：确认当前聊天是否已加载全部历史消息。',
        ],
      },
    ],
  },
  extract: {
    id: 'extract',
    title: '标签提取帮助',
    summary: '用于配置标签模式、分隔符策略与快速定位提取问题。',
    sections: [
      {
        heading: '模式选择',
        bullets: [
          '全部内容模式：不过滤标签，直接提取可见文本。',
          '标签提取模式：按“提取标签”字段匹配并拼接结果。',
          '标签可用空格或逗号分隔多个候选值。',
        ],
      },
      {
        heading: '推荐参数（标签模式）',
        bullets: [
          '提取标签：content detail 正文',
          '内容分隔符：双换行（段落）',
          '排查顺序：先看预览，再看楼层快照，最后看 extract 调试输出。',
        ],
      },
      {
        heading: '调试命令速查',
        codeBlock:
          "window.novelToSTDebug('floor')\nwindow.novelToSTDebug('tagPreview')\nwindow.novelToSTDebug('extract', { messageId: 20, tags: 'content detail' })",
      },
    ],
  },
  worldbook: {
    id: 'worldbook',
    title: 'TXT 转世界书帮助',
    summary: '说明切块处理、并发策略、导入导出与失败修复的核心流程。',
    sections: [
      {
        heading: '基础流程',
        bullets: [
          '导入 TXT 或直接粘贴文本，确认字数后开始处理。',
          '先用默认参数跑一小段，再开启并行与高级选项。',
          '处理中可暂停/恢复，必要时使用停止并在安全点结束。',
        ],
      },
      {
        heading: '结果维护',
        bullets: [
          '支持条目重 Roll、删除、多选批量操作与撤销。',
          '失败块可单独重试，也可一键重试全部失败块。',
          '查找替换可用于统一修正术语、命名与口癖。',
        ],
      },
      {
        heading: '导入导出与历史',
        bullets: [
          '支持任务状态、设置、条目导入导出。',
          '导入时可选择合并策略并预览冲突。',
          '可通过历史面板回滚到之前快照。',
        ],
      },
    ],
  },
};
