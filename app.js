// ====== 这里换成你自己的 Supabase 信息 ======
const SUPABASE_URL = 'https://cjbpatgijzmkrakaujhz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NObsvMrfusGQnq8wSbX-zg_4GfJXZRH';
// ===========================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let isAdmin = false;
let currentTab = 'mine';

// ====== 初始化 ======
async function init() {
  // 设置今天的日期
  document.getElementById('date').value = new Date().toISOString().slice(0, 10);

  // 检查是否已登录
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await checkAdmin();
    showMain();
    loadLogs();
  }

  // 监听登录状态变化
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      showLogin();
    }
  });
}

// ====== 登录 ======
async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return showMsg('loginMsg', '请填写邮箱和密码', 'error');

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = '登录中...';

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  btn.disabled = false; btn.textContent = '登录';

  if (error) return showMsg('loginMsg', '登录失败：' + error.message, 'error');

  currentUser = data.user;
  await checkAdmin();
  showMain();
  loadLogs();
}

// ====== 注册 ======
async function doSignup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return showMsg('loginMsg', '请填写邮箱和密码', 'error');
  if (password.length < 6) return showMsg('loginMsg', '密码至少 6 位', 'error');

  const btn = document.getElementById('signupBtn');
  btn.disabled = true; btn.textContent = '注册中...';

  const { error } = await db.auth.signUp({ email, password });

  btn.disabled = false; btn.textContent = '注册';

  if (error) return showMsg('loginMsg', '注册失败：' + error.message, 'error');

  showMsg('loginMsg', '注册成功！现在可以登录了。如果提示验证邮箱，请去邮箱点确认链接。', 'success');
}

// ====== 退出 ======
async function doLogout() {
  await db.auth.signOut();
}

// ====== 检查是否管理员 ======
async function checkAdmin() {
  const { data } = await db.from('admins').select('user_id').eq('user_id', currentUser.id);
  isAdmin = data && data.length > 0;
  document.getElementById('tabAll').classList.toggle('hidden', !isAdmin);
}

// ====== 界面切换 ======
function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainPage').classList.add('hidden');
}
function showMain() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
  document.getElementById('userInfo').textContent = currentUser.email + (isAdmin ? '（管理员）' : '');
}

// ====== 切换标签 ======
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabMine').classList.toggle('active', tab === 'mine');
  document.getElementById('tabAll').classList.toggle('active', tab === 'all');
  document.getElementById('listTitle').textContent = tab === 'mine' ? '📋 我的记录' : '📋 所有人的记录';
  loadLogs();
}

// ====== 保存记录 ======
async function saveLog() {
  const type = document.getElementById('type').value;
  const date = document.getElementById('date').value;
  const done = document.getElementById('done').value.trim();
  const problem = document.getElementById('problem').value.trim();
  const note = document.getElementById('note').value.trim();

  if (!date) return showMsg('saveMsg', '请选择日期', 'error');
  if (!done && !problem && !note) return showMsg('saveMsg', '至少填一项内容', 'error');

  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = '保存中...';

  const { error } = await db.from('logs').insert({
    user_id: currentUser.id,
    type, date, done, problem, note
  });

  btn.disabled = false; btn.textContent = '保存';

  if (error) return showMsg('saveMsg', '保存失败：' + error.message, 'error');

  showMsg('saveMsg', '✅ 保存成功！', 'success');
  document.getElementById('done').value = '';
  document.getElementById('problem').value = '';
  document.getElementById('note').value = '';
  loadLogs();
}

// ====== 加载记录 ======
async function loadLogs() {
  const list = document.getElementById('logList');
  list.innerHTML = '<div class="empty">加载中...</div>';

  let query = db.from('logs').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });

  if (currentTab === 'mine') {
    query = query.eq('user_id', currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    list.innerHTML = '<div class="empty">加载失败：' + error.message + '</div>';
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<div class="empty">还没有记录，去上面写一条吧 👆</div>';
    return;
  }

  list.innerHTML = data.map(log => `
    <div class="item ${log.type}">
      <div class="item-head">
        <div>
          <span class="tag">${log.type === 'daily' ? '日报' : '周报'}</span>
          <span style="margin-left:8px;">${log.date}</span>
          ${currentTab === 'all' ? `<span style="margin-left:8px; color:#999;">· ${log.user_id.slice(0,8)}</span>` : ''}
        </div>
      </div>
      ${log.done ? `<p><b>✅ 完成：</b>${escapeHtml(log.done)}</p>` : ''}
      ${log.problem ? `<p><b>⚠️ 问题：</b>${escapeHtml(log.problem)}</p>` : ''}
      ${log.note ? `<p><b>📌 其他：</b>${escapeHtml(log.note)}</p>` : ''}
      <div class="actions">
        <button class="red" onclick="deleteLog('${log.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

// ====== 删除记录 ======
async function deleteLog(id) {
  if (!confirm('确定删除这条记录吗？')) return;
  const { error } = await db.from('logs').delete().eq('id', id);
  if (error) return alert('删除失败：' + error.message);
  loadLogs();
}

// ====== 小工具 ======
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + type;
  setTimeout(() => { el.className = 'msg'; }, 5000);
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// 启动
init();
