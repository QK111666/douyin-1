// ====== 登录检查 ======
if (localStorage.getItem('nb_login') !== 'true' && !window.location.pathname.includes('login.html')) {
  window.location.href = 'login.html';
}

// ====== 配置 ======
const API = 'http://localhost:3456';
const ACCOUNTS = ['zh1','zh2','zh3','zh4','zh5','zh6','zh7','zh8','zh9','zh10'];
const PROFILE_MAP = {zh1:'181a2fc64f47429d817e647569f72c2d',zh2:'1e102d85738a473186df65556b103ca2',zh3:'e2d0b41016a44d8f99f4b2ada455b703',zh4:'5bcfba45002240e0b9b0e72026e71fa2',zh5:'b5e1aa36d1b3472ba37590c53b551e10',zh6:'5da62ece312941b2870c28bb7c223366',zh7:'495196ecf5ab439993a12860c9a353d1',zh8:'85c9214c164645be9eac70bdd8686905',zh9:'76ceabe7719440228ab37e049610d292',zh10:'8e8c34beebbb40d191c750fb6b1aba93'};
const MAX_WORD_LEN = 25;
const HISTORY_KEY = 'lxbtb_live_history';
const MAX_HISTORY = 10;
const AVATAR_COLORS = [
  'linear-gradient(135deg,#fe2c55,#c22243)','linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#3b82f6,#2563eb)','linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#06b6d4,#0891b2)','linear-gradient(135deg,#f43f5e,#e11d48)',
  'linear-gradient(135deg,#8b5cf6,#6d28d9)','linear-gradient(135deg,#ec4899,#db2777)',
  'linear-gradient(135deg,#14b8a6,#0d9488)','linear-gradient(135deg,#f97316,#ea580c)'
];

// ====== 状态管理 ======
let scripts = {};
try { scripts = JSON.parse(localStorage.getItem('douyin_scripts') || '{}'); } catch (e) { console.warn('词集异常:', e.message); }
// 如果没有词集，塞几个示例
if (!Object.keys(scripts).length) {
  scripts = {
    '🔥 带货热销': ['这个多少钱','怎么下单','质量怎么样','包邮吗','有没有优惠','已下单支持主播','物流快吗几天到','尺码准吗平时穿M','颜色好看实物一样吗','性价比好高啊','回购了第三次了','送人合适吗有礼盒吗','主播讲得好详细心动','能再展示一下细节吗','限购吗还能再买吗'],
    '🎤 才艺捧场': ['太好听了再来一首','这唱功绝了','主播什么歌都会唱','听得起鸡皮疙瘩了','比原唱还好听','点歌可以吗','主播会唱周杰伦的吗','这嗓子是老天爷赏饭吃','每天都来听主播唱歌','耳朵怀孕了'],
    '💬 聊天互动': ['主播今天好漂亮啊','来了来了','666666','哈哈哈笑死我了','主播哪里人啊','吃饭了吗','今天播到几点','主播多大了','关注主播很久了','第一次来主播好温柔','弹幕走一波','点赞不迷路'],
    '🎁 新人欢迎': ['欢迎新人','来了都是朋友','关注主播不迷路','点个关注呗','欢迎XXX','来了来了','欢迎欢迎热烈欢迎','关注走一走活到九十九','新人报道多多关照','来都来了关注一下呗'],
    '📈 数据加油': ['点赞破万','冲冲冲','兄弟们把赞点起来','还差500赞','点赞过万主播跳舞','大家点点赞','赞赞赞','冲上热门','支持一下主播','大家帮忙点点赞']
  };
  saveScripts();
}
function saveScripts() { localStorage.setItem('douyin_scripts', JSON.stringify(scripts)); }

let selectedScript = {};
try { selectedScript = JSON.parse(localStorage.getItem('selected_script_map') || '{}'); } catch (e) { console.warn('选中脚本异常:', e.message); }
function saveSelectedScript() { localStorage.setItem('selected_script_map', JSON.stringify(selectedScript)); }

// 分组系统
let scriptGroups = {};
try { scriptGroups = JSON.parse(localStorage.getItem('script_groups') || '{}'); } catch (e) { console.warn('分组异常:', e.message); }
function saveGroups() { localStorage.setItem('script_groups', JSON.stringify(scriptGroups)); }
let isGroupView = false;

let selectedAccount = 'zh1';
const detailLogs = {};
let globalLogs = [];
const accountErrors = {};
const batchSelected = {};
const sendCounts = {};
const accountStatus = {};  // 新的状态管理
let accountFilter = '';
let lockedLiveId = '';
const aiGenerating = {};

ACCOUNTS.forEach(a => {
  sendCounts[a] = 0;
  detailLogs[a] = [];
  accountErrors[a] = false;
  batchSelected[a] = false;
  // 五态机替代旧的 browserStarted
  accountStatus[a] = {
    state: 'OFFLINE',      // OFFLINE | STARTING | ONLINE | SENDING | ERROR
    lastError: null,
    failCount: 0,
    errorCode: null        // 错误代码，用于精确判断
  };
});

const timers = {};
const timerStates = {};
let globalTimerId = null;
let globalTimerOn = false;
let globalPaused = false;
const loginStatuses = {};  // 每个账号的登录状态
const windowVisible = {};  // 每个账号的窗口是否可见
