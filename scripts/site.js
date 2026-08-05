// The theme block is gone with light mode. `root` stays because the textarea autosize reads a
// spacing token off it further down.
const root = document.documentElement;

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

// Studio walkaround. Restored from V3, with the idle preload of every colour dropped: it pulled
// several megabytes nobody had asked for. Frame URLs are read from the swatches rather than built
// from a template, so the HTML is the one source for both this island and the build's check that
// no delivered frame goes unreferenced.
document.querySelectorAll("[data-walkaround]").forEach((viewer) => {
  const stage = viewer.querySelector("[data-walkaround-stage]");
  const frames = [...viewer.querySelectorAll(".walkaround__frame")];
  const dots = [...viewer.querySelectorAll(".walkaround__dots span")];
  const hint = viewer.querySelector("[data-walkaround-hint]");
  const live = viewer.querySelector("[data-walkaround-live]");
  const captionName = viewer.querySelector("[data-paint-name]");
  const captionTier = viewer.querySelector("[data-paint-tier]");
  const swatches = [...viewer.querySelectorAll(".swatch")];
  const controls = viewer.querySelector("[data-walkaround-controls]");
  const phrases = frames.map((frame) => frame.dataset.angle.replaceAll("-", " "));
  const state = { angle: 0, lastFullAngle: 0, paint: swatches.find((swatch) => swatch.classList.contains("is-selected")) };

  // The controls ship hidden and the swatches disabled, so a page without JavaScript shows a real
  // photograph rather than dead controls. Both are enabled only once this island is running.
  controls.hidden = false;
  swatches.forEach((swatch) => swatch.removeAttribute("disabled"));
  stage.dataset.ready = "true";
  viewer.dataset.ready = "true";

  const complete = () => state.paint.dataset.complete === "true";
  const announce = () => {
    const name = state.paint.dataset.paintName;
    if (live) live.textContent = complete() ? `${name}, angle ${state.angle + 1} of ${frames.length}.` : `${name}, still image.`;
  };

  const render = () => {
    frames.forEach((frame, index) => {
      const active = index === state.angle;
      frame.classList.toggle("is-active", active);
      if (active) {
        frame.removeAttribute("aria-hidden");
        frame.alt = `Brawley GTS in ${state.paint.dataset.paintName}, ${phrases[index]}`;
      } else {
        frame.setAttribute("aria-hidden", "true");
        frame.alt = "";
      }
    });
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === state.angle));
    stage.setAttribute("aria-label", complete()
      ? `Brawley GTS 360 viewer, ${state.paint.dataset.paintName}, angle ${state.angle + 1} of ${frames.length}`
      : `Brawley GTS, ${state.paint.dataset.paintName}, still image`);
    announce();
  };

  const step = (direction) => {
    if (!complete()) return;
    state.angle = (state.angle + direction + frames.length) % frames.length;
    state.lastFullAngle = state.angle;
    hint?.classList.add("is-used");
    render();
  };

  viewer.querySelector("[data-walkaround-prev]").addEventListener("click", () => step(-1));
  viewer.querySelector("[data-walkaround-next]").addEventListener("click", () => step(1));
  stage.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    step(event.key === "ArrowRight" ? 1 : -1);
  });

  // Pointer capture, so the gesture survives leaving the stage. The threshold scales with the
  // stage, which keeps a full-width drag at a little over one rotation at any size.
  let origin = null;
  stage.addEventListener("pointerdown", (event) => {
    origin = event.clientX;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", (event) => {
    if (origin === null || !complete()) return;
    const threshold = Math.min(120, Math.max(32, stage.clientWidth / 10));
    const distance = event.clientX - origin;
    if (Math.abs(distance) < threshold) return;
    step(distance < 0 ? 1 : -1);
    origin = event.clientX;
  });
  const endDrag = () => { origin = null; stage.classList.remove("is-dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  const framesOf = (swatch) => (swatch.dataset.frames || swatch.dataset.still || "")
    .split(",")
    .map((entry) => entry.trim())
    .reduce((sets, entry, index) => {
      const slot = Math.floor(index / 2);
      sets[slot] = sets[slot] ? `${sets[slot]}, ${entry}` : entry;
      return sets;
    }, []);

  const select = (swatch) => {
    const sets = framesOf(swatch);
    state.paint = swatch;
    viewer.dataset.paint = swatch.dataset.paint;
    swatches.forEach((item) => {
      const selected = item === swatch;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-checked", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    captionName.textContent = swatch.dataset.paintName;
    captionTier.textContent = `${swatch.dataset.tierLabel} paint, ${swatch.dataset.tierPrice}`;
    if (swatch.dataset.complete === "true") {
      // The angle is kept across a colour change, so choosing paint does not throw away the view
      // the visitor had chosen.
      state.angle = state.lastFullAngle;
      frames.forEach((frame, index) => {
        frame.srcset = sets[index];
        frame.src = sets[index].split(",").at(-1).trim().split(/\s+/)[0];
      });
    } else {
      state.angle = 0;
      frames[0].srcset = sets[0];
      frames[0].src = sets[0].split(",").at(-1).trim().split(/\s+/)[0];
    }
    render();
  };

  swatches.forEach((swatch, index) => {
    swatch.addEventListener("click", () => select(swatch));
    // Warming the frames on intent means a deliberate choice usually has its images already
    // decoded, without fetching all nine colours up front.
    const warm = () => framesOf(swatch).forEach((set) => { const image = new Image(); image.srcset = set; });
    swatch.addEventListener("pointerenter", warm, { once: true });
    swatch.addEventListener("focus", warm, { once: true });
    swatch.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0
        : event.key === "End" ? swatches.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + swatches.length) % swatches.length;
      swatches[next].focus();
      select(swatches[next]);
    });
  });
});

