(function () {
  var STORAGE_KEY = "blogFilter";
  var cards = document.querySelectorAll(".blog-card");
  var buttons = document.querySelectorAll(".blog-filters button");
  if (!cards.length || !buttons.length) return;

  function setPressed(active) {
    buttons.forEach(function (btn) {
      var match = btn.getAttribute("data-filter") === active;
      btn.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }

  function applyFilter(filter) {
    var value = filter || "all";
    cards.forEach(function (card) {
      var cat = card.getAttribute("data-category") || "";
      var hide = value !== "all" && cat !== value;
      card.classList.toggle("is-hidden", hide);
    });
    setPressed(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* ignore */
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyFilter(btn.getAttribute("data-filter"));
    });
  });

  var saved = "all";
  try {
    saved = localStorage.getItem(STORAGE_KEY) || "all";
  } catch (e) {
    /* ignore */
  }
  applyFilter(saved);
})();
