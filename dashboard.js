/**
 * AI 书签整理助手 — 核心逻辑 (Edge / Chrome Manifest V3)
 */

// 常见大模型服务商预设
const PROVIDERS = {
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  siliconflow: {
    name: "硅基流动 (SiliconFlow)",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "Pro/deepseek-ai/DeepSeek-V3"
    ]
  },
  qwen: {
    name: "阿里云百炼 / 通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-max", "qwen-turbo", "deepseek-v3"]
  },
  volcengine: {
    name: "火山引擎 (豆包)",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-1-5-pro-32k-250115",
    models: ["doubao-1-5-pro-32k-250115", "deepseek-v3-250324"]
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"]
  },
  gemini: {
    name: "Google Gemini (OpenAI 兼容接口)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]
  },
  custom: {
    name: "自定义 OpenAI 兼容接口",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:14b",
    models: []
  }
};

// 全局状态
let rawBookmarkTree = [];
let selectedRootNode = null;
let flatBookmarks = [];      // 当前选中目录下的所有书签
let uniqueBookmarks = [];    // 去重并预清洗后的书签列表
let organizedResult = null;  // AI 返回并组装好的两级分类树 [{ category, subcategories: [{ name, items: [] }] }]

// DOM 元素引用
const elProvider = document.getElementById("provider-select");
const elBaseUrl = document.getElementById("api-base-url");
const elApiKey = document.getElementById("api-key");
const elModelName = document.getElementById("model-name");
const elModelSuggestions = document.getElementById("model-suggestions");
const elApiStatus = document.getElementById("api-status");
const elTargetFolder = document.getElementById("target-folder");
const elOptDedup = document.getElementById("opt-dedup");
const elOptCleanUrl = document.getElementById("opt-clean-url");
const elOptRename = document.getElementById("opt-rename");
const elCustomPrompt = document.getElementById("custom-prompt");
const elBatchSize = document.getElementById("batch-size");
const elProgressBox = document.getElementById("progress-box");
const elProgressText = document.getElementById("progress-text");
const elProgressPercent = document.getElementById("progress-percent");
const elProgressBarFill = document.getElementById("progress-bar-fill");
const elOrigTree = document.getElementById("orig-tree-container");
const elAiTree = document.getElementById("ai-tree-container");
const elStatOrigCount = document.getElementById("stat-orig-count");
const elStatOrigFolders = document.getElementById("stat-orig-folders");
const elStatUniqueCount = document.getElementById("stat-unique-count");
const elStatAiCats = document.getElementById("stat-ai-cats");
const elBtnRunAi = document.getElementById("btn-run-ai");
const elBtnApply = document.getElementById("btn-apply-bookmarks");
const elBtnExportOrganized = document.getElementById("btn-export-organized");
const elApiConfigCard = document.getElementById("api-config-card");
const elApiCardHeader = document.getElementById("api-card-header");
const elBtnToggleApiCard = document.getElementById("btn-toggle-api-card");
const elApiSummaryBadge = document.getElementById("api-summary-badge");
const elConfigPanel = document.querySelector(".config-panel");
const elWorkspacePanel = document.querySelector(".workspace-panel");

// 保持右侧双栏容器与左侧三个配置框总高度始终严格一致
function syncPanelHeight() {
  if (!elConfigPanel || !elWorkspacePanel) return;
  if (window.innerWidth <= 960) {
    elWorkspacePanel.style.height = "auto";
    return;
  }
  const leftHeight = Math.round(elConfigPanel.getBoundingClientRect().height);
  if (leftHeight > 0) {
    elWorkspacePanel.style.height = `${leftHeight}px`;
  }
}

// 切换 API 配置卡片折叠状态
function setApiCardCollapsed(collapsed) {
  if (!elApiConfigCard) return;
  elApiConfigCard.classList.toggle("collapsed", collapsed);
  if (elBtnToggleApiCard) {
    elBtnToggleApiCard.textContent = collapsed ? "🔽 展开" : "🔼 收起";
  }
  updateApiSummaryBadge();
  requestAnimationFrame(syncPanelHeight);
}

function updateApiSummaryBadge() {
  if (!elApiSummaryBadge) return;
  const hasKey = Boolean(elApiKey.value.trim());
  const model = elModelName.value.trim();
  if (hasKey && model) {
    elApiSummaryBadge.textContent = model;
    elApiSummaryBadge.classList.remove("hidden");
  } else {
    elApiSummaryBadge.classList.add("hidden");
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedConfig();
  await loadBrowserBookmarks();
  bindEvents();
  if (window.ResizeObserver && elConfigPanel) {
    const ro = new ResizeObserver(() => syncPanelHeight());
    ro.observe(elConfigPanel);
  }
  window.addEventListener("resize", syncPanelHeight);
  syncPanelHeight();
});

