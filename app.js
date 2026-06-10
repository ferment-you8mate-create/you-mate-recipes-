const recipes = window.RECIPES || [];
const recipeGrid = document.querySelector("#recipes");
const searchInput = document.querySelector("#searchInput");
const filters = [...document.querySelectorAll(".filter")];
const labelFilters = [...document.querySelectorAll(".label-filter")];
const modal = document.querySelector("#recipeModal");
const modalContent = document.querySelector("#modalContent");
const closeButton = document.querySelector(".modal__close");

let currentFilter = "all";
let currentLabel = "all";
let currentSearch = "";

const categories = {
  main: "主菜",
  side: "副菜",
  sweets: "甘味",
  drink: "飲み物"
};

document.querySelector("#recipeCount").textContent = recipes.length;
document.querySelector("#studentCount").textContent = new Set(recipes.map((recipe) => recipe.name)).size;

function imageUrl(id) {
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function matchesRecipe(recipe) {
  const categoryMatch = currentFilter === "all" || recipe.category === currentFilter;
  const labels = recipe.labels || [];
  const labelMatch = currentLabel === "all" || labels.includes(currentLabel);
  const haystack = `${recipe.name} ${recipe.title} ${recipe.ferment} ${recipe.materials} ${labels.join(" ")}`.toLowerCase();
  return categoryMatch && labelMatch && haystack.includes(currentSearch.toLowerCase());
}

function renderLabels(labels = []) {
  if (!labels.length) return "";
  return `
    <div class="label-chips" aria-label="レシピラベル">
      ${labels.map((label) => `<span class="label-chip">${escapeHtml(label)}</span>`).join("")}
    </div>
  `;
}

function renderRecipes() {
  const visibleRecipes = recipes.filter(matchesRecipe);

  if (!visibleRecipes.length) {
    recipeGrid.innerHTML = `<p class="empty">該当するレシピが見つかりませんでした。</p>`;
    return;
  }

  recipeGrid.innerHTML = visibleRecipes.map((recipe, index) => {
    const sourceIndex = recipes.indexOf(recipe);
    const image = recipe.imageId
      ? `<img class="card__image" src="${imageUrl(recipe.imageId)}" alt="${escapeHtml(recipe.title)}">`
      : `<div class="card__fallback">発酵ごはん<br>${escapeHtml(recipe.title)}</div>`;

    return `
      <article class="card">
        ${image}
        <div class="card__body">
          <span class="tag">${categories[recipe.category] || "レシピ"}</span>
          <h3>${escapeHtml(recipe.title)}</h3>
          <p class="meta">${escapeHtml(recipe.name)} / ${escapeHtml(recipe.ferment)}</p>
          ${renderLabels(recipe.labels)}
          <p class="excerpt">${escapeHtml(recipe.point).slice(0, 84)}${recipe.point.length > 84 ? "..." : ""}</p>
          <button class="open-recipe" type="button" data-index="${sourceIndex}">詳しく見る</button>
        </div>
      </article>
    `;
  }).join("");
}

function openRecipe(index) {
  const recipe = recipes[index];
  const image = recipe.imageId
    ? `<img class="modal__image" src="${imageUrl(recipe.imageId)}" alt="${escapeHtml(recipe.title)}">`
    : "";

  modalContent.innerHTML = `
    ${image}
    <span class="tag">${categories[recipe.category] || "レシピ"}</span>
    <h2>${escapeHtml(recipe.title)}</h2>
    <p class="meta">${escapeHtml(recipe.name)} / ${escapeHtml(recipe.ferment)}</p>
    ${renderLabels(recipe.labels)}
    <dl class="recipe-detail">
      <dt>材料</dt>
      <dd>${escapeHtml(recipe.materials)}</dd>
      <dt>作り方</dt>
      <dd>${escapeHtml(recipe.steps)}</dd>
      <dt>工夫したポイント</dt>
      <dd>${escapeHtml(recipe.point)}</dd>
      <dt>掲載可否</dt>
      <dd>${escapeHtml(recipe.consent)}</dd>
    </dl>
  `;

  modal.showModal();
}

searchInput.addEventListener("input", (event) => {
  currentSearch = event.target.value.trim();
  renderRecipes();
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filters.forEach((item) => item.classList.toggle("is-active", item === button));
    renderRecipes();
  });
});

labelFilters.forEach((button) => {
  button.addEventListener("click", () => {
    currentLabel = button.dataset.label;
    labelFilters.forEach((item) => item.classList.toggle("is-active", item === button));
    renderRecipes();
  });
});

recipeGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".open-recipe");
  if (!button) return;
  openRecipe(Number(button.dataset.index));
});

closeButton.addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});

renderRecipes();
