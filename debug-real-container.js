// 找到真正的背景容器
(function() {
  console.log('========== 查找真正的背景容器 ==========\n');
  
  const dialog = document.querySelector('.bp3-dialog');
  if (!dialog) { console.log('❌ 未找到 Dialog'); return; }
  
  // 从 Dialog 向上遍历，检查每个元素的视觉效果
  let current = dialog;
  let depth = 0;
  
  while (current && depth < 10) {
    const tag = current.tagName.toLowerCase();
    const cls = current.className ? current.className.split(' ').slice(0, 3).join(' ') : '';
    const computed = getComputedStyle(current);
    const bg = computed.backgroundColor;
    
    // 检查是否有实际背景色（不是透明）
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    
    console.log(`层级 ${depth}: <${tag}> .${cls}`);
    console.log(`  背景色: ${bg}`);
    console.log(`  有背景: ${hasBg ? '✅' : '❌'}`);
    
    // 测试：尝试设置为红色
    if (depth <= 3) {
      const originalBg = current.style.backgroundColor;
      current.style.backgroundColor = 'red';
      console.log(`  🔴 已临时设为红色（请观察是否变红）`);
      
      // 2秒后恢复
      setTimeout(() => {
        current.style.backgroundColor = originalBg;
      }, 2000);
    }
    
    console.log('');
    
    current = current.parentElement;
    depth++;
  }
  
  console.log('💡 提示：观察哪个层级变红了，那就是真正的背景容器');
})();