function bindEvents() {
  elProvider.addEventListener("change", () => {
    const p = PROVIDERS[elProvider.value];
    if (p) {
      elBaseUrl.value = p.baseUrl;
      elModelName.value = p.defaultModel;
      updateModelDatalist(p.models);
    }
  });

  document.getElementById("btn-toggle-key").addEventListener("click", () => {
    elApiKey.type = elApiKey.type === "password" ? "text" : "password";
  });

  document.getElementById("btn-save-config").addEventListener("click", saveConfig);
  document.getElementById("btn-test-api").addEventListener("click", testApiConnection);
  document.getElementById("btn-refresh").addEventListener("click", loadBrowserBookmarks);
  document.getElementById("btn-export-backup").addEventListener("click", exportOriginalBookmarksHtml);

  if (elApiCardHeader) {
    elApiCardHeader.addEventListener("click", () => {
      const isCollapsed = elApiConfigCard.classList.contains("collapsed");
      setApiCardCollapsed(!isCollapsed);
    });
  }

  elTargetFolder.addEventListener("change", () => {
    onTargetFolderChange(elTargetFolder.value);
  });

  elOptDedup.addEventListener("change", recomputeUniqueBookmarks);
  elOptCleanUrl.addEventListener("change", recomputeUniqueBookmarks);

  elBtnRunAi.addEventListener("click", runAiOrganization);
  elBtnApply.addEventListener("click", applyOrganizedToBrowser);
  elBtnExportOrganized.addEventListener("click", exportOrganizedHtml);

  document.getElementById("search-orig").addEventListener("input", (e) => {
    renderOriginalTree(selectedRootNode, e.target.value.trim().toLowerCase());
  });

  document.getElementById("search-ai").addEventListener("input", (e) => {
    if (organizedResult) {
      renderOrganizedTree(organizedResult, e.target.value.trim().toLowerCase());
    }
  });

  const btnToggleOrig = document.getElementById("btn-toggle-all-orig");
  if (btnToggleOrig) {
    btnToggleOrig.addEventListener("click", () => {
      toggleAllFolders(elOrigTree, btnToggleOrig);
    });
  }

  const btnToggleAi = document.getElementById("btn-toggle-all-ai");
  if (btnToggleAi) {
    btnToggleAi.addEventListener("click", () => {
      toggleAllFolders(elAiTree, btnToggleAi);
    });
  }
}

function toggleAllFolders(container, btn) {
  const folderNodes = container.querySelectorAll(".folder-node");
  if (folderNodes.length === 0) return;
  const shouldExpand = btn.dataset.expanded !== "true";
  folderNodes.forEach((node) => {
    const childrenBox = node.querySelector(":scope > .folder-children");
    if (childrenBox) {
      childrenBox.classList.toggle("hidden", !shouldExpand);
      node.classList.toggle("is-open", shouldExpand);
    }
  });
  btn.dataset.expanded = shouldExpand ? "true" : "false";
  btn.textContent = shouldExpand ? "折叠全部" : "展开全部";
}

function updateModelDatalist(models = []) {
  elModelSuggestions.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    elModelSuggestions.appendChild(opt);
  });
}

async function loadSavedConfig() {
  const defaultPrompt =
    "请采用清晰的两级目录（一级大类带合适 Emoji，如 🎓 学校与教育、🔬 科研与学术、🤖 AI 与大模型、🛠️ 数码硬件与效率工具、🌐 社区与邮箱、🎬 影音与购物；二级为具体子文件夹），并将简写或杂乱的书签标题规范化。";

  if (!chrome?.storage?.local) {
    elProvider.dispatchEvent(new Event("change"));
    elCustomPrompt.value = defaultPrompt;
    return;
  }

  const data = await chrome.storage.local.get([
    "provider",
    "baseUrl",
    "apiKey",
    "modelName",
    "customPrompt"
  ]);

  const provider = data.provider || "deepseek";
  elProvider.value = provider;
  const p = PROVIDERS[provider] || PROVIDERS.deepseek;
  updateModelDatalist(p.models);

  elBaseUrl.value = data.baseUrl || p.baseUrl;
  elApiKey.value = data.apiKey || "";
  elModelName.value = data.modelName || p.defaultModel;
  elCustomPrompt.value = data.customPrompt || defaultPrompt;

  updateApiSummaryBadge();
  // 默认保持「1. 大模型 API 配置」为展开状态（用户可随时点击右上角「🔼 收起」手动折叠）
  setApiCardCollapsed(false);
}

