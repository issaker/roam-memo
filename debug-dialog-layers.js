// 检查 Dialog 及其直接父容器的背景色
(function() {
  console.log('========== Dialog 层级背景色检查 ==========\n');
  
  const dialog = document.querySelector('.bp3-dialog');
  if (!dialog) { console.log('❌ 未找到 Dialog'); return; }
  
  // 从 Dialog 向上检查 5 层
  let current = dialog;
  for (let i = 0; i < 5 && current; i++) {
    const tag = current.tagName.toLowerCase();
    const cls = current.className ? '.' + current.className.split(' ').slice(0, 3).join('.') : '';
    const computed = getComputedStyle(current);
    const bg = computed.backgroundColor;
    const inline = current.style.backgroundColor || '(无)';
    
    console.log(`层级 ${i}: <${tag}${cls}>`);
    console.log(`  计算后: ${bg}`);
    console.log(`  Inline: ${inline}`);
    console.log('');
    
    current = current.parentElement;
  }
  
  console.log('📦 Body:', getComputedStyle(document.body).backgroundColor);
  console.log('📦 HTML class:', document.documentElement.className);
})();