// Word cascade. The words of each section heading and lede become inline-block spans carrying a
// normalised position, and CSS animates them along the element's own view timeline. See site.css.
//
// The built HTML is untouched by this, which is the point: every string assertion in the check suite
// keeps passing, and a search engine indexes whole headings.
//
// Hero and page-header h1s are excluded deliberately, for two mechanical reasons rather than taste.
// A top-of-page element is already past its entry range at scroll zero, so a view() reveal on it
// resolves instantly and buys nothing. And this file loads after the load event, so splitting text
// that has already painted would visibly re-hide words the visitor is reading, which is the one
// failure mode that reads broken rather than premium. The guard below is what enforces it: only a
// block that sits entirely under the fold at split time is touched. Motion here is earned by
// scrolling, and the first viewport stays still.
if (!matchMedia("(prefers-reduced-motion: reduce)").matches && CSS.supports("animation-timeline: view()")) {
  document.querySelectorAll(".section-heading h2, .lede").forEach((element) => {
    if (element.dataset.split) return;
    // Text-only targets. An element with element children would have its markup rebuilt by the split.
    if (element.firstElementChild) return;
    if (element.getBoundingClientRect().top < innerHeight) return;
    const words = element.textContent.split(/(\s+)/).filter((part) => part.length);
    if (words.filter((part) => part.trim()).length < 2) return;
    const total = words.filter((part) => part.trim()).length;
    const fragment = document.createDocumentFragment();
    let index = 0;
    for (const part of words) {
      if (!part.trim()) {
        // Whitespace stays a real text node, so textContent is unchanged and words still wrap.
        fragment.append(part);
        continue;
      }
      const span = document.createElement("span");
      span.className = "word";
      span.style.setProperty("--wf", total > 1 ? String(index / (total - 1)) : "0");
      span.textContent = part;
      fragment.append(span);
      index += 1;
    }
    element.replaceChildren(fragment);
    element.dataset.split = "true";
    element.classList.add("is-split");
    // Moves the container's own reveal onto its siblings rather than stacking two animations.
    const heading = element.closest(".section-heading");
    if (heading) heading.dataset.split = "true";
  });
}