async function saveConfig() {
  const cfg = {
    provider: elProvider.value,
    baseUrl: elBaseUrl.value.trim(),
    apiKey: elApiKey.value.trim(),
    modelName: elModelName.value.trim(),
    customPrompt: elCustomPrompt.value.trim()
  };
  if (chrome?.storage?.local) {
    await chrome.storage.local.set(cfg);
  }
  updateApiSummaryBadge();
  showStatus("配置已保存在本地浏览器", "success");
}

function showStatus(msg, type = "info") {
  elApiStatus.textContent = msg;
  elApiStatus.className = `status-msg ${type}`;
  elApiStatus.classList.remove("hidden");
}

/**
 * 构建完整的 Chat Completions Endpoint URL
 */
function buildChatEndpoint(baseUrl) {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (!url.endsWith("/chat/completions")) {
    url += "/chat/completions";
  }
  return url;
}

/**
 * 测试大模型 API 连通性
 */
async function testApiConnection() {
  const baseUrl = elBaseUrl.value.trim();
  const apiKey = elApiKey.value.trim();
  const model = elModelName.value.trim();

  if (!baseUrl || !model) {
    showStatus("请先填写 API Base URL 和模型名称", "error");
    return;
  }

  showStatus("正在测试连接...", "info");
  try {
    const endpoint = buildChatEndpoint(baseUrl);
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "请仅回复 OK 两个字母" }],
        max_tokens: 10,
        temperature: 0
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 180)}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "成功";
    await saveConfig();
    showStatus(`✅ 连接成功！模型响应: "${reply}"`, "success");
  } catch (err) {
    showStatus(`❌ 连接失败: ${err.message}`, "error");
  }
}

/**
 * 读取 Edge / Chrome 书签树
 */
async function loadBrowserBookmarks() {
  if (!chrome?.bookmarks) {
    elOrigTree.innerHTML = `<div class="empty-state">当前不在浏览器扩展环境中，请在 Edge 扩展页面 (edge://extensions) 加载本插件。</div>`;
    return;
  }

  rawBookmarkTree = await chrome.bookmarks.getTree();
  const rootChildren = rawBookmarkTree[0]?.children || [];

  // 填充目标目录选择框（收藏夹栏、其他收藏夹、全部等）
  const prevVal = elTargetFolder.value;
  elTargetFolder.innerHTML = "";
  rootChildren.forEach((node) => {
    const opt = document.createElement("option");
    opt.value = node.id;
    opt.textContent = `${node.title || "未命名根目录"} (ID: ${node.id})`;
    elTargetFolder.appendChild(opt);
  });
  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = "🌐 全部书签目录汇总 (收藏夹栏 + 其他收藏夹)";
  elTargetFolder.appendChild(allOpt);

  if ([...elTargetFolder.options].some((o) => o.value === prevVal)) {
    elTargetFolder.value = prevVal;
  } else if (rootChildren.length > 0) {
    elTargetFolder.value = rootChildren[0].id; // 默认选中收藏夹栏 ("1")
  }

  onTargetFolderChange(elTargetFolder.value);
}

