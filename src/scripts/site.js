const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

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
document.querySelectorAll("[data-open-lead]").forEach((button) => button.addEventListener("click", (event) => showSheet(document.querySelector("[data-lead-sheet]"), event.currentTarget)));
document.querySelector("[data-close-lead]")?.addEventListener("click", closeSheet);
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

const megaTrigger = document.querySelector("[data-vehicles-trigger]");
const megaPanel = document.querySelector("[data-mega-panel]");
let megaTimer;
const openMega = () => {
  if (!megaPanel || !megaTrigger || matchMedia("(max-width: 1023px)").matches) return;
  clearTimeout(megaTimer);
  megaPanel.hidden = false;
  megaTrigger.setAttribute("aria-expanded", "true");
};
const closeMega = (delay = 0) => {
  clearTimeout(megaTimer);
  megaTimer = setTimeout(() => {
    if (!megaPanel || !megaTrigger) return;
    megaPanel.hidden = true;
    megaTrigger.setAttribute("aria-expanded", "false");
  }, delay);
};
megaTrigger?.addEventListener("click", (event) => {
  if (matchMedia("(min-width: 1024px)").matches) {
    event.preventDefault();
    megaPanel.hidden ? openMega() : closeMega();
  }
});
megaTrigger?.addEventListener("mouseenter", () => { megaTimer = setTimeout(openMega, 80); });
megaTrigger?.addEventListener("mouseleave", () => closeMega(200));
megaPanel?.addEventListener("mouseenter", () => clearTimeout(megaTimer));
megaPanel?.addEventListener("mouseleave", () => closeMega(200));
megaPanel?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closeMega(); megaTrigger.focus(); }
});

document.querySelectorAll("[data-filter-pill]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filterPill;
    const cards = [...document.querySelectorAll("[data-model-grid] .model-card")];
    document.querySelectorAll("[data-filter-pill]").forEach((pill) => {
      const active = pill === button;
      pill.classList.toggle("is-active", active);
      pill.setAttribute("aria-pressed", String(active));
    });
    let count = 0;
    cards.forEach((card) => {
      const haystack = card.dataset.filter;
      const show = filter === "all" || haystack.includes(filter) || (filter === "on-road" && !haystack.includes("4x4")) || (filter === "off-road" && haystack.includes("4x4"));
      card.hidden = !show;
      if (show) count += 1;
    });
    const live = document.querySelector("[data-filter-live]");
    if (live) live.textContent = `${count} vehicles shown.`;
  });
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
  table.querySelector("[data-expand-specs]")?.addEventListener("click", (event) => {
    const groups = [...table.querySelectorAll("details")];
    const expand = groups.some((group) => !group.open);
    groups.forEach((group) => { group.open = expand; });
    event.currentTarget.textContent = expand ? "Collapse all" : "Expand all";
  });
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

document.querySelector("[data-dealer-filter]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("[data-missing='dealer-list']")?.focus?.();
});

document.querySelectorAll("[data-walkaround]").forEach((viewer) => {
  const stage = viewer.querySelector("[data-walkaround-stage]");
  const frames = [...viewer.querySelectorAll(".walkaround__frame")];
  const dots = [...viewer.querySelectorAll(".walkaround__dots span")];
  const hint = viewer.querySelector("[data-walkaround-hint]");
  const name = viewer.querySelector("[data-walkaround-name]");
  const note = viewer.querySelector("[data-colorway-note]");
  const state = { angle: 0, color: "Atomic Green", complete: true, pointerStart: null };
  const dragStep = parseFloat(getComputedStyle(root).getPropertyValue("--drag-step"));

  const renderAngle = () => {
    frames.forEach((frame, index) => frame.classList.toggle("is-active", index === state.angle));
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === state.angle));
    stage.setAttribute("aria-label", state.complete ? `Angle ${state.angle + 1} of 8, ${state.color}` : `Still image, ${state.color}`);
    hint.classList.add("is-used");
  };
  const step = (direction) => {
    if (!state.complete) return;
    state.angle = (state.angle + direction + frames.length) % frames.length;
    renderAngle();
  };
  viewer.querySelector("[data-walkaround-prev]").addEventListener("click", () => step(-1));
  viewer.querySelector("[data-walkaround-next]").addEventListener("click", () => step(1));
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); }
  });
  stage.addEventListener("pointerdown", (event) => {
    state.pointerStart = event.clientX;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", (event) => {
    if (state.pointerStart === null || !state.complete) return;
    const distance = event.clientX - state.pointerStart;
    if (Math.abs(distance) >= dragStep) {
      step(distance < 0 ? 1 : -1);
      state.pointerStart = event.clientX;
    }
  });
  const endPointer = () => { state.pointerStart = null; stage.classList.remove("is-dragging"); };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  const swatches = [...viewer.querySelectorAll(".swatch")];
  swatches.forEach((swatch, index) => {
    const select = () => {
      const color = JSON.parse(swatch.dataset.colorway);
      state.color = color.name;
      state.complete = color.complete;
      name.textContent = color.name;
      swatches.forEach((item) => { const selected = item === swatch; item.classList.toggle("is-selected", selected); item.setAttribute("aria-checked", String(selected)); });
      if (color.complete) {
        const paths = Object.values(color.frames);
        frames.forEach((frame, frameIndex) => { frame.src = paths[frameIndex]; frame.alt = frameIndex === state.angle ? `Vanderhall Brawley in ${color.name}` : ""; });
        note.textContent = "Jean Grey and Concrete Grey have partial studio sets and display as still images.";
      } else {
        state.angle = 0;
        frames[0].src = color.still;
        frames[0].alt = `Vanderhall Brawley in ${color.name}`;
        frames.slice(1).forEach((frame) => { frame.alt = ""; });
        note.textContent = `${color.name} has a partial studio set, so a still image is shown.`;
      }
      renderAngle();
    };
    swatch.addEventListener("click", select);
    swatch.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? swatches.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + swatches.length) % swatches.length;
      swatches[nextIndex].focus();
      swatches[nextIndex].click();
    });
  });

  const preloadQueue = swatches.slice(1);
  const schedule = (callback) => {
    if ("requestIdleCallback" in window) requestIdleCallback(callback, { timeout: 4000 });
    else setTimeout(callback, reducedMotion.matches ? 0 : 1200);
  };
  const preloadNext = () => {
    const swatch = preloadQueue.shift();
    if (!swatch) return;
    const color = JSON.parse(swatch.dataset.colorway);
    const paths = color.complete ? Object.values(color.frames) : [color.still];
    paths.forEach((path) => { const image = new Image(); image.src = path; });
    schedule(preloadNext);
  };
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    schedule(preloadNext);
  }, { rootMargin: "20%" });
  observer.observe(viewer);
});
