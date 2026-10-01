const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const $ = id => document.getElementById(id);


/* =========================
   GAME SETTINGS
========================= */

const FRUITS = [
  "🍎",
  "🍊",
  "🍋",
  "🍇",
  "🍌"
  
];

const BOMB = "💣";

const GAME_TIME = 60;


/* =========================
   GAME VARIABLES
========================= */

let basket;
let items;
let particles;

let score;
let lives;

let combo;
let maxCombo;

let spawnTimer;
let speedBoost;

let running;
let last;

let timeLeft;
let elapsed;

let shake = 0;
let flash = 0;

let audioCtx = null;


/* =========================
   HIGH SCORE
========================= */

let best =
  Number(
    localStorage.getItem("orchardBest")
  ) || 0;

$("best").textContent = best;


/* =========================
   KEYBOARD
========================= */

const keys = {};

addEventListener("keydown", e => {

  keys[e.key.toLowerCase()] = true;

  if (
    [
      "arrowleft",
      "arrowright",
      " "
    ].includes(e.key.toLowerCase())
  ) {
    e.preventDefault();
  }

});

addEventListener("keyup", e => {

  keys[e.key.toLowerCase()] = false;

});


/* =========================
   SOUND SYSTEM
========================= */

function sound(
  frequency,
  duration = 0.07,
  type = "sine",
  volume = 0.035
) {

  if (!audioCtx) return;

  const osc =
    audioCtx.createOscillator();

  const gain =
    audioCtx.createGain();

  osc.type = type;

  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(
    volume,
    audioCtx.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + duration
  );

  osc.connect(gain);

  gain.connect(
    audioCtx.destination
  );

  osc.start();

  osc.stop(
    audioCtx.currentTime + duration
  );
}


/* =========================
   MOUSE / TOUCH
========================= */

function pointerMove(clientX) {

  const rect =
    canvas.getBoundingClientRect();

  basket.x =
    ((clientX - rect.left) / rect.width)
    * W
    - basket.w / 2;

  basket.x =
    Math.max(
      0,
      Math.min(
        W - basket.w,
        basket.x
      )
    );
}


canvas.addEventListener(
  "mousemove",
  e => {

    if (running) {
      pointerMove(e.clientX);
    }

  }
);


canvas.addEventListener(
  "touchmove",
  e => {

    if (running) {
      pointerMove(
        e.touches[0].clientX
      );
    }

  },
  {
    passive: true
  }
);


/* =========================
   RESET GAME
========================= */

function reset() {

  basket = {

    x: W / 2 - 45,

    y: H - 50,

    w: 90,

    h: 24,

    speed: 460

  };


  items = [];

  particles = [];


  score = 0;

  lives = 3;

  combo = 0;

  maxCombo = 0;


  spawnTimer = 0;

  speedBoost = 0;


  timeLeft = GAME_TIME;

  elapsed = 0;


  shake = 0;

  flash = 0;


  updateHud();

}


/* =========================
   HUD
========================= */

function updateHud() {

  $("score").textContent =
    score;

  $("time").textContent =
    Math.max(
      0,
      Math.ceil(timeLeft)
    );

  $("lives").textContent =
    "❤️".repeat(lives) +
    "🖤".repeat(3 - lives);


  $("combo").textContent =
    combo > 1
      ? `x${Math.min(combo, 5)}`
      : "x1";

}


/* =========================
   SPAWN OBJECT
========================= */

function spawn() {

  const bombChance =
    Math.min(
      0.36,
      0.12 + elapsed * 0.004
    );


  /*
    8% chance of golden fruit.
  */

  const golden =
    Math.random() < 0.08;


  const isBomb =
    !golden &&
    Math.random() < bombChance;


  items.push({

    x:
      25 +
      Math.random() *
      (W - 50),

    y: -30,

    size:
      golden
        ? 38
        : 34,

    emoji:
      isBomb
        ? BOMB
        : golden
          ? "🌟"
          : FRUITS[
              Math.floor(
                Math.random() *
                FRUITS.length
              )
            ],

    bomb: isBomb,

    golden: golden,

    vy:
      155 +
      Math.random() * 85 +
      speedBoost

  });

}


/* =========================
   PARTICLES
========================= */

function burst(
  x,
  y,
  text,
  good = true
) {

  for (let i = 0; i < 12; i++) {

    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      50 +
      Math.random() * 130;


    particles.push({

      x: x,

      y: y,

      vx:
        Math.cos(angle) *
        speed,

      vy:
        Math.sin(angle) *
        speed,

      life:
        0.55 +
        Math.random() *
        0.35,

      maxLife: 0.9,

      text:
        i < 3
          ? text
          : null,

      size:
        i < 3
          ? 22
          : 6,

      good:
        good

    });

  }

}


/* =========================
   UPDATE PARTICLES
========================= */