function findNodeById(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function onTargetFolderChange(folderId) {
  if (folderId === "ALL") {
    selectedRootNode = rawBookmarkTree[0];
  } else {
    selectedRootNode = findNodeById(rawBookmarkTree, folderId) || rawBookmarkTree[0];
  }

  // 统计所有书签与规划前的大类数（一级文件夹）和子类数（二级及更深子文件夹）
  flatBookmarks = [];
  let topCategoryCount = 0;
  let subCategoryCount = 0;

  function traverse(node, path = [], depth = 0) {
    if (!node) return;
    if (node.url) {
      flatBookmarks.push({
        id: node.id,
        title: node.title || node.url,
        url: node.url,
        dateAdded: node.dateAdded,
        folderPath: path.join(" / ")
      });
    } else if (node.children) {
      if (node !== selectedRootNode) {
        // 如果选中的是 ALL，depth===1 是浏览器自带的收藏夹栏/其他收藏夹，depth===2 才是一级大类
        const effectiveDepth = folderId === "ALL" ? depth - 1 : depth;
        if (effectiveDepth === 1) {
          topCategoryCount++;
        } else if (effectiveDepth > 1) {
          subCategoryCount++;
        }
      }
      const nextPath = node.title ? [...path, node.title] : path;
      node.children.forEach((child) => traverse(child, nextPath, depth + 1));
    }
  }

  traverse(selectedRootNode, [], 0);
  elStatOrigCount.textContent = flatBookmarks.length;
  elStatOrigFolders.textContent = `${topCategoryCount} 大类 / ${subCategoryCount} 子类`;

  recomputeUniqueBookmarks();
  renderOriginalTree(selectedRootNode);
}

/**
 * URL 清洗规则：剔除常见广告追踪参数 (utm_*, msclkid, refpid, _gl 等) 与过期会话 sid
 */
function cleanTrackingUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // 针对特定站点的精简规则
    if (u.hostname === "www.taobao.com" && u.pathname.includes("/wow/z/tbhome")) {
      return "https://www.taobao.com/";
    }
    if (u.hostname === "mail.163.com" && u.pathname.includes("/js6/main.jsp")) {
      return "https://mail.163.com/";
    }
    if (u.hostname === "appmail.mail.10086.cn") {
      return "https://mail.10086.cn/";
    }
    if (u.pathname.endsWith("/auth/authorize") && u.port === "8123") {
      return `${u.protocol}//${u.host}/`;
    }

    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "msclkid", "gclid", "fbclid", "_gl", "_ga", "sudaref", "retcode",
      "channel", "source", "keywordid", "Campaign", "AdGroup", "CampaignId",
      "AdGroupId", "MatchType", "AdId", "BidMatchType", "refpid", "bc_fl_src",
      "channelSrp", "clk1", "upsId", "original_referer"
    ];
    let changed = false;
    trackingParams.forEach((p) => {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p);
        changed = true;
      }
    });
    return changed ? u.toString() : rawUrl;
  } catch {
    return rawUrl;
  }
}

function recomputeUniqueBookmarks() {
  const dedup = elOptDedup.checked;
  const cleanUrl = elOptCleanUrl.checked;

  const seen = new Set();
  uniqueBookmarks = [];

  for (const bm of flatBookmarks) {
    const finalUrl = cleanUrl ? cleanTrackingUrl(bm.url) : bm.url;
    const normKey = finalUrl.replace(/\/+$/, "").toLowerCase();
    if (dedup && seen.has(normKey)) {
      continue;
    }
    seen.add(normKey);
    uniqueBookmarks.push({
      idx: uniqueBookmarks.length + 1,
      origId: bm.id,
      origTitle: bm.title,
      title: bm.title,
      origUrl: bm.url,
      url: finalUrl,
      urlCleaned: finalUrl !== bm.url,
      folderPath: bm.folderPath
    });
  }

  elStatUniqueCount.textContent = uniqueBookmarks.length;
}

/**
 * 渲染左侧当前浏览器书签树（默认全部展开；每个文件夹右侧徽章统一显示该文件夹下的递归书签总数）
 */
function renderOriginalTree(rootNode, filterKeyword = "") {
  const btnToggleOrig = document.getElementById("btn-toggle-all-orig");
  if (btnToggleOrig) {
    btnToggleOrig.dataset.expanded = "true";
    btnToggleOrig.textContent = "折叠全部";
  }

  if (!rootNode || !rootNode.children || rootNode.children.length === 0) {
    elOrigTree.innerHTML = `<div class="empty-state">该目录下暂无书签</div>`;
    return;
  }

  const expandByDefault = true;

  function buildDom(node) {
    if (node.url) {
      const match =
        !filterKeyword ||
        (node.title && node.title.toLowerCase().includes(filterKeyword)) ||
        node.url.toLowerCase().includes(filterKeyword);
      if (!match) return null;

      const item = document.createElement("div");
      item.className = "bookmark-item";
      item.innerHTML = `
        <span>🔖</span>
        <a class="bookmark-title" href="${escapeHtml(node.url)}" target="_blank" title="${escapeHtml(node.title)}">${escapeHtml(node.title || node.url)}</a>
        <span class="bookmark-url" title="${escapeHtml(node.url)}">${escapeHtml(node.url)}</span>
      `;
      return { el: item, bookmarkCount: 1 };
    }

    if (node.children) {
      const childResults = node.children.map(buildDom).filter(Boolean);
      const totalBookmarksInFolder = childResults.reduce((sum, r) => sum + r.bookmarkCount, 0);
      if (childResults.length === 0 && filterKeyword) return null;

      const wrapper = document.createElement("div");
      wrapper.className = `folder-node${expandByDefault ? " is-open" : ""}`;

      const header = document.createElement("div");
      header.className = "folder-header";
      header.innerHTML = `
        <span class="folder-caret">▶</span>
        <span class="folder-icon">📂</span>
        <span>${escapeHtml(node.title || "根目录")}</span>
        <span class="folder-count" title="该分类下共包含 ${totalBookmarksInFolder} 条书签">${totalBookmarksInFolder}</span>
      `;

      const childrenBox = document.createElement("div");
      childrenBox.className = `folder-children${expandByDefault ? "" : " hidden"}`;
      childResults.forEach((r) => childrenBox.appendChild(r.el));

      header.addEventListener("click", () => {
        const isHidden = childrenBox.classList.toggle("hidden");
        wrapper.classList.toggle("is-open", !isHidden);
      });

      wrapper.appendChild(header);
      wrapper.appendChild(childrenBox);
      return { el: wrapper, bookmarkCount: totalBookmarksInFolder };
    }
    return null;
  }

  elOrigTree.innerHTML = "";
  rootNode.children.forEach((child) => {
    const res = buildDom(child);
    if (res) elOrigTree.appendChild(res.el);
  });
}

