const grid = document.getElementById("grid");

// 📌 建立卡片函式
function buildGrid() {
  grid.innerHTML = ""; // 清空舊內容

  config.tiles.forEach(tile => {
    const card = document.createElement("div");
    card.className = "card";

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

    if (tile.link && tile.link !== "null") {
      const link = document.createElement("a");
      link.href = tile.link;
      link.target = "_blank";
      link.appendChild(card);
      grid.appendChild(link);
    } else {
      grid.appendChild(card);
    }
  });
}

// 📌 桌機 / 手機排版控制
function applyGridLayout() {
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // 手機 → 單欄
    grid.style.gridTemplateColumns = "1fr";
    grid.style.gridTemplateRows = "auto";

    // 手機 → 強制隱藏 subtitle、放大字體與圖片
    document.querySelectorAll(".card").forEach(card => {
      const img = card.querySelector(".card-img");
      const title = card.querySelector("h3");
      const subtitle = card.querySelector("p");

      // 放大圖片
      img.style.width = "80px";
      img.style.height = "80px";

      // 放大 Title
      title.style.fontSize = "24px";

      // 隱藏 Subtitle
      if (subtitle) subtitle.style.display = "none";

      // 放大 Card padding
      card.style.padding = "20px";
    });

    // 手機 → 社群 icon & 字體放大
    document.querySelectorAll(".social").forEach(social => {
      social.style.fontSize = "18px";
      social.style.padding = "12px 16px";
    });
    document.querySelectorAll(".social-icon").forEach(icon => {
      icon.style.width = "32px";
      icon.style.height = "32px";
    });

  } else {
    // 桌機 → 用 config 設定
    grid.style.gridTemplateColumns = `repeat(${config.grid.columns}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${config.grid.rows}, auto)`;

    // 桌機 → 還原 subtitle 顯示 & 字體
    document.querySelectorAll(".card").forEach(card => {
      const img = card.querySelector(".card-img");
      const title = card.querySelector("h3");
      const subtitle = card.querySelector("p");

      img.style.width = "64px";
      img.style.height = "64px";
      title.style.fontSize = "20px";
      if (subtitle) {
        subtitle.style.display = "block";
        subtitle.style.fontSize = "15px";
      }
      card.style.padding = "16px 20px";
    });

    // 桌機 → 還原社群字體大小
    document.querySelectorAll(".social").forEach(social => {
      social.style.fontSize = "14px";
      social.style.padding = "8px 12px";
    });
    document.querySelectorAll(".social-icon").forEach(icon => {
      icon.style.width = "24px";
      icon.style.height = "24px";
    });
  }
}

// 📌 強制所有卡片等高
function equalizeHeights() {
  const cards = document.querySelectorAll(".card");
  let maxHeight = 0;
  cards.forEach(c => {
    c.style.height = "auto"; // reset
    maxHeight = Math.max(maxHeight, c.offsetHeight);
  });
  cards.forEach(c => {
    c.style.height = maxHeight + "px";
  });
}

// 📌 初始化
function init() {
  buildGrid();
  applyGridLayout();
  equalizeHeights();
}

// 初始執行
window.addEventListener("load", init);

// 視窗縮放時重新套用
window.addEventListener("resize", () => {
  applyGridLayout();
  equalizeHeights();
});
