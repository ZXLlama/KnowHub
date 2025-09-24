/* index.js — 僅供 index.html；每張 tile 都有自己的 PNG */
const tiles = [
  { title: "knowledge", sub: "none",     href: "./knowledge.html", thumb: "./images/thumb-1.png" },
  { title: "vocab",     sub: "beta ver.", href: "./vocab.html",     thumb: "./images/thumb-2.png" },
  { title: "notes",     sub: "none",     href: "./notes.html",     thumb: "./images/thumb-3.png" },
  { title: "demo #4",   sub: "WIP",      href: "#",                thumb: "./images/thumb-4.png" },
  { title: "demo #5",   sub: "WIP",      href: "#",                thumb: "./images/thumb-5.png" },
  { title: "demo #6",   sub: "WIP",      href: "#",                thumb: "./images/thumb-6.png" },
  { title: "demo #7",   sub: "WIP",      href: "#",                thumb: "./images/thumb-7.png" },
  { title: "demo #8",   sub: "WIP",      href: "#",                thumb: "./images/thumb-8.png" },
];

function makeTileEl({ title, sub, href, thumb }) {
  const t = document.getElementById("tile-template");
  const node = t.content.cloneNode(true);
  const a = node.querySelector(".tile");
  a.href = href || "#";
  node.querySelector(".title").textContent = title;
  node.querySelector(".sub").textContent = sub;
  const img = node.querySelector(".thumb-img");
  img.src = thumb || "./images/Know-hub.png";
  img.alt = `${title} thumbnail`;
  img.addEventListener("error", () => { img.src = "./images/Know-hub.png"; }, { once:true });
  return node;
}

(function initGrid(){
  const grid = document.getElementById("tile-grid");
  const frag = document.createDocumentFragment();
  tiles.forEach(item => frag.appendChild(makeTileEl(item)));
  grid.appendChild(frag);
})();

/* Scroll reveal */
(function revealOnScroll(){
  const els = Array.from(document.querySelectorAll(".tile"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
  els.forEach(el => io.observe(el));
})();

/* Hover tilt（桌機）+ 霓虹跟隨 */
(function tilt(){
  if (!matchMedia("(hover: hover)").matches) return;
  const cards = document.querySelectorAll(".tile");
  const strength = 10;
  cards.forEach(card => {
    card.addEventListener("mousemove", (ev) => {
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width;   // 0~1
      const y = (ev.clientY - r.top) / r.height;   // 0~1
      const rx = (0.5 - y) * strength;
      const ry = (x - 0.5) * strength;
      card.style.setProperty("--mx", `${x*100}%`);
      card.style.setProperty("--my", `${y*100}%`);
      card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
      card.style.removeProperty("--mx");
      card.style.removeProperty("--my");
    });
  });
})();

/* Alt+Click → 新分頁開啟（桌機友善） */
document.getElementById("tile-grid").addEventListener("click", (e) => {
  const a = e.target.closest("a.tile");
  if (!a) return;
  if (e.altKey) { e.preventDefault(); window.open(a.href, "_blank", "noopener"); }
}, { passive: true });