/**
 * 调用大模型进行智能分类与重命名
 */
async function runAiOrganization() {
  const baseUrl = elBaseUrl.value.trim();
  const apiKey = elApiKey.value.trim();
  const model = elModelName.value.trim();

  if (!baseUrl || !model) {
    showStatus("请先配置大模型 API Base URL 与模型名称", "error");
    return;
  }

  recomputeUniqueBookmarks();
  if (uniqueBookmarks.length === 0) {
    showStatus("当前选中的目录下没有可整理的书签", "error");
    return;
  }

  await saveConfig();
  elBtnRunAi.disabled = true;
  elProgressBox.classList.remove("hidden");
  updateProgress("正在准备书签数据并构建 Prompt...", 5);

  const batchSize = parseInt(elBatchSize.value, 10) || 120;
  const batches = [];
  for (let i = 0; i < uniqueBookmarks.length; i += batchSize) {
    batches.push(uniqueBookmarks.slice(i, i + batchSize));
  }

  // 建立 idx -> 书签对象映射，防止大模型漏掉或篡改 URL
  const bmByIdx = new Map();
  uniqueBookmarks.forEach((b) => bmByIdx.set(b.idx, b));

  // 分类聚合表: categoryName -> Map(subcategoryName -> Array of bookmark items)
  const categoryMap = new Map();
  const assignedIds = new Set();

  try {
    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const batch = batches[bIndex];
      const pctStart = Math.round(10 + (bIndex / batches.length) * 80);
      updateProgress(`正在请求大模型整理第 ${bIndex + 1} / ${batches.length} 批书签 (${batch.length} 条)...`, pctStart);

      const existingCatsHint =
        categoryMap.size > 0
          ? `\n已建立的一级分类有：${[...categoryMap.keys()].join("、")}，请尽量复用这些一级分类以保持整体结构统一。`
          : "";

      const payloadItems = batch.map((b) => ({
        id: b.idx,
        title: b.origTitle.slice(0, 90),
        url: b.url.slice(0, 140),
        oldFolder: b.folderPath
      }));

      const renameInstruction = elOptRename.checked
        ? "同时将过长、带有广告后缀或含义不明的简写标题（如 twc, cl, wcl, D196G 等）规范化为清晰易读的中文/英文名称。"
        : "保持原有书签标题不变。";

      const systemPrompt = `你是一个专业的浏览器书签架构师。请将用户提供的书签列表整理为清晰、合理、高可读性的【两级目录结构】（一级大类 Category + 二级子分类 Subcategory）。
要求：
1. 每个书签都必须通过其唯一的数字 "id" 归入某个二级子分类中，绝不能遗漏任何一条书签。
2. ${renameInstruction}
3. 用户额外偏好：${elCustomPrompt.value.trim() || "无"}${existingCatsHint}
4. 请严格只输出合法的 JSON 对象（不要包含 Markdown 代码块之外的多余解释），格式如下：
{
  "categories": [
    {
      "name": "🎓 一级分类名称",
      "subcategories": [
        {
          "name": "二级子分类名称",
          "items": [
            { "id": 1, "title": "规范化后的书签名称" }
          ]
        }
      ]
    }
  ]
}`;

      const endpoint = buildChatEndpoint(baseUrl);
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(payloadItems) }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API 请求失败 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      const parsed = extractJsonFromLlm(rawContent);

      if (!parsed || !Array.isArray(parsed.categories)) {
        throw new Error("大模型返回的数据格式不是预期的 JSON 结构，请重试或更换模型");
      }

      // 合并本批次分类结果
      for (const cat of parsed.categories) {
        const catName = (cat.name || "📌 其他分类").trim();
        if (!categoryMap.has(catName)) {
          categoryMap.set(catName, new Map());
        }
        const subMap = categoryMap.get(catName);

        const subcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];
        for (const sub of subcats) {
          const subName = (sub.name || "常用书签").trim();
          if (!subMap.has(subName)) {
            subMap.set(subName, []);
          }
          const list = subMap.get(subName);

          for (const item of sub.items || []) {
            const numId = Number(item.id);
            if (bmByIdx.has(numId) && !assignedIds.has(numId)) {
              assignedIds.add(numId);
              const origBm = bmByIdx.get(numId);
              list.push({
                ...origBm,
                title: elOptRename.checked && item.title ? item.title.trim() : origBm.origTitle
              });
            }
          }
        }
      }
    }

    // 兜底检查：如果有任何被大模型遗漏的书签，自动放入【📌 未归类书签】以确保 100% 零丢失
    const missed = uniqueBookmarks.filter((b) => !assignedIds.has(b.idx));
    if (missed.length > 0) {
      const fallbackCat = "📌 其他与未归类";
      if (!categoryMap.has(fallbackCat)) categoryMap.set(fallbackCat, new Map());
      categoryMap.get(fallbackCat).set("待确认书签", missed);
    }

    // 组装最终结构
    organizedResult = [];
    let totalSubcats = 0;
    for (const [catName, subMap] of categoryMap.entries()) {
      const subcategories = [];
      for (const [subName, items] of subMap.entries()) {
        if (items.length > 0) {
          subcategories.push({ name: subName, items });
          totalSubcats++;
        }
      }
      if (subcategories.length > 0) {
        organizedResult.push({ name: catName, subcategories });
      }
    }

    elStatAiCats.textContent = `${organizedResult.length} 大类 / ${totalSubcats} 子类`;
    updateProgress("✅ AI 整理完成！请在右侧预览并微调。", 100);
    renderOrganizedTree(organizedResult);
    elBtnApply.disabled = false;
    elBtnExportOrganized.disabled = false;
  } catch (err) {
    updateProgress(`❌ 出错: ${err.message}`, 0);
    showStatus(err.message, "error");
  } finally {
    elBtnRunAi.disabled = false;
  }
}