function updateParticles(dt) {

  for (const p of particles) {

    p.x +=
      p.vx * dt;

    p.y +=
      p.vy * dt;

    p.vy +=
      180 * dt;

    p.life -= dt;

  }


  particles =
    particles.filter(
      p => p.life > 0
    );

}


/* =========================
   CATCH ITEM
========================= */

function catchItem(it) {

  it.dead = true;


  /* BOMB */

  if (it.bomb) {

    lives--;

    combo = 0;

    shake = 12;

    flash = 0.18;


    burst(
      it.x,
      it.y,
      "💥",
      false
    );


    sound(
      100,
      0.16,
      "sawtooth",
      0.06
    );

  }


  /* FRUIT */

  else {

    combo++;

    maxCombo =
      Math.max(
        maxCombo,
        combo
      );


    /*
      Every 5 consecutive catches
      increases the multiplier.

      1-4 = x1
      5-9 = x2
      10-14 = x3
      etc.
    */

    const multiplier =
      Math.min(
        5,
        Math.max(
          1,
          Math.floor(combo / 5) + 1
        )
      );


    const points =
      it.golden
        ? 5
        : multiplier;


    score += points;


    burst(
      it.x,
      it.y,
      it.golden
        ? "⭐ +5"
        : `+${points}`
    );


    /* GOLDEN FRUIT */

    if (it.golden) {

      shake = 7;

      flash = 0.12;


      sound(
        880,
        0.12,
        "triangle",
        0.05
      );


      setTimeout(() => {

        sound(
          1175,
          0.12,
          "triangle",
          0.04
        );

      }, 45);

    }


    /* NORMAL FRUIT */

    else {

      sound(
        420 +
        Math.min(combo, 8) *
        35,

        0.06
      );

    }

  }


  updateHud();

}


/* =========================
   UPDATE GAME
========================= */

function update(dt) {


  /* PLAYER MOVEMENT */

  if (
    keys["arrowleft"] ||
    keys["a"]
  ) {

    basket.x -=
      basket.speed * dt;

  }


  if (
    keys["arrowright"] ||
    keys["d"]
  ) {

    basket.x +=
      basket.speed * dt;

  }


  basket.x =
    Math.max(
      0,
      Math.min(
        W - basket.w,
        basket.x
      )
    );


  /* TIMER */

  timeLeft -= dt;

  elapsed += dt;


  $("time").textContent =
    Math.max(
      0,
      Math.ceil(timeLeft)
    );


  if (timeLeft <= 0) {

    gameOver(true);

    return;

  }


  /* SPAWNING */

  spawnTimer -= dt;


  if (spawnTimer <= 0) {

    spawn();

    /*
      Game gets progressively faster.
    */

    spawnTimer =
      Math.max(
        0.26,
        0.92 -
        elapsed * 0.010
      );

  }


  /*
    Objects fall faster
    as time passes.
  */

  speedBoost =
    Math.min(
      250,
      elapsed * 4.2
    );


  /* OBJECT MOVEMENT */

  for (const it of items) {

    it.y +=
      it.vy * dt;


    const caught =
      it.y +
        it.size / 2 >=
        basket.y &&

      it.y <=
        basket.y +
        basket.h &&

      it.x >=
        basket.x - 10 &&

      it.x <=
        basket.x +
        basket.w +
        10;


    if (caught) {

      catchItem(it);

    }


    else if (
      it.y >
      H + 20
    ) {

      it.dead = true;


      /*
        Missing fruit
        costs a life.
      */

      if (!it.bomb) {

        lives--;

        combo = 0;

        updateHud();


        sound(
          180,
          0.08,
          "square",
          0.025
        );

      }

    }

  }


  items =
    items.filter(
      it => !it.dead
    );


  updateParticles(dt);


  shake =
    Math.max(
      0,
      shake -
      35 * dt
    );


  flash =
    Math.max(
      0,
      flash - dt
    );


  if (lives <= 0) {

    gameOver(false);

  }

}


/* =========================
   BACKGROUND
========================= */


  function drawBackground() {

  const isLight =
    document.body.classList.contains("light");

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      0,
      H
    );

  if (isLight) {

    gradient.addColorStop(
      0,
      "#9ddcff"
    );

    gradient.addColorStop(
      0.55,
      "#c9f0ff"
    );

    gradient.addColorStop(
      1,
      "#e8f7d8"
    );

  } else {

    gradient.addColorStop(
      0,
      "#302044"
    );

    gradient.addColorStop(
      0.55,
      "#59385f"
    );

    gradient.addColorStop(
      1,
      "#1f172d"
    );
  }

  ctx.fillStyle = gradient;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );


  // KEEP EVERYTHING BELOW THIS
  // exactly as it was
}

  /* MOON */

  ctx.fillStyle =
    "rgba(255,244,224,.12)";

  ctx.beginPath();

  ctx.arc(
    390,
    75,
    38,
    0,
    Math.PI * 2
  );

  ctx.fill();


  /* TREES */

  for (
    let x = 15;
    x < W;
    x += 70
  ) {

    ctx.fillStyle =
      "rgba(20,35,30,.28)";

    ctx.fillRect(
      x + 25,
      410,
      10,
      160
    );


    ctx.beginPath();

    ctx.arc(
      x + 30,
      395,
      42,
      0,
      Math.PI * 2
    );

    ctx.fill();

  }


  /* GROUND */

  ctx.fillStyle =
    "rgba(123,196,127,.15)";

  ctx.fillRect(
    0,
    H - 30,
    W,
    30
  );

}


