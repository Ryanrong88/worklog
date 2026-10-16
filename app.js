// ====== 换成你自己的 Supabase 信息 ======
var SUPABASE_URL = 'https://cjbpagijzmkraukaujhz.supabase.co';
var SUPABASE_KEY = '你的KEY换成这串';
// ======================================

var db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var currentUser = null;
var isAdmin = false;
var currentTab = 'mine';
var myProjects = [];
var allUsers = [];      // 管理员用
var allProjects = [];   // 汇总用
var summaryData = [];

// ====== 初始化 ======
function init() {
  document.getElementById('date').value = new Date().toISOString().slice(0, 10);
  var today = new Date().toISOString().slice(0, 10);
  var monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 10);
  document.getElementById('sumStart').value = monthAgo;
  document.getElementById('sumEnd').value = today;

  db.auth.getSession().then(function(res) {
    var session = res.data.session;
    if (session) {
      currentUser = session.user;
      checkAdmin().then(function() {
        showMain();
        loadProjects().then(function() {
          loadLogs();
        });
      });
    }
  });

  db.auth.onAuthStateChange(function(event) {
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
      return loadProjects();
    }).then(function() {
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
  });
}

function doLogout() { db.auth.signOut(); }

// ====== 检查管理员 ======
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

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabMine').classList.toggle('active', tab === 'mine');
  document.getElementById('tabAll').classList.toggle('active', tab === 'all');
  document.getElementById('tabProjects').classList.toggle('active', tab === 'projects');
  document.getElementById('tabSummary').classList.toggle('active', tab === 'summary');

  document.getElementById('writeCard').classList.toggle('hidden', tab === 'projects' || tab === 'summary');
  document.getElementById('projectCard').classList.toggle('hidden', tab !== 'projects');
  document.getElementById('summaryCard').classList.toggle('hidden', tab !== 'summary');

  var listCard = document.getElementById('logList').parentElement;
  listCard.classList.toggle('hidden', tab === 'projects' || tab === 'summary');

  if (tab === 'mine' || tab === 'all') {
    document.getElementById('listTitle').textContent = tab === 'mine' ? '📋 我的记录' : '📋 所有人的记录';
    loadLogs();
  } else if (tab === 'projects') {
    renderProjectList();
  } else if (tab === 'summary') {
    initSummaryPage();
  }
}

// ====== 加载项目 ======
function loadProjects() {
  if (!currentUser) return Promise.resolve();
  return db.from('projects').select('*').eq('user_id', currentUser.id).order('created_at').then(function(res) {
    myProjects = res.data || [];
    var sel = document.getElementById('project');
    sel.innerHTML = '<option value="">（未分类）</option>';
    myProjects.forEach(function(p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    });
  });
}

