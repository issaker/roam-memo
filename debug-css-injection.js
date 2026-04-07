// 检查我们的 CSS 是否注入成功
(function() {
  console.log('========== 检查 CSS 注入 ==========\n');
  
  // 查找所有 style 标签
  const styles = document.querySelectorAll('style');
  let found = false;
  
  styles.forEach((style, idx) => {
    const content = style.textContent || '';
    if (content.includes('.bp3-portal') && content.includes('!important')) {
      console.log(`✅ 找到注入的 style 标签 #${idx}:`);
      console.log(content.trim());
      console.log('');
      found = true;
    }
  });
  
  if (!found) {
    console.log('❌ 没有找到包含 .bp3-portal 和 !important 的 style 标签');
  }
  
  // 检查 .bp3-portal 的实际样式
  const portal = document.querySelector('.bp3-portal');
  if (portal) {
    console.log('📍 .bp3-portal 元素:');
    console.log('  Inline style:', portal.style.backgroundColor || '(无)');
    console.log('  计算后样式:', getComputedStyle(portal).backgroundColor);
    
    // 检查是否有 !important 规则
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules || sheets[i].rules;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule.selectorText === '.bp3-portal' && rule.style.backgroundColor) {
            const priority = rule.style.getPropertyPriority('background-color');
            console.log(`\n✅ CSS 规则: ${rule.selectorText}`);
            console.log(`   背景色: ${rule.style.backgroundColor}`);
            console.log(`   优先级: ${priority || 'normal'}`);
            console.log(`   来源: ${sheets[i].href || 'inline'}`);
          }
        }
      } catch (e) {}
    }
  } else {
    console.log('\n❌ 未找到 .bp3-portal，请先打开复习窗口');
  }
})();
