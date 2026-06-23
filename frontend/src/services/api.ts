const API_BASE = '/api';

/** 测试 API 连接 */
export async function testConnection(modelType: string, apiKey: string, baseUrl?: string) {
  const body = { model_type: modelType, api_key: apiKey, base_url: baseUrl };
  console.log('[API] 连接测试请求:', { modelType, baseUrl: baseUrl || '(default)', apiKey: apiKey.slice(0, 8) + '...' });

  const res = await fetch(`${API_BASE}/connection/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (!result.success) {
    console.error('[API] 连接测试失败:', result);
  } else {
    console.log('[API] 连接测试成功:', result);
  }
  return result;
}

/** 上传文件 */
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

/** 导出结果 */
export async function exportResult(original: string, polished: string, style: string, format: string = 'markdown') {
  const res = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original, polished, style, format }),
  });
  if (!res.ok) throw new Error('导出失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'markdown' ? `润色结果_${Date.now()}.md` : `润色结果_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 清空对话历史 */
export async function clearHistory() {
  const res = await fetch(`${API_BASE}/clear`, { method: 'POST' });
  return res.json();
}

/** 获取知识库状态 */
export async function getKbStatus() {
  const res = await fetch(`${API_BASE}/kb/status`);
  return res.json();
}

/** 获取语料库列表 */
export async function listCorpus() {
  const res = await fetch(`${API_BASE}/corpus/list`);
  return res.json();
}

/** 添加语料库 */
export async function addCorpus(title: string, content: string) {
  const res = await fetch(`${API_BASE}/corpus/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '添加失败' }));
    throw new Error(err.detail || '添加失败');
  }
  return res.json();
}

/** 删除语料库 */
export async function deleteCorpus(filename: string) {
  const res = await fetch(`${API_BASE}/corpus/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '删除失败' }));
    throw new Error(err.detail || '删除失败');
  }
  return res.json();
}

/** 重新加载知识库 */
export async function reloadCorpus() {
  const res = await fetch(`${API_BASE}/corpus/reload`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '重新加载失败' }));
    throw new Error(err.detail || '重新加载失败');
  }
  return res.json();
}

/** 获取应用配置 */
export async function getConfig() {
  const res = await fetch(`${API_BASE}/config`);
  return res.json();
}

/** 文本智能分析 */
export async function analyzeText(text: string) {
  const res = await fetch(`${API_BASE}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('分析失败');
  return res.json();
}
