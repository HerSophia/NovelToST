<template>
  <BaseCard
    title="帮助与故障排查"
    collapsible
    :collapsed="collapsed"
    :default-collapsed="true"
    @update:collapsed="emit('update:collapsed', $event)"
  >
    <div class="space-y-3 text-xs leading-relaxed text-slate-300">
      <div class="rounded border border-blue-400/25 bg-blue-500/10 px-2.5 py-2 text-slate-200">
        <p class="font-medium text-blue-200">提示</p>
        <p class="mt-1">
          各面板标题右侧的 <span class="font-semibold">❓</span> 为上下文即时帮助；本面板用于查看完整指南与排障清单。
        </p>
      </div>

      <section class="space-y-1.5">
        <h4 class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">快速上手</h4>
        <ol class="list-decimal space-y-1 pl-4 text-slate-300">
          <li>在「续写设置」确认楼层范围、角色过滤与提取模式。</li>
          <li>点击「刷新预览」，确保预览文本与预期一致。</li>
          <li>先导出 TXT 做一次小样验证，再开始批量生成。</li>
        </ol>
      </section>

      <section class="space-y-1.5">
        <h4 class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">推荐参数（标签模式）</h4>
        <ul class="list-disc space-y-1 pl-4 text-slate-300">
          <li><span class="text-slate-100">提取标签：</span><code class="rounded bg-black/35 px-1 py-0.5">content detail 正文</code></li>
          <li><span class="text-slate-100">内容分隔符：</span>双换行（段落）</li>
          <li><span class="text-slate-100">排查优先级：</span>先看预览，再看楼层快照，最后看 extract 诊断</li>
        </ul>
      </section>

      <section class="space-y-2">
        <h4 class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">常见问题</h4>
        <details class="rounded border border-white/10 bg-white/[0.02] px-2.5 py-2">
          <summary class="cursor-pointer text-slate-200">1）预览为空 / 导出为空</summary>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-4 text-slate-300">
            <li>检查楼层范围是否有效（开始楼层 ≤ 结束楼层）。</li>
            <li>检查角色过滤（是否勾选了对应 user / assistant）。</li>
            <li>标签模式下确认标签名是否与文本中的标签一致。</li>
          </ul>
        </details>

        <details class="rounded border border-white/10 bg-white/[0.02] px-2.5 py-2">
          <summary class="cursor-pointer text-slate-200">2）明明有标签，但提取不到</summary>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-4 text-slate-300">
            <li>先试 <code class="rounded bg-black/35 px-1 py-0.5">window.novelToSTDebug('floor')</code> 看 sourcePreview。</li>
            <li>再试 <code class="rounded bg-black/35 px-1 py-0.5">window.novelToSTDebug('extract', ...)</code> 对比 tags。</li>
            <li>必要时切换 useRawContent 对比 raw 与 display 差异。</li>
          </ul>
        </details>

        <details class="rounded border border-white/10 bg-white/[0.02] px-2.5 py-2">
          <summary class="cursor-pointer text-slate-200">3）控制台调用不到调试命令</summary>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-4 text-slate-300">
            <li>刷新页面后再执行：<code class="rounded bg-black/35 px-1 py-0.5">window.novelToSTDebug()</code>。</li>
            <li>若脚本运行在 iframe，可尝试：<code class="rounded bg-black/35 px-1 py-0.5">window.parent.novelToSTDebug()</code>。</li>
          </ul>
        </details>
      </section>

      <section class="space-y-1.5">
        <h4 class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">调试命令速查</h4>
        <pre class="overflow-x-auto rounded border border-white/10 bg-black/35 p-2 text-[11px] text-slate-200"><code>window.novelToSTDebug()
window.novelToSTDebug('settings')
window.novelToSTDebug('floor')
window.novelToSTDebug('floor', 20)
window.novelToSTDebug('tagPreview')
window.novelToSTDebug('extract', { messageId: 20, tags: 'content detail' })</code></pre>
      </section>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import BaseCard from '../base/BaseCard.vue';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
}>();
</script>
