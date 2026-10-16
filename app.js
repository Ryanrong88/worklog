// ====== 这里换成你自己的 Supabase 信息 ======
var SUPABASE_URL = '你的URL';
var SUPABASE_KEY = '你的KEY';
// ===========================================

var db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var currentUser = null;
var isAdmin = false;
var currentTab = 'mine';

// ====== 初始化 ======
function init() {
  document.getElementById('date').value = new Date().toISOString().slice(0, 10);

  db.auth.getSession().then(function(res) {
    var session = res.data.session;
    if (session) {
      currentUser = session.user;
      checkAdmin().then(function() {
        showMain();
        loadLogs();
      });
    }
  });

  db.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      showLogin();
    }
  });
}

// ====== 登录 ======
function doLogin() {
  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  if (!email || !password) return showMsg('loginMsg', '请填写邮箱和密码', 'error');

  var btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = '登录中...';

  db.auth.signInWithPassword({ email: email, password: password }).then(function(res) {
    btn.disabled = false; btn.textContent = '登录';

    if (res.error) return showMsg('loginMsg', '登录失败：' + res.error.message, 'error');

    currentUser = res.data.user;
    return checkAdmin().then(function() {
      showMain();
      loadLogs();
    });
  }).catch(function(e) {
    btn.disabled = false; btn.textContent = '登录';
    showMsg('loginMsg', '登录出错：' + e.message, 'error');
  });
}

// ====== 注册 ======
function doSignup() {
  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  if (!email || !password) return showMsg('loginMsg', '请填写邮箱和密码', 'error');
  if (password.length < 6) return showMsg('loginMsg', '密码至少 6 位', 'error');

  var btn = document.getElementById('signupBtn');
  btn.disabled = true; btn.textContent = '注册中...';

  db.auth.signUp({ email: email, password: password }).then(function(res) {
    btn.disabled = false; btn.textContent = '注册';

    if (res.error) return showMsg('loginMsg', '注册失败：' + res.error.message, 'error');

    showMsg('loginMsg', '注册成功！现在可以登录了。', 'success');
  }).catch(function(e) {
    btn.disabled = false; btn.textContent = '注册';
    showMsg('loginMsg', '注册出错：' + e.message, 'error');
  });
}

// ====== 退出 ======
function doLogout() {
  db.auth.signOut();
}

// ====== 检查是否管理员 ======
function checkAdmin() {
  if (!currentUser) return Promise.resolve();
  return db.from('admins').select('user_id').eq('user_id', currentUser.id).then(function(res) {
    isAdmin = res.data && res.data.length > 0;
    document.getElementById('tabAll').classList.toggle('hidden', !isAdmin);
  });
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
function saveLog() {
  var type = document.getElementById('type').value;
  var date = document.getElementById('date').value;
  var done = document.getElementById('done').value.trim();
  var problem = document.getElementById('problem').value.trim();
  var note = document.getElementById('note').value.trim();

  if (!date) return showMsg('saveMsg', '请选择日期', 'error');
  if (!done && !problem && !note) return showMsg('saveMsg', '至少填一项内容', 'error');

  var btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = '保存中...';

  db.from('logs').insert({
    user_id: currentUser.id,
    type: type, date: date, done: done, problem: problem, note: note
  }).then(function(res) {
    btn.disabled = false; btn.textContent = '保存';

    if (res.error) return showMsg('saveMsg', '保存失败：' + res.error.message, 'error');

    showMsg('saveMsg', '✅ 保存成功！', 'success');
    document.getElementById('done').value = '';
    document.getElementById('problem').value = '';
    document.getElementById('note').value = '';
    loadLogs();
  });
}

// ====== 加载记录 ======
function loadLogs() {
  var list = document.getElementById('logList');
  list.innerHTML = '<div class="empty">加载中...</div>';

  var query = db.from('logs').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });

  if (currentTab === 'mine') {
    query = query.eq('user_id', currentUser.id);
  }

  query.then(function(res) {
    if (res.error) {
      list.innerHTML = '<div class="empty">加载失败：' + res.error.message + '</div>';
      return;
    }

    var data = res.data;
    if (!data || data.length === 0) {
      list.innerHTML = '<div class="empty">还没有记录，去上面写一条吧 👆</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < data.length; i++) {
      var log = data[i];
      html += '<div class="item ' + log.type + '">';
      html += '<div class="item-head"><div>';
      html += '<span class="tag">' + (log.type === 'daily' ? '日报' : '周报') + '</span>';
      html += '<span style="margin-left:8px;">' + log.date + '</span>';
      if (currentTab === 'all') {
        html += '<span style="margin-left:8px; color:#999;">· ' + log.user_id.slice(0, 8) + '</span>';
      }
      html += '</div></div>';
      if (log.done) html += '<p><b>✅ 完成：</b>' + escapeHtml(log.done) + '</p>';
      if (log.problem) html += '<p><b>⚠️ 问题：</b>' + escapeHtml(log.problem) + '</p>';
      if (log.note) html += '<p><b>📌 其他：</b>' + escapeHtml(log.note) + '</p>';
      html += '<div class="actions"><button class="red" onclick="deleteLog(\'' + log.id + '\')">删除</button></div>';
      html += '</div>';
    }
    list.innerHTML = html;
  });
}

// ====== 删除记录 ======
function deleteLog(id) {
  if (!confirm('确定删除这条记录吗？')) return;
  db.from('logs').delete().eq('id', id).then(function(res) {
    if (res.error) return alert('删除失败：' + res.error.message);
    loadLogs();
  });
}

// ====== 小工具 ======
function showMsg(id, text, type) {
  var el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + type;
  setTimeout(function() { el.className = 'msg'; }, 5000);
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// 启动
init();
