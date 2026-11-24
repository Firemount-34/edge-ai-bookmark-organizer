// 点击插件图标时，打开完整的工作台标签页（方便大屏对比与拖拽预览）
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html")
  });
});
