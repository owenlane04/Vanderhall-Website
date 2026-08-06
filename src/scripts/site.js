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

// Scroll reveals, V12-C. This is now the ONLY reveal mechanism, on every browser.
//
// V11 ran this as a fallback behind CSS.supports("animation-timeline: view()"), with scrubbed view()
// timelines as the primary path. That primary path was the reason Owen twice reported seeing no
// scroll motion with Reduce Motion off: a scrubbed reveal has no duration, so a trackpad flick spent
// its whole range in two frames, at the bottom edge of the screen, before the element reached
// anything a person reads. A transition on a real clock cannot be outrun that way. The feature query
// is therefore gone from this gate, which also means there is no longer a pair of paths to keep from
// driving the same element twice: there is one path. See the long note in site.css.
//
// Three constraints, all of them enforced here rather than in the stylesheet:
//
// - Reduced motion means no reveal at all, not a faster one. Nothing is marked and nothing hides.
// - Only elements sitting entirely below the fold at init are touched. This file runs after the load
//   event, so hiding something the visitor is already reading would visibly re-hide it. The first
//   viewport stays still, and motion is earned by scrolling.
// - The start state lives on the attribute this sets, so a page without JavaScript, or one where
//   this file never arrives, renders every element in its final state. Nothing can be left hidden.
//   This mattered in V11 and it is the whole safety story now that no CSS path renders the end state.
const REVEAL_SELECTORS = [
  ".vehicle-section__media", ".vehicle-section__body",
  ".photo-module__media", ".photo-module__body",
  ".card-grid--concepts .card", ".concept-figure",
  ".split__media", ".split__body",
  ".section-heading", ".spec-table", ".gts-figures", ".gts-scene", ".disclosures", ".resource-group",
  ".photo-module__specs .spec-row", ".vehicle-section__row .vehicle-section__support",
  // V12-C coverage. Five routes had no reveal target of any kind: the privacy policy, the three form
  // pages, and 404. The concept detail pages had one. These are their content blocks.
  // The form selectors are child combinators on purpose: one flat level per form, so a fieldset and
  // the fields inside it are never both marked. Two 0-to-1 fades on the same pixels multiply into a
  // dimmer, slower arrival than either. Where V11 chose that compounding deliberately, it stays: a
  // photo module's specification rows sit inside its revealed body and resolve together, which is
  // what deals them out one at a time rather than as a block.
  ".policy__section", ".lede", ".spec-note", ".form-heading",
  ".lead-form > .field", ".lead-form > .form-fieldset", ".lead-form > .form-submit-row",
].join(", ");