function updateProgress(text, percent) {
  elProgressText.textContent = text;
  elProgressPercent.textContent = `${percent}%`;
  elProgressBarFill.style.width = `${percent}%`;
}

/**
 * 从大模型输出文本中稳健提取 JSON
 */
function extractJsonFromLlm(text) {
  let cleaned = text.trim();
  // 去除 <think>...</think> 推理块（兼容 DeepSeek-R1 等推理模型）
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * 渲染右侧 AI 整理后的预览树（默认全部展开；支持点击修改书签名称或分类名称）
 */
function renderOrganizedTree(categories, filterKeyword = "") {
  const btnToggleAi = document.getElementById("btn-toggle-all-ai");
  if (btnToggleAi) {
    btnToggleAi.dataset.expanded = "true";
    btnToggleAi.textContent = "折叠全部";
  }

  elAiTree.innerHTML = "";
  if (!categories || categories.length === 0) {
    elAiTree.innerHTML = `<div class="empty-state">暂无整理结果</div>`;
    return;
  }

  const expandByDefault = true;

  categories.forEach((cat) => {
    const catWrapper = document.createElement("div");
    catWrapper.className = `folder-node${expandByDefault ? " is-open" : ""}`;

    let catItemCount = 0;
    const subNodes = [];

    cat.subcategories.forEach((sub) => {
      const filteredItems = sub.items.filter((item) => {
        if (!filterKeyword) return true;
        return (
          item.title.toLowerCase().includes(filterKeyword) ||
          item.url.toLowerCase().includes(filterKeyword) ||
          sub.name.toLowerCase().includes(filterKeyword)
        );
      });

      if (filteredItems.length === 0 && filterKeyword) return;
      catItemCount += filteredItems.length;

      const subWrapper = document.createElement("div");
      subWrapper.className = `folder-node${expandByDefault ? " is-open" : ""}`;

      const subHeader = document.createElement("div");
      subHeader.className = "folder-header";
      subHeader.innerHTML = `
        <span class="folder-caret">▶</span>
        <span>📁</span>
        <span class="sub-title-text">${escapeHtml(sub.name)}</span>
        <button class="btn-edit-item" title="重命名此子文件夹">✏️</button>
        <span class="folder-count">${filteredItems.length}</span>
      `;

      const editSubBtn = subHeader.querySelector(".btn-edit-item");
      editSubBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextName = prompt("修改子分类名称：", sub.name);
        if (nextName && nextName.trim()) {
          sub.name = nextName.trim();
          renderOrganizedTree(organizedResult, filterKeyword);
        }
      });

      const subChildren = document.createElement("div");
      subChildren.className = `folder-children${expandByDefault ? "" : " hidden"}`;

      filteredItems.forEach((bm) => {
        const row = document.createElement("div");
        row.className = "bookmark-item";
        row.innerHTML = `
          <span>🔖</span>
          <a class="bookmark-title" href="${escapeHtml(bm.url)}" target="_blank" title="原标题: ${escapeHtml(bm.origTitle)}">${escapeHtml(bm.title)}</a>
          ${bm.urlCleaned ? '<span class="tag-cleaned" title="已清理广告追踪或冗余参数">已净化URL</span>' : ""}
          <span class="bookmark-url" title="${escapeHtml(bm.url)}">${escapeHtml(bm.url)}</span>
          <button class="btn-edit-item" title="修改书签标题">✏️</button>
        `;
        row.querySelector(".btn-edit-item").addEventListener("click", () => {
          const nextTitle = prompt("修改书签标题：", bm.title);
          if (nextTitle && nextTitle.trim()) {
            bm.title = nextTitle.trim();
            renderOrganizedTree(organizedResult, filterKeyword);
          }
        });
        subChildren.appendChild(row);
      });

      subHeader.addEventListener("click", () => {
        const isHidden = subChildren.classList.toggle("hidden");
        subWrapper.classList.toggle("is-open", !isHidden);
      });

      subWrapper.appendChild(subHeader);
      subWrapper.appendChild(subChildren);
      subNodes.push(subWrapper);
    });

    if (subNodes.length === 0 && filterKeyword) return;

    const catHeader = document.createElement("div");
    catHeader.className = "folder-header";
    catHeader.innerHTML = `
      <span class="folder-caret">▶</span>
      <span>📂</span>
      <span>${escapeHtml(cat.name)}</span>
      <button class="btn-edit-item" title="重命名一级分类">✏️</button>
      <span class="folder-count">${catItemCount}</span>
    `;
    catHeader.querySelector(".btn-edit-item").addEventListener("click", (e) => {
      e.stopPropagation();
      const nextName = prompt("修改一级分类名称：", cat.name);
      if (nextName && nextName.trim()) {
        cat.name = nextName.trim();
        renderOrganizedTree(organizedResult, filterKeyword);
      }
    });

    const catChildren = document.createElement("div");
    catChildren.className = `folder-children${expandByDefault ? "" : " hidden"}`;
    subNodes.forEach((n) => catChildren.appendChild(n));

    catHeader.addEventListener("click", () => {
      const isHidden = catChildren.classList.toggle("hidden");
      catWrapper.classList.toggle("is-open", !isHidden);
    });

    catWrapper.appendChild(catHeader);
    catWrapper.appendChild(catChildren);
    elAiTree.appendChild(catWrapper);
  });
}