// ====== 项目管理 ======
function renderProjectList() {
  var list = document.getElementById('projectList');
  if (myProjects.length === 0) {
    list.innerHTML = '<div class="empty">还没有项目，去上面添加一个吧 👆</div>';
    return;
  }
  var html = '';
  myProjects.forEach(function(p) {
    html += '<div class="proj-item">';
    html += '<span>📁 ' + escapeHtml(p.name) + '</span>';
    html += '<button class="red small" onclick="deleteProject(\'' + p.id + '\', \'' + escapeHtml(p.name).replace(/'/g, "\\'") + '\')">删除</button>';
    html += '</div>';
  });
  list.innerHTML = html;
}

function addProject() {
  var name = document.getElementById('newProjectName').value.trim();
  if (!name) return alert('请输入项目名称');
  db.from('projects').insert({ user_id: currentUser.id, name: name }).then(function(res) {
    if (res.error) return alert('添加失败：' + res.error.message);
    document.getElementById('newProjectName').value = '';
    loadProjects().then(function() {
      renderProjectList();
    });
  });
}

function deleteProject(id, name) {
  if (!confirm('确定删除项目「' + name + '」吗？\n（原有记录会保留，但显示为"已删除项目"）')) return;
  db.from('projects').delete().eq('id', id).then(function(res) {
    if (res.error) return alert('删除失败：' + res.error.message);
    loadProjects().then(function() {
      renderProjectList();
    });
  });
}

function showProjectModal() {
  document.getElementById('projectModal').classList.remove('hidden');
  document.getElementById('modalProjectName').value = '';
  setTimeout(function() { document.getElementById('modalProjectName').focus(); }, 100);
}
function hideProjectModal() {
  document.getElementById('projectModal').classList.add('hidden');
}
function quickAddProject() {
  var name = document.getElementById('modalProjectName').value.trim();
  if (!name) return alert('请输入项目名称');
  db.from('projects').insert({ user_id: currentUser.id, name: name }).then(function(res) {
    if (res.error) return alert('添加失败：' + res.error.message);
    hideProjectModal();
    loadProjects();
  });
}

// ====== 保存记录 ======
function saveLog() {
  var type = document.getElementById('type').value;
  var date = document.getElementById('date').value;
  var projectId = document.getElementById('project').value;
  var done = document.getElementById('done').value.trim();
  var problem = document.getElementById('problem').value.trim();
  var note = document.getElementById('note').value.trim();

  if (!date) return showMsg('saveMsg', '请选择日期', 'error');
  if (!done && !problem && !note) return showMsg('saveMsg', '至少填一项内容', 'error');

  var btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = '保存中...';

  db.from('logs').insert({
    user_id: currentUser.id,
    type: type, date: date,
    project_id: projectId || null,
    done: done, problem: problem, note: note
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

  var query = db.from('logs').select('*, projects(name)').order('date', { ascending: false }).order('created_at', { ascending: false });

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
      var projName = log.projects ? log.projects.name : '未分类';
      html += '<div class="item ' + log.type + '">';
      html += '<div class="item-head"><div>';
      html += '<span class="tag">' + (log.type === 'daily' ? '日报' : '周报') + '</span>';
      html += '<span style="margin-left:8px;">' + log.date + '</span>';
      html += '<span class="proj" style="margin-left:8px;">📁 ' + escapeHtml(projName) + '</span>';
      if (currentTab === 'all') {
        html += '<span style="margin-left:8px; color:#999; font-size:12px;">· ' + log.user_id.slice(0, 8) + '</span>';
      }
      html += '</div></div>';
      if (log.done) html += '<p><b>✅ 完成：</b>' + escapeHtml(log.done) + '</p>';
      if (log.problem) html += '<p><b>⚠️ 问题：</b>' + escapeHtml(log.problem) + '</p>';
      if (log.note) html += '<p><b>📌 其他：</b>' + escapeHtml(log.note) + '</p>';
      html += '<div class="actions"><button class="red small" onclick="deleteLog(\'' + log.id + '\')">删除</button></div>';
      html += '</div>';
    }
    list.innerHTML = html;
  });
}

function deleteLog(id) {
  if (!confirm('确定删除这条记录吗？')) return;
  db.from('logs').delete().eq('id', id).then(function(res) {
    if (res.error) return alert('删除失败：' + res.error.message);
    loadLogs();
  });
}

// ====== 汇总页面 ======
function initSummaryPage() {
  var userSel = document.getElementById('sumUser');
  userSel.innerHTML = '<option value="">所有人</option>';

  if (isAdmin) {
    db.from('logs').select('user_id').then(function(res) {
      var seen = {};
      var users = [];
      (res.data || []).forEach(function(r) {
        if (!seen[r.user_id]) {
          seen[r.user_id] = true;
          users.push(r.user_id);
        }
      });
      allUsers = users;
      users.forEach(function(uid) {
        var o = document.createElement('option');
        o.value = uid;
        o.textContent = uid.slice(0, 8) + '...';
        userSel.appendChild(o);
      });
    });
  } else {
    var o = document.createElement('option');
    o.value = currentUser.id;
    o.textContent = '我自己';
    userSel.appendChild(o);
    userSel.value = currentUser.id;
  }

  loadAllProjects();
}

