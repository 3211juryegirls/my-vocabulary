
/* My Vocabulary - Authentication & Cloud Sync */
(() => {
  'use strict';

  const SUPABASE_URL =
    'https://gfbhtebfmbcfkbnslbvh.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_UQWgsms48II6L_JDLFwkOQ_t2oI1-Ws';

  const STORAGE_KEY = 'myVocabularyData_v1';

  if (!window.supabase?.createClient) {
    alert('Supabase 라이브러리를 불러오지 못했습니다.');
    return;
  }

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  let currentUser = null;
  let saveTimer = null;
  let originalSetItem = null;

  // 인증 화면 디자인
  const style = document.createElement('style');

  style.textContent = `
    .mv-auth-screen {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #f5f1e8;
      display: grid;
      place-items: center;
      padding: 20px;
      font-family: Arial, sans-serif;
      color: #354238;
    }

    .mv-auth-card {
      width: min(420px, 100%);
      box-sizing: border-box;
      background: #fffdf8;
      border: 1px solid #e7e1d5;
      border-radius: 22px;
      padding: 30px;
      box-shadow: 0 18px 55px #394b3818;
    }

    .mv-auth-card h1 {
      font-size: 25px;
      margin: 0 0 8px;
    }

    .mv-auth-card p {
      color: #758174;
      font-size: 14px;
      line-height: 1.6;
    }

    .mv-auth-card label {
      display: block;
      font-size: 13px;
      margin: 16px 0 7px;
    }

    .mv-auth-card input {
      box-sizing: border-box;
      width: 100%;
      padding: 13px;
      border: 1px solid #dedfd5;
      border-radius: 10px;
      font-size: 15px;
    }

    .mv-auth-card button {
      border: 0;
      border-radius: 10px;
      padding: 13px;
      cursor: pointer;
    }

    .mv-auth-primary {
      width: 100%;
      margin-top: 20px;
      background: #829783;
      color: white;
      font-weight: bold;
    }

    .mv-auth-switch {
      background: transparent;
      color: #657d68;
      margin-top: 12px;
    }

    .mv-auth-message {
      min-height: 22px;
      font-size: 13px;
      color: #687b69;
      margin-top: 12px;
    }

    .mv-account-bar {
      position: fixed;
      right: 18px;
      bottom: 16px;
      z-index: 9998;
      display: flex;
      gap: 10px;
      align-items: center;
      background: #fffdf8;
      border: 1px solid #e7e1d5;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      color: #526451;
    }

    .mv-account-bar button {
      border: 0;
      border-radius: 999px;
      padding: 7px 10px;
      cursor: pointer;
    }
  `;

  document.head.appendChild(style);

  // 로그인 / 회원가입 화면
  function showAuth() {
    return new Promise(resolve => {
      let mode = 'login';

      const overlay = document.createElement('div');
      overlay.className = 'mv-auth-screen';

      overlay.innerHTML = `
        <section class="mv-auth-card">
          <h1>My Vocabulary</h1>

          <p id="mv-description">
            로그인하면 학습 데이터를 계정에 저장할 수 있습니다.
          </p>

          <form id="mv-form">
            <label>이메일</label>
            <input
              id="mv-email"
              type="email"
              required
              autocomplete="email"
              placeholder="이메일 주소"
            >

            <label>비밀번호</label>
            <input
              id="mv-password"
              type="password"
              required
              minlength="6"
              placeholder="6자 이상"
            >

            <button
              class="mv-auth-primary"
              id="mv-submit"
              type="submit"
            >
              로그인
            </button>
          </form>

          <button
            class="mv-auth-switch"
            id="mv-switch"
            type="button"
          >
            처음 사용하시나요? 회원가입
          </button>

          <div
            class="mv-auth-message"
            id="mv-message"
          ></div>
        </section>
      `;

      document.body.appendChild(overlay);

      const form = overlay.querySelector('#mv-form');
      const submit = overlay.querySelector('#mv-submit');
      const switchBtn = overlay.querySelector('#mv-switch');
      const message = overlay.querySelector('#mv-message');
      const password = overlay.querySelector('#mv-password');

      function renderMode() {
        submit.textContent =
          mode === 'login' ? '로그인' : '회원가입';

        switchBtn.textContent =
          mode === 'login'
            ? '처음 사용하시나요? 회원가입'
            : '이미 계정이 있나요? 로그인';

        overlay.querySelector('#mv-description').textContent =
          mode === 'login'
            ? '로그인하면 학습 데이터를 계정에 저장할 수 있습니다.'
            : '가입 후 이메일 인증을 완료해 주세요.';

        password.autocomplete =
          mode === 'login' ? 'current-password' : 'new-password';

        message.textContent = '';
      }

      switchBtn.addEventListener('click', () => {
        mode = mode === 'login' ? 'signup' : 'login';
        renderMode();
      });

      form.addEventListener('submit', async event => {
        event.preventDefault();

        submit.disabled = true;
        message.textContent = '처리 중입니다...';

        const email =
          overlay.querySelector('#mv-email').value.trim();

        const pass = password.value;

        try {
          if (mode === 'login') {
            const { error } =
              await supabase.auth.signInWithPassword({
                email,
                password: pass
              });

            if (error) throw error;

            overlay.remove();
            resolve();

          } else {
            const { data, error } =
              await supabase.auth.signUp({
                email,
                password: pass,
                options: {
                  emailRedirectTo: window.location.origin
                }
              });

            if (error) throw error;

            if (data.session) {
              overlay.remove();
              resolve();
            } else {
              mode = 'login';
              renderMode();
              message.textContent =
                '인증 메일을 확인한 뒤 로그인해 주세요.';
            }
          }

        } catch (error) {
          message.textContent =
            error.message || '요청에 실패했습니다.';

        } finally {
          submit.disabled = false;
        }
      });
    });
  }

  // 동기화 상태 표시
  function setStatus(status) {
    const element =
      document.querySelector('#mv-sync-status');

    if (element) element.textContent = status;
  }

  // 클라우드 데이터 불러오기
  async function loadCloudState() {
    const { data, error } = await supabase
      .from('user_app_state')
      .select('state')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    const localState =
      localStorage.getItem(STORAGE_KEY);

    if (data?.state) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data.state)
      );

    } else if (localState) {
      const { error: uploadError } =
        await supabase
          .from('user_app_state')
          .upsert({
            user_id: currentUser.id,
            state: JSON.parse(localState),
            updated_at: new Date().toISOString()
          });

      if (uploadError) throw uploadError;
    }
  }

  // 클라우드에 데이터 저장
  async function syncNow() {
    if (!currentUser) return;

    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    setStatus('동기화 중');

    try {
      const { error } = await supabase
        .from('user_app_state')
        .upsert({
          user_id: currentUser.id,
          state: JSON.parse(raw),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setStatus('동기화 완료');

    } catch (error) {
      console.error('Cloud sync error:', error);
      setStatus('동기화 실패');
    }
  }

  // 자동 저장 예약
  function scheduleSync() {
    setStatus('저장 대기');

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
      syncNow();
    }, 800);
  }

  // 로그아웃
  function showAccountBar() {
    const bar = document.createElement('div');

    bar.className = 'mv-account-bar';

    bar.innerHTML = `
      <span>
        로그인됨 ·
        <span id="mv-sync-status">동기화 준비</span>
      </span>

      <button id="mv-logout">
        로그아웃
      </button>
    `;

    document.body.appendChild(bar);

    bar.querySelector('#mv-logout')
      .addEventListener('click', async () => {

        if (!confirm('로그아웃할까요?')) return;

        clearTimeout(saveTimer);
        await syncNow();

        await supabase.auth.signOut();

        if (originalSetItem) {
          localStorage.setItem = originalSetItem;
        }

        localStorage.removeItem(STORAGE_KEY);

        location.reload();
      });
  }

  // 앱 실행
  async function start() {
    const { data: { session } } =
      await supabase.auth.getSession();

    if (!session) {
      await showAuth();
    }

    const { data: { session: activeSession } } =
      await supabase.auth.getSession();

    if (!activeSession) return;

    currentUser = activeSession.user;

    await loadCloudState();

    // 기존 앱의 저장 기능과 클라우드 동기화 연결
    originalSetItem = localStorage.setItem.bind(localStorage);

    localStorage.setItem = function(key, value) {
      originalSetItem(key, value);

      if (key === STORAGE_KEY) {
        scheduleSync();
      }
    };

    showAccountBar();

    // 기존 학습 프로그램 실행
    const appScript = document.createElement('script');

    appScript.src = 'script.js';

    appScript.onerror = () => {
      alert(
        'script.js를 불러오지 못했습니다. 파일 위치를 확인해 주세요.'
      );
    };

    document.body.appendChild(appScript);
  }

  start().catch(error => {
    console.error(error);

    document.body.innerHTML = `
      <div style="padding:24px;font-family:sans-serif">
        <h2>인증 초기화 오류</h2>
        <p>${String(error.message || error)}</p>
      </div>
    `;
  });

})();