/* =========================
   DRAW GAME
========================= */

function draw() {

  ctx.save();


  /* SCREEN SHAKE */

  if (shake > 0) {

    ctx.translate(
      (Math.random() - 0.5) *
      shake,

      (Math.random() - 0.5) *
      shake
    );

  }


  drawBackground();


  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "middle";


  ctx.font =
    "32px serif";


  /* OBJECTS */

  for (const it of items) {

    if (it.golden) {

      ctx.shadowColor =
        "#ffe066";

      ctx.shadowBlur =
        18;

    }


    ctx.fillText(
      it.emoji,
      it.x,
      it.y
    );


    ctx.shadowBlur = 0;

  }


  /* PARTICLES */

  for (const p of particles) {

    ctx.globalAlpha =
      Math.max(
        0,
        p.life /
        p.maxLife
      );


    if (p.text) {

      ctx.font =
        "bold 20px sans-serif";

      ctx.fillStyle =
        "#fff4e0";

      ctx.fillText(
        p.text,
        p.x,
        p.y
      );

    }

    else {

      ctx.fillStyle =
        p.good
          ? "#ffcf5a"
          : "#ff6b6b";

      ctx.fillRect(
        p.x,
        p.y,
        p.size,
        p.size
      );

    }

  }


  ctx.globalAlpha = 1;


  /* BASKET */

  ctx.shadowColor =
    "#ffb347";

  ctx.shadowBlur = 12;


  ctx.fillStyle =
    "#ffb347";


  ctx.beginPath();

  ctx.roundRect(
    basket.x,
    basket.y,
    basket.w,
    basket.h,
    [
      4,
      4,
      16,
      16
    ]
  );

  ctx.fill();


  ctx.shadowBlur = 0;


  ctx.fillStyle =
    "#c97a1a";


  ctx.fillRect(
    basket.x,
    basket.y,
    basket.w,
    5
  );


  /* COMBO TEXT */

  if (combo >= 3) {

    ctx.font =
      "bold 18px sans-serif";

    ctx.fillStyle =
      "#fff4e0";


    ctx.fillText(
      `${combo} CATCH STREAK!`,
      W / 2,
      30
    );

  }


  /* WHITE FLASH */

  if (flash > 0) {

    ctx.fillStyle =
      `rgba(255,255,255,${flash})`;

    ctx.fillRect(
      0,
      0,
      W,
      H
    );

  }


  ctx.restore();

}


/* =========================
   GAME LOOP
========================= */

function loop(t) {

  if (!running) return;


  const dt =
    Math.min(
      (t - last) / 1000,
      0.05
    );


  last = t;


  update(dt);

  draw();


  if (running) {

    requestAnimationFrame(
      loop
    );

  }

}


/* =========================
   START GAME
========================= */

function start() {

  reset();


  /*
    Enable audio after
    user interaction.
  */

  if (!audioCtx) {

    audioCtx =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

  }


  audioCtx.resume();


  $("overlay")
    .classList
    .add("hidden");


  running = true;


  last =
    performance.now();


  sound(
    520,
    0.08,
    "triangle"
  );


  setTimeout(() => {

    sound(
      780,
      0.1,
      "triangle"
    );

  }, 70);


  requestAnimationFrame(
    loop
  );

}


/* =========================
   GAME OVER
========================= */

function gameOver(timeUp) {

  running = false;


  /* HIGH SCORE */

  if (score > best) {

    best = score;


    localStorage.setItem(
      "orchardBest",
      best
    );


    $("best").textContent =
      best;

  }


  $("title").textContent =
    timeUp
      ? "🍎 Time's Up! 🍎"
      : "💥 Orchard Over!";


  $("msg").innerHTML =
    `Score: <b>${score}</b><br>` +
    `Best: <b>${best}</b> &nbsp; • &nbsp; ` +
    `Max Combo: <b>x${maxCombo || 1}</b>`;


  $("btn").textContent =
    "Play Again";


  $("overlay")
    .classList
    .remove("hidden");


  sound(
    timeUp
      ? 520
      : 150,

    0.25,

    "sawtooth",

    0.05
  );

}


/* =========================
   INITIALIZE
========================= */

$("btn").addEventListener(
  "click",
  start
);


reset();

draw();

const themeToggle =
  document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {

  document.body.classList.toggle("light");

  const isLight =
    document.body.classList.contains("light");

  themeToggle.textContent =
    isLight ? "🌙" : "☀️";

});