// The concept band. Its own reduced-motion guard rather than relying on the stylesheet's: under
// reduced motion the band stays a static filmstrip and the pause button stays hidden, because a
// control that stops something already stopped is worse than no control.
document.querySelectorAll("[data-marquee]").forEach((band) => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const toggle = band.querySelector("[data-marquee-toggle]");
  if (!toggle) return;
  toggle.hidden = false;
  band.dataset.ready = "true";
  toggle.addEventListener("click", () => {
    const paused = band.classList.toggle("is-paused");
    toggle.setAttribute("aria-pressed", String(paused));
  });
});

// Ambient video, V10. Three loops: the homepage hero and one block each on /brawley/ and
// /brawley/gts/. All three are silent, and none of them carries a src attribute in the markup, only
// data-src. That is the load gate rather than a convention: a visitor who is not eligible for video,
// or who has no JavaScript, cannot request a byte of it, because there is nothing for the parser to
// fetch. This file itself runs after the load event, so no video can compete with the poster, the
// stylesheet or the first paint either.
//
// Two refusals are honoured before anything else happens, and both mean no video and no control at
// all rather than a stopped video and a button: reduced motion, and Save-Data. A control that offers
// to pause something that was never going to move is worse than no control.
if (!matchMedia("(prefers-reduced-motion: reduce)").matches && !navigator.connection?.saveData) {
  document.querySelectorAll("[data-ambient]").forEach((block) => {
    const video = block.querySelector("[data-ambient-video]");
    const toggle = block.querySelector("[data-ambient-toggle]");
    if (!video || !toggle) return;

    // Two separate ideas, deliberately not one. `paused` is why the element is stopped right now;
    // `chosen` is whether the visitor asked for it. Only the visitor's choice survives scrolling
    // away and back, or the tab being hidden, which is what "resume only when it was not manually
    // paused" means.
    let chosenPause = false;
    let inView = false;
    let loaded = false;

    const load = () => {
      if (loaded) return;
      loaded = true;
      video.querySelectorAll("source[data-src]").forEach((source) => { source.src = source.dataset.src; });
      video.load();
    };

    // Labelled from the element's real state, never from what was just asked of it, so a refused
    // autoplay reveals a button reading Play rather than one reading Pause over a still poster.
    const label = () => { toggle.textContent = video.paused ? "Play" : "Pause"; };
    const reveal = () => { toggle.hidden = false; label(); };

    const play = () => {
      load();
      // A rejected play() is an ordinary outcome on a browser or a power setting that declines
      // autoplay, not an error: the poster is already correct, and the button becomes the way in.
      video.play().catch(() => {}).finally(reveal);
    };
    const stop = () => { video.pause(); label(); };

    // The first presented frame, not the play event. `playing` can fire before anything has been
    // painted, and fading the video in over the poster at that moment shows a blank panel.
    video.addEventListener("timeupdate", () => { block.dataset.painted = "true"; }, { once: true });
    video.addEventListener("pause", label);
    video.addEventListener("play", label);

    toggle.addEventListener("click", () => {
      chosenPause = !video.paused;
      if (chosenPause) stop();
      else play();
      // Relabelled here, synchronously, rather than left to the play promise and the play event. Both
      // of those resolve a task or more later, so pressing a button reading Play left it reading Play
      // over a film that had already started, and the fix is feedback on the press rather than on the
      // acknowledgement. play() sets paused to false before it returns, so this reads the real state,
      // and if playback is then refused the promise's own relabel corrects it.
      label();
    });

    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView && !chosenPause && document.visibilityState === "visible") play();
        else if (!inView) stop();
      }
      // rootMargin gives a below-fold block a moment to fetch before it arrives, so it is moving by
      // the time it is looked at. The hero is already intersecting, so it starts here on load.
    }, { rootMargin: "200px" }).observe(block);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") stop();
      else if (inView && !chosenPause) play();
    });
  });
}

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
