const grid = document.getElementById("grid");
const mq = window.matchMedia("(max-width: 768px)");

/** 生成卡片（含進場延遲變數） */
function buildGrid() {
  grid.innerHTML = "";
  config.tiles.forEach((tile, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--delay", `${i * 80}ms`);

    const img = document.createElement("img");
    img.className = "card-img";
    img.src = tile.image && tile.image !== "null" ? tile.image : "DEV.png";

    const text = document.createElement("div");
    text.className = "card-text";

    const title = document.createElement("h3");
    title.textContent = tile.title && tile.title !== "null" ? tile.title : "null";

    const subtitle = document.createElement("p");
    subtitle.textContent = tile.subtitle && tile.subtitle !== "null" ? tile.subtitle : "null";

    text.appendChild(title);
    text.appendChild(subtitle);
    card.appendChild(img);
    card.appendChild(text);

    let host = card;
    if (tile.link && tile.link !== "null") {
      const a = document.createElement("a");
      a.href = tile.link;
      a.target = "_blank";
      a.appendChild(card);
      host = a;
    }
    // 讓 stagger 作用到容器
    host.style.setProperty("--delay", `${i * 80}ms`);
    host.style.animationDelay = `var(--delay)`;
    grid.appendChild(host);
  });
}

/** 切換手機/桌機模式（JS 主導） */
function applyMode() {
  const isMobile = mq.matches;
  document.body.classList.toggle("is-mobile", isMobile);

  if (isMobile) {
    grid.style.gridTemplateColumns = "1fr";
    grid.style.gridTemplateRows = "auto";
    grid.style.width = "100%";
  } else {
    grid.style.gridTemplateColumns = `repeat(${config.grid.columns}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${config.grid.rows}, auto)`;
    grid.style.width = "80%";
  }

  // 等到圖片載入後再等高，避免圖片高度尚未就緒
  const imgs = Array.from(document.images).filter(img => !img.complete);
  if (imgs.length) {
    let left = imgs.length;
    imgs.forEach(img => {
      img.addEventListener("load", () => { if(--left === 0) equalizeHeights(); }, { once: true });
      img.addEventListener("error", () => { if(--left === 0) equalizeHeights(); }, { once: true });
    });
  } else {
    equalizeHeights();
  }
}

/** 強制所有卡片等高 */
function equalizeHeights() {
  const cards = grid.querySelectorAll(".card");
  let maxH = 0;
  cards.forEach(c => { c.style.height = "auto"; maxH = Math.max(maxH, c.offsetHeight); });
  cards.forEach(c => (c.style.height = maxH + "px"));
}

/** 初始化 */
function init() {
  buildGrid();
  applyMode();
}

window.addEventListener("load", init);
mq.addEventListener("change", applyMode);
window.addEventListener("resize", applyMode);