/**
 * 将 AI 整理结果写入 Edge 收藏夹
 */
async function applyOrganizedToBrowser() {
  if (!organizedResult || organizedResult.length === 0) return;

  const mode = document.getElementById("apply-mode").value;
  const targetId = elTargetFolder.value === "ALL" ? "1" : elTargetFolder.value;
  const timeStr = new Date().toLocaleString("zh-CN", { hour12: false });

  if (mode === "backup_and_replace") {
    const ok = confirm(
      "【替换模式确认】\n系统将先在「其他收藏夹」中完整备份您当前的收藏夹栏，然后用 AI 整理后的分类目录替换当前收藏夹栏。是否继续？"
    );
    if (!ok) return;
  }

  elBtnApply.disabled = true;
  try {
    if (mode === "safe_folder") {
      // 在收藏夹栏下新建一个【✨ AI 整理书签】文件夹
      const containerFolder = await chrome.bookmarks.create({
        parentId: targetId,
        title: `✨ AI 整理书签 (${timeStr})`
      });
      await createOrganizedTreeInParent(containerFolder.id, organizedResult);
      alert(`✅ 已在收藏夹栏创建「${containerFolder.title}」并写入全部整理后的书签！`);
    } else {
      // 1. 先备份原目录到「其他收藏夹」(id="2")
      const otherRootId = rawBookmarkTree[0]?.children?.[1]?.id || "2";
      const backupFolder = await chrome.bookmarks.create({
        parentId: otherRootId,
        title: `📦 收藏夹自动备份 (${timeStr})`
      });
      const currentTargetNode = findNodeById(rawBookmarkTree, targetId);
      if (currentTargetNode?.children) {
        await cloneBookmarkSubtree(currentTargetNode.children, backupFolder.id);
        // 2. 清空原目录下的旧项
        for (const child of currentTargetNode.children) {
          await chrome.bookmarks.removeTree(child.id);
        }
      }
      // 3. 将整理后的分类直接写入收藏夹栏
      await createOrganizedTreeInParent(targetId, organizedResult);
      alert(`✅ 已将原书签备份至「其他收藏夹 -> ${backupFolder.title}」，并完成收藏夹栏替换！`);
    }

    await loadBrowserBookmarks();
  } catch (err) {
    alert(`写入书签时发生错误: ${err.message}`);
  } finally {
    elBtnApply.disabled = false;
  }
}

