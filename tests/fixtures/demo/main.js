const b = document.querySelector(".licznik");
let n = 0;
b.addEventListener("click", () => { n += 1; b.querySelector("b").textContent = n; });
window.__demo = "działa";