function loadAllProjects() {
  var userId = document.getElementById('sumUser').value;
  var projSel = document.getElementById('sumProject');
  projSel.innerHTML = '<option value="">全部项目</option>';

  var query = db.from('projects').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }

  query.then(function(res) {
    allProjects = res.data || [];
    allProjects.forEach(function(p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name + (userId ? '' : '（' + p.user_id.slice(0, 6) + '）');
      projSel.appendChild(o);
    });
  });
}

function onSumUserChange() {
  loadAllProjects();
}

function generateSummary() {
  var userId = document.getElementById('sumUser').value;
  var projectId = document.getElementById('sumProject').value;
  var type = document.getElementById('sumType').value;
  var start = document.getElementById('sumStart').value;
  var end = document.getElementById('sumEnd').value;

  var query = db.from('logs').select('*, projects(name)').order('date', { ascending: false });

  if (!isAdmin) {
    query = query.eq('user_id', currentUser.id);
  } else if (userId) {
    query = query.eq('user_id', userId);
  }

  if (projectId) query = query.eq('project_id', projectId);
  if (type) query = query.eq('type', type);
  if (start) query = query.gte('date', start);
  if (end) query = query.lte('date', end);

  query.then(function(res) {
    if (res.error) return showMsg('sumMsg', '查询失败：' + res.error.message, 'error');

    summaryData = res.data || [];
    if (summaryData.length === 0) {
      document.getElementById('sumResult').innerHTML = '<div class="empty">没有符合条件的记录</div>';
      return;
    }

    // 补齐用户名
    var uids = {};
    summaryData.forEach(function(d) { uids[d.user_id] = true; });
    var uidList = Object.keys(uids);

    // 管理员才需要查邮箱
    if (isAdmin && uidList.length > 0) {
      // 用 admins 表或直接显示 UID 片段
      // 简化：直接用 UID 前缀
    }

    renderSummaryTable();
  });
}

function renderSummaryTable() {
  var html = '<table><thead><tr>';
  html += '<th>用户</th><th>日期</th><th>类型</th><th>项目</th><th>完成</th><th>问题</th><th>其他</th>';
  html += '</tr></thead><tbody>';

  summaryData.forEach(function(d) {
    var projName = d.projects ? d.projects.name : '未分类';
    html += '<tr>';
    html += '<td>' + d.user_id.slice(0, 8) + '</td>';
    html += '<td>' + d.date + '</td>';
    html += '<td>' + (d.type === 'daily' ? '日报' : '周报') + '</td>';
    html += '<td>' + escapeHtml(projName) + '</td>';
    html += '<td>' + escapeHtml(d.done || '') + '</td>';
    html += '<td>' + escapeHtml(d.problem || '') + '</td>';
    html += '<td>' + escapeHtml(d.note || '') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';

  document.getElementById('sumResult').innerHTML = html;
}

function exportExcel() {
  if (!summaryData || summaryData.length === 0) {
    return showMsg('sumMsg', '请先生成汇总', 'error');
  }

  var rows = summaryData.map(function(d) {
    return {
      '用户': d.user_id.slice(0, 8),
      '日期': d.date,
      '类型': d.type === 'daily' ? '日报' : '周报',
      '项目': d.projects ? d.projects.name : '未分类',
      '完成': d.done || '',
      '问题': d.problem || '',
      '其他': d.note || ''
    };
  });

  var ws = XLSX.utils.json_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '汇总');
  XLSX.writeFile(wb, '工作日志汇总_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  showMsg('sumMsg', '✅ 已导出', 'success');
}

// ====== 工具 ======
function showMsg(id, text, type) {
  var el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + type;
  setTimeout(function() { el.className = 'msg'; }, 5000);
}
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

init();