async function createOrganizedTreeInParent(parentId, categories) {
  for (const cat of categories) {
    const catFolder = await chrome.bookmarks.create({
      parentId,
      title: cat.name
    });
    for (const sub of cat.subcategories) {
      const subFolder = await chrome.bookmarks.create({
        parentId: catFolder.id,
        title: sub.name
      });
      for (const item of sub.items) {
        await chrome.bookmarks.create({
          parentId: subFolder.id,
          title: item.title,
          url: item.url
        });
      }
    }
  }
}

async function cloneBookmarkSubtree(nodes, targetParentId) {
  for (const n of nodes) {
    if (n.url) {
      await chrome.bookmarks.create({
        parentId: targetParentId,
        title: n.title,
        url: n.url
      });
    } else if (n.children) {
      const sub = await chrome.bookmarks.create({
        parentId: targetParentId,
        title: n.title
      });
      await cloneBookmarkSubtree(n.children, sub.id);
    }
  }
}

/**
 * 导出标准 Netscape Bookmark HTML 文件
 */
function exportOriginalBookmarksHtml() {
  if (!selectedRootNode) return;
  const nowTs = Math.floor(Date.now() / 1000);

  function nodesToHtml(nodes, indent = "        ") {
    let out = "";
    for (const n of nodes) {
      if (n.url) {
        out += `${indent}<DT><A HREF="${escapeHtml(n.url)}" ADD_DATE="${nowTs}">${escapeHtml(n.title)}</A>\n`;
      } else if (n.children) {
        out += `${indent}<DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}">${escapeHtml(n.title)}</H3>\n`;
        out += `${indent}<DL><p>\n`;
        out += nodesToHtml(n.children, indent + "    ");
        out += `${indent}</DL><p>\n`;
      }
    }
    return out;
  }

  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}" PERSONAL_TOOLBAR_FOLDER="true">收藏夹栏</H3>
    <DL><p>
${nodesToHtml(selectedRootNode.children || [])}    </DL><p>
</DL><p>
`;
  downloadFile(html, `edge_bookmarks_backup_${new Date().toISOString().slice(0, 10)}.html`);
}

function exportOrganizedHtml() {
  if (!organizedResult) return;
  const nowTs = Math.floor(Date.now() / 1000);
  let body = "";

  for (const cat of organizedResult) {
    body += `        <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}">${escapeHtml(cat.name)}</H3>\n`;
    body += `        <DL><p>\n`;
    for (const sub of cat.subcategories) {
      body += `            <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}">${escapeHtml(sub.name)}</H3>\n`;
      body += `            <DL><p>\n`;
      for (const item of sub.items) {
        body += `                <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${nowTs}">${escapeHtml(item.title)}</A>\n`;
      }
      body += `            </DL><p>\n`;
    }
    body += `        </DL><p>\n`;
  }

  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${nowTs}" LAST_MODIFIED="${nowTs}" PERSONAL_TOOLBAR_FOLDER="true">收藏夹栏</H3>
    <DL><p>
${body}    </DL><p>
</DL><p>
`;
  downloadFile(html, `edge_bookmarks_ai_organized_${new Date().toISOString().slice(0, 10)}.html`);
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
