// Roam Memo Theme Debug Script
// 在浏览器控制台粘贴运行，把输出发给我

(function() {
  console.log('=== Roam Memo Theme Debug ===\n');
  
  // 1. HTML class
  console.log('1. HTML class:', document.documentElement.className);
  console.log('   包含 rs-light:', document.documentElement.classList.contains('rs-light'));
  console.log('   包含 rs-dark:', document.documentElement.classList.contains('rs-dark'));
  console.log('   包含 rs-auto:', document.documentElement.classList.contains('rs-auto'));
  console.log('');
  
  // 2. Body background
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  console.log('2. Body background-color:', bodyBg);
  console.log('');
  
  // 3. System preference
  console.log('3. System preference:');
  console.log('   prefers-color-scheme: dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);
  console.log('   prefers-color-scheme: light:', window.matchMedia('(prefers-color-scheme: light)').matches);
  console.log('');
  
  // 4. Dialog background
  const dialog = document.querySelector('.bp3-dialog');
  if (dialog) {
    console.log('4. Dialog background-color:', getComputedStyle(dialog).backgroundColor);
  } else {
    console.log('4. No dialog found (open Memo first)');
  }
  console.log('');
  
  console.log('=== End ===');
})();
