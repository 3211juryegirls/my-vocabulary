
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
  window.mvFriendsApi = {
    getMyInviteCode: () => supabase.from('friend_codes').select('invite_code').eq('id', currentUser.id).single(),
    sendFriendRequest: code => supabase.rpc('send_friend_request', { code }),
    respondToRequest: (request_id, accept_request) => supabase.rpc('respond_friend_request', { request_id, accept_request }),
    getMyFriends: () => supabase.rpc('get_my_friends'),
    getPendingRequests: () => supabase.rpc('get_pending_friend_requests')
  };
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

  style.textContent += `
    .mv-profile-btn {
      background: transparent;
      border: 0;
      color: #526451;
      cursor: pointer;
      font-size: 12px;
      padding: 7px 9px;
    }
    .mv-profile-overlay {
      position: fixed; inset: 0; z-index: 100001;
      background: #26332966; display: grid; place-items: center; padding: 18px;
      font-family: Arial, sans-serif; color: #354238;
    }
    .mv-profile-card {
      width: min(420px,100%); background: #fffdf8; border: 1px solid #e7e1d5;
      border-radius: 20px; padding: 24px; box-shadow: 0 18px 55px #394b3825;
    }
    .mv-profile-card h2 { margin: 0 0 8px; font-size: 20px; }
    .mv-profile-card p { color: #758174; font-size: 13px; line-height: 1.5; }
    .mv-profile-preview {
      width: 92px; height: 92px; border-radius: 50%; object-fit: cover;
      display: block; margin: 18px auto; background: #e8eee5; border: 1px solid #dce4d9;
    }
    .mv-profile-card label { display:block; font-size:12px; margin:14px 0 6px; }
    .mv-profile-card input[type=text] {
      box-sizing:border-box; width:100%; padding:12px; border:1px solid #dedfd5;
      border-radius:10px; font-size:14px; background:#fffefa;
    }
    .mv-profile-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
    .mv-profile-actions button {
      border:0; border-radius:9px; padding:10px 14px; cursor:pointer;
      background:#e9eee6; color:#526451;
    }
    .mv-profile-actions .primary { background:#829783; color:white; font-weight:600; }
    .mv-profile-error { min-height:18px; color:#a34f43 !important; }
    .topbar .avatar { cursor:pointer; overflow:hidden; display:grid; place-items:center; }
    .topbar .avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
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
        <span id="mv-account-name">사용자</span> ·
        <span id="mv-sync-status">동기화 준비</span>
      </span>
      <button class="mv-profile-btn" id="mv-profile-open">프로필</button>
      <button id="mv-logout">로그아웃</button>
    `;

    document.body.appendChild(bar);
    bar.querySelector('#mv-profile-open').addEventListener('click', openProfileEditor);
    refreshProfileDisplay();

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


  // 계정 프로필
  function profileName() {
    return currentUser?.user_metadata?.display_name ||
      currentUser?.email?.split('@')[0] || '사용자';
  }

  function profileAvatarUrl() {
    return currentUser?.user_metadata?.avatar_url || '';
  }

  function refreshProfileDisplay() {
    const avatar = document.querySelector('.topbar .avatar');
    if (avatar) {
      const url = profileAvatarUrl();
      avatar.innerHTML = url
        ? `<img src="${url}" alt="프로필 사진">`
        : 'MV';
      avatar.title = profileName() + ' · 프로필 수정';
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('tabindex', '0');
      avatar.onclick = openProfileEditor;
      avatar.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProfileEditor();
        }
      };
    }
    const accountName = document.querySelector('#mv-account-name');
    if (accountName) accountName.textContent = profileName();
  }

  async function openProfileEditor() {
    if (document.querySelector('.mv-profile-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'mv-profile-overlay';
    overlay.innerHTML = `
      <section class="mv-profile-card" role="dialog" aria-modal="true" aria-labelledby="mv-profile-title">
        <h2 id="mv-profile-title">내 프로필</h2>
        <p>친구들에게 표시될 닉네임과 프로필 사진을 설정할 수 있어요.</p>
        <img class="mv-profile-preview" id="mv-profile-preview" alt="프로필 미리보기">
        <label for="mv-profile-photo">프로필 사진</label>
        <input id="mv-profile-photo" type="file" accept="image/png,image/jpeg,image/webp">
        <label for="mv-profile-name">닉네임</label>
        <input id="mv-profile-name" type="text" maxlength="20" placeholder="닉네임 (최대 20자)">
        <p class="mv-profile-error" id="mv-profile-error"></p>
        <div class="mv-profile-actions">
          <button type="button" id="mv-profile-cancel">취소</button>
          <button type="button" class="primary" id="mv-profile-save">저장</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);
    const preview = overlay.querySelector('#mv-profile-preview');
    const photoInput = overlay.querySelector('#mv-profile-photo');
    const nameInput = overlay.querySelector('#mv-profile-name');
    const errorBox = overlay.querySelector('#mv-profile-error');
    const saveButton = overlay.querySelector('#mv-profile-save');
    let selectedFile = null;

    nameInput.value = currentUser.user_metadata?.display_name || '';
    preview.src = profileAvatarUrl() ||
      'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#e8eee5"/><circle cx="50" cy="38" r="18" fill="#829783"/><path d="M17 94c3-22 16-33 33-33s30 11 33 33" fill="#829783"/></svg>'
      );

    photoInput.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        errorBox.textContent = 'JPG, PNG, WEBP 형식의 사진만 사용할 수 있어요.';
        photoInput.value = '';
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        errorBox.textContent = '사진은 3MB 이하로 선택해 주세요.';
        photoInput.value = '';
        return;
      }
      selectedFile = file;
      preview.src = URL.createObjectURL(file);
      errorBox.textContent = '';
    });

    overlay.querySelector('#mv-profile-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });

    saveButton.onclick = async () => {
      const displayName = nameInput.value.trim();
      if (!displayName) {
        errorBox.textContent = '닉네임을 입력해 주세요.';
        nameInput.focus();
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = '저장 중...';
      errorBox.textContent = '';

      try {
        let avatarUrl = profileAvatarUrl();

        if (selectedFile) {
          const extension = selectedFile.type === 'image/png' ? 'png'
            : selectedFile.type === 'image/webp' ? 'webp' : 'jpg';
          const filePath = `${currentUser.id}/avatar-${Date.now()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: selectedFile.type
            });
          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicData.publicUrl;
        }

        const { data, error } = await supabase.auth.updateUser({
          data: { display_name: displayName, avatar_url: avatarUrl }
        });
        if (error) throw error;

        currentUser = data.user;
        refreshProfileDisplay();
        overlay.remove();
        alert('프로필이 저장되었습니다.');

      } catch (error) {
        console.error('Profile save error:', error);
        errorBox.textContent = error.message ||
          '저장에 실패했습니다. Storage 설정을 확인해 주세요.';
        saveButton.disabled = false;
        saveButton.textContent = '저장';
      }
    };
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

    appScript.src = 'script.js?v=20261108-2';

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