// Groups are dealt out one at a time rather than snapping in together: a row of cards, a group of
// specification rows, a stack of form fields. Capped so a long list never waits on a queue.
const REVEAL_STEP = 90;
const REVEAL_STEP_CAP = 5;
// How far up from the bottom edge an element must come before it reveals, as a fraction of the
// viewport. Shared by the observer's rootMargin and the safety sweep so the two cannot disagree.
const REVEAL_MARGIN = 0.12;
const revealDelay = (element) => {
  const position = () => [...element.parentElement.children].indexOf(element);
  const step = (index) => Math.min(index, REVEAL_STEP_CAP) * REVEAL_STEP;
  if (element.matches(".photo-module__specs .spec-row")) return step(position());
  if (element.matches(".card-grid--concepts .card")) return (position() % 3) * REVEAL_STEP;
  if (element.matches(".vehicle-section__row .vehicle-section__support")) return step(position());
  if (element.matches(".lead-form > .field")) return step(position() % 4);
  if (element.matches(".vehicle-section__body, .photo-module__body")) return REVEAL_STEP;
  return 0;
};

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const pending = new Set();
  const show = (element) => {
    element.dataset.reveal = "shown";
    pending.delete(element);
    revealer.unobserve(element);
    // Nothing left to reveal, so nothing left to listen for. The sweep below is cheap but it is not
    // free, and a page whose reveals have all fired should carry no scroll handler at all.
    if (!pending.size) removeEventListener("scroll", onScroll);
  };
  // Revealed a little before the element reaches the middle of the screen, so the motion has finished
  // by the time the visitor is reading it rather than while they are.
  const revealer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      // Once shown, always shown. A reveal that replayed on the way back up would be a page that
      // never settles.
      show(entry.target);
    }
  }, { rootMargin: `0px 0px -${REVEAL_MARGIN * 100}% 0px` });

  // The safety sweep, and it is load-bearing rather than belt-and-braces. An IntersectionObserver only
  // reports THRESHOLD CROSSINGS: if a jump takes an element from below the viewport to above it between
  // two frames, its intersection ratio was 0 before and is 0 after, no threshold was crossed, and no
  // callback ever fires. The element keeps the start state, and the start state is opacity 0. That is
  // content permanently invisible, and it is reachable by ordinary means: an in-page anchor, a browser
  // restoring scroll position on reload, a Home or End press, a fast flick on a trackpad.
  //
  // This was not a hypothetical. The verification suite scrolls each marked element into view in a
  // tight loop and then jumps to the foot of the page, and it found 61 elements across seven routes
  // left hidden that way. V11 could not have had this bug, because its primary path was CSS: an
  // element scrolled past had a resolved timeline no matter how it got there. Moving to a JavaScript
  // trigger is what introduced the failure mode, so the trigger has to answer for it.
  //
  // Anything now above the reveal line is revealed immediately. It has already been scrolled past, so
  // there is no motion left to show it: what matters is that it is visible, not that it animated.
  //
  // The sweep uses the observer's own trigger line, not the viewport edge. One shared constant, because
  // two nearly-equal lines would mean the sweep quietly winning every ordinary scroll and revealing
  // things 12% of a viewport earlier than intended, which is a behaviour change disguised as a safety
  // net rather than a safety net.
  let sweeping = false;
  const sweep = () => {
    sweeping = false;
    const line = innerHeight * (1 - REVEAL_MARGIN);
    for (const element of [...pending]) {
      if (element.getBoundingClientRect().top < line) show(element);
    }
  };
  const onScroll = () => {
    if (sweeping) return;
    sweeping = true;
    requestAnimationFrame(sweep);
  };

  for (const element of document.querySelectorAll(REVEAL_SELECTORS)) {
    if (element.getBoundingClientRect().top < innerHeight) continue;
    const delay = revealDelay(element);
    if (delay) element.style.setProperty("--reveal-delay", `${delay}ms`);
    element.dataset.reveal = "";
    pending.add(element);
    revealer.observe(element);
  }
  if (pending.size) addEventListener("scroll", onScroll, { passive: true });
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

  // V11-F, the fallback half of the dissolve. Where view() timelines are supported the stylesheet
  // drives this and nothing here runs; where they are not, the band's own visible fraction is written
  // into a custom property and the stylesheet turns it into opacity and blur. An IntersectionObserver
  // with a fine threshold ladder rather than a scroll listener, which is what makes this continuous
  // without putting layout reads on the scroll path. The property is set on the viewport, never on
  // the bar, so the pause control does not fade with the film it controls.
  if (CSS.supports("animation-timeline: view()")) return;
  const viewport = band.querySelector(".concept-marquee__viewport");
  if (!viewport) return;
  // The ratio is remapped rather than used raw, so this path finishes where the view() path finishes.
  // The stylesheet dissolves across exit -40% to exit 45%, which is to say it is done once 45% of the
  // band has left the top of the screen. A raw intersectionRatio would still be at 0.55 there and the
  // strip would linger through the cards. STRIP_FLOOR is that same 45%, expressed as the ratio the
  // fade must reach zero at, so the two paths are one decision written twice rather than two.
  const STRIP_FLOOR = 0.55;
  const steps = Array.from({ length: 21 }, (_, index) => index / 20);
  new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const visible = Math.min(1, Math.max(0, (entry.intersectionRatio - STRIP_FLOOR) / (1 - STRIP_FLOOR)));
      // Rounded to the ladder's own resolution so a sub-pixel scroll cannot write a new value that
      // triggers a repaint for no visible change.
      viewport.style.setProperty("--strip-visibility", (Math.round(visible * 20) / 20).toFixed(2));
    }
  }, { threshold: steps }).observe(band);
});

// Ambient video. V10 shipped three loops; V11-A leaves one, the montage behind the homepage hero.
// It is silent, and it carries no src attribute in the markup, only data-src. That is the load gate
// rather than a convention: a visitor who is not eligible for video, or who has no JavaScript, cannot
// request a byte of it, because there is nothing for the parser to fetch. This file itself runs after
// the load event, so no video can compete with the poster, the stylesheet or the first paint either.
//
// Three refusals are honoured before anything else happens, and each means no video and no control at
// all rather than a stopped video and a button. A control that offers to pause something that was
// never going to move is worse than no control.
//
// Reduced motion and Save-Data are the visitor's own preferences and were already here. The third is
// screen width, and it is new: Q-V11-1, answered by Owen on 2026-08-05. The one remaining loop is
// 2.83 MB of WebM against the 292 KB clip it replaces, and it now sits on the homepage, so that cost
// would land on every phone that opens the site. Above 768px the loop plays; below it the visitor
// gets the poster frame, which is the loop's own first frame, and loses motion and nothing else. The
// homepage LCP element is the poster either way.
//
// Read once, at load, rather than through a live matchMedia listener: this is an ambient loop, and
// beginning a 2.8 MB fetch because somebody rotated a tablet is not what the gate is for.
const VIDEO_MIN_WIDTH = 768;
if (!matchMedia("(prefers-reduced-motion: reduce)").matches
  && !navigator.connection?.saveData
  && matchMedia(`(min-width: ${VIDEO_MIN_WIDTH}px)`).matches) {
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
