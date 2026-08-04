const root = document.documentElement;

const updateThemeLabels = () => {
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-label", `Use ${current === "dark" ? "light" : "dark"} theme`);
  });
};

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("vhw.theme", next); } catch (error) {}
    updateThemeLabels();
  });
});
updateThemeLabels();

const header = document.querySelector("[data-header]");
const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])";
let openSheet = null;
let returnFocus = null;

const closeSheet = () => {
  if (!openSheet) return;
  openSheet.hidden = true;
  openSheet.setAttribute("aria-hidden", "true");
  document.querySelector("[data-sheet-backdrop]").hidden = true;
  document.body.classList.remove("has-open-sheet");
  openSheet = null;
  returnFocus?.focus();
};

const showSheet = (sheet, trigger) => {
  closeSheet();
  returnFocus = trigger;
  openSheet = sheet;
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
  document.querySelector("[data-sheet-backdrop]").hidden = false;
  document.body.classList.add("has-open-sheet");
  sheet.querySelector(focusableSelector)?.focus();
};

document.querySelector("[data-open-menu]")?.addEventListener("click", (event) => showSheet(document.querySelector("[data-menu-sheet]"), event.currentTarget));
document.querySelector("[data-close-menu]")?.addEventListener("click", closeSheet);
document.querySelector("[data-sheet-backdrop]")?.addEventListener("click", closeSheet);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSheet();
  if (event.key !== "Tab" || !openSheet) return;
  const focusable = [...openSheet.querySelectorAll(focusableSelector)];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

document.querySelectorAll("[data-spec-table]").forEach((table) => {
  const radios = [...table.querySelectorAll(".unit-toggle input")];
  const live = table.querySelector("[data-unit-live]");
  const storedMetric = root.classList.contains("unit-metric");
  radios.forEach((radio) => { radio.checked = storedMetric ? radio.value === "metric" : radio.value === "imperial"; });
  radios.forEach((radio) => radio.addEventListener("change", () => {
    const metric = radio.value === "metric";
    root.classList.toggle("unit-metric", metric);
    try { localStorage.setItem("vhw.units", metric ? "metric" : "imperial"); } catch (error) {}
    if (live) live.textContent = `Units set to ${metric ? "metric" : "imperial"}.`;
  }));
});

const setError = (control, message) => {
  control.setAttribute("aria-invalid", "true");
  const error = control.closest(".field, .field-group")?.querySelector(".field__error");
  if (error) {
    error.textContent = message;
    if (!error.id) error.id = `${control.id}-error`;
    control.setAttribute("aria-describedby", error.id);
  }
};

const clearErrors = (form) => {
  form.querySelectorAll("[aria-invalid='true']").forEach((control) => control.removeAttribute("aria-invalid"));
  form.querySelectorAll(".field__error").forEach((error) => { error.textContent = ""; });
};

document.querySelectorAll("[data-site-form]").forEach((form) => {
  const renderedAt = form.querySelector("[name='render_timestamp']");
  if (renderedAt) renderedAt.value = String(Date.now());
  const pageField = form.querySelector("[name='page']");
  if (pageField) pageField.value = location.pathname;
  const modelParam = new URLSearchParams(location.search).get("model");
  if (modelParam) {
    const interest = form.querySelector(`[name='interest'][value='${CSS.escape(modelParam)}']`);
    if (interest) interest.checked = true;
  }
  form.querySelectorAll("textarea").forEach((textarea) => textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, parseFloat(getComputedStyle(root).getPropertyValue("--s-10")) * 4)}px`;
  }));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors(form);
    const failures = [];
    const seenGroups = new Set();
    [...form.elements].filter((control) => control.matches("input[required], select[required], textarea[required]")).forEach((control) => {
      if ((control.type === "radio" || control.type === "checkbox") && seenGroups.has(control.name)) return;
      if (control.type === "radio" || control.type === "checkbox") seenGroups.add(control.name);
      if (!control.validity.valid) {
        const message = control.validity.patternMismatch ? "Enter the requested format." : control.validity.typeMismatch ? `Enter a valid ${control.type === "url" ? "URL" : "email address"}.` : "This field is required.";
        setError(control, message);
        failures.push([control, message]);
      }
    });
    const honeypot = form.querySelector("[name='honeypot']");
    const elapsed = Date.now() - Number(renderedAt?.value || 0);
    if (honeypot?.value || elapsed < 2000) failures.push([form.querySelector("button[type='submit']"), "Please wait a moment and try again."]);
    const summary = form.querySelector(".form-error-summary");
    if (failures.length) {
      summary.hidden = false;
      summary.innerHTML = `<strong>Please correct ${failures.length} ${failures.length === 1 ? "item" : "items"}.</strong><ul>${failures.map(([control, message]) => `<li><a href="#${control.id || form.id}">${message}</a></li>`).join("")}</ul>`;
      summary.querySelectorAll("a").forEach((anchor, index) => anchor.addEventListener("click", (clickEvent) => { clickEvent.preventDefault(); failures[index][0].focus(); }));
      summary.focus();
      return;
    }
    summary.hidden = true;
    const status = form.querySelector(".form-status");
    if (!form.dataset.endpoint) {
      status.textContent = "This form is not connected yet. Your information was not sent.";
      status.focus();
      return;
    }
    status.textContent = "Sending";
  });
});
