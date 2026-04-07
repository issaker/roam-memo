// 找到 .bp3-portal 的具体选择器和样式来源
(function() {
  console.log('========== 查找 .bp3-portal 样式 ==========\n');
  
  const portal = document.querySelector('.bp3-portal');
  if (!portal) {
    console.log('❌ 未找到 .bp3-portal，请先打开复习窗口');
    return;
  }
  
  console.log('📍 Portal 元素:', portal);
  console.log('');
  
  // 获取所有应用到 portal 的样式规则
  const sheets = document.styleSheets;
  const matchingRules = [];
  
  for (let i = 0; i < sheets.length; i++) {
    try {
      const rules = sheets[i].cssRules || sheets[i].rules;
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        if (rule.selectorText && rule.selectorText.includes('bp3-portal')) {
          matchingRules.push({
            sheet: sheets[i].href || 'inline',
            selector: rule.selectorText,
            bgColor: rule.style.backgroundColor,
            priority: rule.style.getPropertyPriority('background-color')
          });
        }
      }
    } catch (e) {
      // 跨域样式表无法访问
    }
  }
  
  console.log('🎯 匹配到 .bp3-portal 的 CSS 规则:\n');
  if (matchingRules.length === 0) {
    console.log('⚠️  没有找到任何匹配的 CSS 规则');
  } else {
    matchingRules.forEach((rule, idx) => {
      console.log(`规则 ${idx + 1}:`);
      console.log(`  选择器: ${rule.selector}`);
      console.log(`  背景色: ${rule.bgColor || '(未设置)'}`);
      console.log(`  优先级: ${rule.priority || 'normal'}`);
      console.log(`  来源: ${rule.sheet}`);
      console.log('');
    });
  }
  
  // 检查 inline style
  console.log('🔍 Inline Style:');
  console.log(`  background-color: ${portal.style.backgroundColor || '(未设置)'}`);
  console.log('');
  
  // 计算后的样式
  const computed = getComputedStyle(portal);
  console.log('📊 计算后的样式:');
  console.log(`  background-color: ${computed.backgroundColor}`);
  console.log('');
  
  // 父元素链
  console.log('🔗 父元素链:');
  let current = portal.parentElement;
  let depth = 0;
  while (current && depth < 5) {
    const tag = current.tagName.toLowerCase();
    const cls = current.className ? '.' + current.className.split(' ').join('.') : '';
    const bg = getComputedStyle(current).backgroundColor;
    console.log(`  ${depth}. <${tag}${cls}> - ${bg}`);
    current = current.parentElement;
    depth++;
  }
  
  console.log('\n========== End ==========');
})();
