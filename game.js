(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("gameStage");
  const overlay = document.getElementById("overlay");
  const overlayEyebrow = document.getElementById("overlayEyebrow");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startButton = document.getElementById("startButton");
  const startButtonText = document.getElementById("startButtonText");
  const pauseBadge = document.getElementById("pauseBadge");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("highScore");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const soundButton = document.getElementById("soundButton");

  const W = 960;
  const H = 600;
  const palette = ["#ff3ebf", "#ef5fff", "#9669ff", "#5f88ff", "#42d9ff", "#43f3d0"];
  const state = {
    mode: "menu",
    score: 0,
    highScore: Number(localStorage.getItem("neonBreakerHighScore")) || 0,
    lives: 3,
    level: 1,
    muted: false,
    left: false,
    right: false,
    lastTime: 0,
    shake: 0,
    particles: [],
    bricks: [],
  };

  const paddle = { x: W / 2 - 72, y: H - 48, w: 144, h: 14, speed: 630 };
  const ball = { x: W / 2, y: H - 67, r: 8, vx: 0, vy: 0, speed: 390, stuck: true };
  let audioCtx = null;

  function fitCanvas() {
    const mobile = window.innerWidth <= 460;
    canvas.width = W;
    canvas.height = mobile ? 1200 : H;
    canvas.style.height = "100%";
  }

  function worldHeight() { return canvas.height; }

  function buildLevel() {
    const cols = state.level >= 4 ? 12 : 11;
    const rows = Math.min(5 + state.level, 9);
    const side = 70;
    const gap = 9;
    const bw = (W - side * 2 - gap * (cols - 1)) / cols;
    const bh = 25;
    const top = worldHeight() <= H ? 82 : 150;
    state.bricks = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const stagger = row % 2 === 1 && state.level > 1;
        if (state.level > 2 && (row + col) % 9 === 0) continue;
        state.bricks.push({
          x: side + col * (bw + gap) + (stagger ? 4 : 0),
          y: top + row * (bh + gap),
          w: bw - (stagger ? 4 : 0),
          h: bh,
          color: palette[row % palette.length],
          alive: true,
        });
      }
    }
  }

  function resetPositions() {
    paddle.w = Math.max(92, 144 - (state.level - 1) * 7);
    paddle.x = W / 2 - paddle.w / 2;
    paddle.y = worldHeight() - 48;
    ball.x = W / 2;
    ball.y = paddle.y - ball.r - 3;
    ball.speed = Math.min(390 + (state.level - 1) * 28, 570);
    ball.vx = 0;
    ball.vy = 0;
    ball.stuck = true;
  }

  function startGame() {
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.particles = [];
    state.mode = "playing";
    buildLevel();
    resetPositions();
    hideOverlay();
    updateHud();
    beep(260, .08, "square", .045);
  }

  function launch() {
    if (!ball.stuck || state.mode !== "playing") return;
    const angle = (Math.random() * .52 - .26) - Math.PI / 2;
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.stuck = false;
    beep(520, .06, "square", .035);
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      pauseBadge.classList.add("visible");
    } else if (state.mode === "paused") {
      state.mode = "playing";
      state.lastTime = performance.now();
      pauseBadge.classList.remove("visible");
    }
  }

  function showEnd(won) {
    state.mode = won ? "won" : "gameover";
    overlayEyebrow.textContent = won ? `NIVEL ${String(state.level).padStart(2, "0")} COMPLETADO` : "FIN DE LA PARTIDA";
    overlayTitle.innerHTML = won ? "¡TODO<br><em>ROTO!</em>" : "GAME<br><em>OVER</em>";
    overlayText.textContent = won
      ? `Puntaje ${formatScore(state.score)}. La pelota irá más rápido en el próximo nivel.`
      : `Conseguiste ${formatScore(state.score)} puntos. ¿Podés superar tu récord?`;
    startButtonText.textContent = won ? "SIGUIENTE NIVEL" : "REINTENTAR";
    overlay.classList.add("visible");
  }

  function hideOverlay() { overlay.classList.remove("visible"); }

  function nextLevel() {
    state.level++;
    state.mode = "playing";
    buildLevel();
    resetPositions();
    hideOverlay();
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = formatScore(state.score);
    highScoreEl.textContent = formatScore(state.highScore);
    levelEl.textContent = String(state.level).padStart(2, "0");
    livesEl.innerHTML = Array.from({ length: state.lives }, () => '<i class="life"></i>').join("");
    livesEl.setAttribute("aria-label", `${state.lives} ${state.lives === 1 ? "vida" : "vidas"}`);
  }

  function formatScore(value) { return String(value).padStart(6, "0"); }

  function setScore(points) {
    state.score += points;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem("neonBreakerHighScore", state.highScore);
    }
    updateHud();
  }

  function update(dt) {
    if (state.mode !== "playing") return;
    if (state.left) paddle.x -= paddle.speed * dt;
    if (state.right) paddle.x += paddle.speed * dt;
    paddle.x = Math.max(14, Math.min(W - paddle.w - 14, paddle.x));

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 3;
    } else {
      moveBall(dt);
    }

    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);
    state.shake = Math.max(0, state.shake - dt * 18);
  }

  function moveBall(dt) {
    const steps = Math.max(1, Math.ceil((Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) * dt) / (ball.r * .75)));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;

      if (ball.x - ball.r < 8) { ball.x = 8 + ball.r; ball.vx = Math.abs(ball.vx); beep(150, .025, "square", .018); }
      if (ball.x + ball.r > W - 8) { ball.x = W - 8 - ball.r; ball.vx = -Math.abs(ball.vx); beep(150, .025, "square", .018); }
      if (ball.y - ball.r < 8) { ball.y = 8 + ball.r; ball.vy = Math.abs(ball.vy); beep(180, .025, "square", .018); }

      if (ball.vy > 0 && circleRect(ball, paddle)) {
        ball.y = paddle.y - ball.r;
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const angle = hit * 1.04;
        ball.vx = Math.sin(angle) * ball.speed;
        ball.vy = -Math.cos(angle) * ball.speed;
        beep(330, .045, "square", .03);
      }

      for (const brick of state.bricks) {
        if (!brick.alive || !circleRect(ball, brick)) continue;
        brick.alive = false;
        const overlapL = ball.x + ball.r - brick.x;
        const overlapR = brick.x + brick.w - (ball.x - ball.r);
        const overlapT = ball.y + ball.r - brick.y;
        const overlapB = brick.y + brick.h - (ball.y - ball.r);
        if (Math.min(overlapL, overlapR) < Math.min(overlapT, overlapB)) ball.vx *= -1;
        else ball.vy *= -1;
        burst(brick);
        state.shake = 2.5;
        setScore(100 * state.level);
        beep(460 + (state.bricks.filter(b => !b.alive).length % 8) * 45, .035, "square", .025);
        if (state.bricks.every(b => !b.alive)) {
          window.setTimeout(() => showEnd(true), 250);
        }
        break;
      }

      if (ball.y - ball.r > worldHeight()) {
        state.lives--;
        updateHud();
        beep(90, .25, "sawtooth", .05);
        if (state.lives <= 0) showEnd(false);
        else resetPositions();
        break;
      }
    }
  }

  function circleRect(c, r) {
    const x = Math.max(r.x, Math.min(c.x, r.x + r.w));
    const y = Math.max(r.y, Math.min(c.y, r.y + r.h));
    return (c.x - x) ** 2 + (c.y - y) ** 2 < c.r ** 2;
  }

  function burst(brick) {
    for (let i = 0; i < 9; i++) {
      state.particles.push({
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: (Math.random() - .5) * 210,
        vy: (Math.random() - .8) * 190,
        size: 2 + Math.random() * 4,
        color: brick.color,
        life: .35 + Math.random() * .25,
        maxLife: .6,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, worldHeight());
    const sx = state.shake ? (Math.random() - .5) * state.shake : 0;
    const sy = state.shake ? (Math.random() - .5) * state.shake : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground();
    drawBricks();
    drawParticles();
    drawPaddle();
    drawBall();
    ctx.restore();
  }

  function drawBackground() {
    const h = worldHeight();
    const gradient = ctx.createRadialGradient(W / 2, h * .55, 20, W / 2, h * .55, W * .7);
    gradient.addColorStop(0, "#111638");
    gradient.addColorStop(.6, "#090c20");
    gradient.addColorStop(1, "#050713");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, h);
    ctx.strokeStyle = "rgba(92,104,172,.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(92,104,172,.22)";
    ctx.strokeRect(7.5, 7.5, W - 15, h - 15);
  }

  function drawBricks() {
    for (const b of state.bricks) {
      if (!b.alive) continue;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      roundRect(b.x, b.y, b.w, b.h, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      const shine = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      shine.addColorStop(0, "rgba(255,255,255,.42)");
      shine.addColorStop(.35, "rgba(255,255,255,.03)");
      shine.addColorStop(1, "rgba(0,0,0,.28)");
      ctx.fillStyle = shine;
      roundRect(b.x, b.y, b.w, b.h, 3);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPaddle() {
    ctx.save();
    ctx.shadowColor = "#43f3ff";
    ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(.5, "#50efff");
    g.addColorStop(1, "#ffffff");
    ctx.fillStyle = g;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function beep(freq, duration, type, volume) {
    if (state.muted) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) { /* El juego funciona aunque el navegador bloquee audio. */ }
  }

  function setPaddleFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const x = (event.clientX - rect.left) * scaleX;
    paddle.x = Math.max(14, Math.min(W - paddle.w - 14, x - paddle.w / 2));
  }

  function activatePrimary() {
    if (state.mode === "menu" || state.mode === "gameover") startGame();
    else if (state.mode === "won") nextLevel();
  }

  document.addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.right = true;
    if (event.code === "Space") {
      if (["menu", "gameover", "won"].includes(state.mode)) activatePrimary();
      else if (ball.stuck && state.mode === "playing") launch();
      else togglePause();
    }
    if (event.code === "Escape") togglePause();
  });
  document.addEventListener("keyup", event => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") state.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") state.right = false;
  });
  stage.addEventListener("pointermove", event => {
    if (state.mode === "playing") setPaddleFromPointer(event);
  });
  stage.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    setPaddleFromPointer(event);
    if (state.mode === "playing" && ball.stuck) launch();
  });
  startButton.addEventListener("click", activatePrimary);
  soundButton.addEventListener("click", () => {
    state.muted = !state.muted;
    soundButton.classList.toggle("muted", state.muted);
    soundButton.setAttribute("aria-label", state.muted ? "Activar sonido" : "Desactivar sonido");
    soundButton.querySelector("span").textContent = state.muted ? "×" : ")))";
    if (!state.muted) beep(440, .05, "square", .03);
  });
  window.addEventListener("blur", () => {
    if (state.mode === "playing" && !ball.stuck) togglePause();
  });
  window.addEventListener("resize", () => {
    const oldHeight = canvas.height;
    fitCanvas();
    if (oldHeight !== canvas.height) { buildLevel(); resetPositions(); }
  });

  function loop(time) {
    const dt = Math.min((time - state.lastTime) / 1000 || 0, .025);
    state.lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  fitCanvas();
  buildLevel();
  resetPositions();
  updateHud();
  requestAnimationFrame(loop);
})();
