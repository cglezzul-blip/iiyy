(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const damp = (current, target, smoothing, delta) => current + (target - current) * (1 - Math.exp(-smoothing * delta));

  if (!reducedMotion.matches) root.classList.add("motion-ok");

  function setupNavigation() {
    const header = $("#siteHeader");
    const nav = $("#siteNav");
    const button = $("#menuButton");
    const links = $$("a[href^='#']", nav);
    const sections = links
      .map(link => $(link.getAttribute("href")))
      .filter(Boolean);

    const isMobileMenu = () => innerWidth <= 820;
    const closeMenu = ({ restoreFocus = false } = {}) => {
      nav.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      nav.inert = isMobileMenu();
      if (restoreFocus) button.focus();
    };

    nav.inert = isMobileMenu();

    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
      nav.inert = open;
    });

    links.forEach(link => link.addEventListener("click", closeMenu));
    doc.addEventListener("keydown", event => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeMenu({ restoreFocus: true });
      }
    });

    const updateHeader = () => header.classList.toggle("is-scrolled", scrollY > 28);
    updateHeader();
    addEventListener("scroll", updateHeader, { passive: true });

    const sectionObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-28% 0px -56%", threshold: [0, .2, .5] });

    sections.forEach(section => sectionObserver.observe(section));

    addEventListener("resize", () => {
      if (innerWidth > 820) {
        nav.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
        nav.inert = false;
      } else if (!nav.classList.contains("is-open")) {
        nav.inert = true;
      }
    }, { passive: true });
  }

  function setupCapabilityRail() {
    const rail = $("#capabilityRail");
    const previous = $("[data-rail-prev]");
    const next = $("[data-rail-next]");
    if (!rail) return;

    let wheelTarget = rail.scrollLeft;
    let wheelFrame = 0;
    let lastFrame = performance.now();

    const stopWheelAnimation = () => {
      if (!wheelFrame) return;
      cancelAnimationFrame(wheelFrame);
      wheelFrame = 0;
    };

    const animateWheel = now => {
      const delta = Math.min(.05, Math.max(.001, (now - lastFrame) / 1000));
      lastFrame = now;
      rail.scrollLeft = damp(rail.scrollLeft, wheelTarget, 20, delta);

      if (Math.abs(rail.scrollLeft - wheelTarget) > .35) {
        wheelFrame = requestAnimationFrame(animateWheel);
      } else {
        rail.scrollLeft = wheelTarget;
        wheelFrame = 0;
      }
    };

    const move = direction => {
      const card = $(".capability-card", rail);
      const distance = card ? card.getBoundingClientRect().width + 48 : rail.clientWidth * .72;
      rail.scrollBy({ left: distance * direction, behavior: reducedMotion.matches ? "auto" : "smooth" });
    };

    previous?.addEventListener("click", () => move(-1));
    next?.addEventListener("click", () => move(1));

    if (finePointer.matches) {
      rail.addEventListener("wheel", event => {
        if (event.ctrlKey) return;

        const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (Math.abs(rawDelta) < .1) return;

        const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 28
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rail.clientWidth * .82
            : 1;
        const delta = rawDelta * scale;
        const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);

        if (!wheelFrame) wheelTarget = rail.scrollLeft;
        const nextTarget = clamp(wheelTarget + delta, 0, maximum);
        const atStart = delta < 0 && wheelTarget <= .5;
        const atEnd = delta > 0 && wheelTarget >= maximum - .5;

        // At either edge, hand the wheel back to the page instead of trapping the reader.
        if (atStart || atEnd) return;

        event.preventDefault();
        wheelTarget = nextTarget;

        if (reducedMotion.matches) {
          stopWheelAnimation();
          rail.scrollLeft = wheelTarget;
          return;
        }

        if (!wheelFrame) {
          lastFrame = performance.now();
          wheelFrame = requestAnimationFrame(animateWheel);
        }
      }, { passive: false });

      rail.addEventListener("scroll", () => {
        if (!wheelFrame) wheelTarget = rail.scrollLeft;
      }, { passive: true });
    }
  }

  function setupWorkflowStudy() {
    const study = $("#news-workflow");
    const rail = $("#capabilityRail");
    if (!study || !rail) return;
    const summary = $("summary", study);
    const label = $("[data-workflow-action]", study);
    let routePending = false;
    let alignFrame = 0;

    const updateLabel = () => {
      if (label) label.textContent = study.open ? "收起流程" : "查看流程";
    };
    const alignStudy = ({ force = false, focus = false } = {}) => {
      const card = study.closest(".capability-card");
      if (!card) return;
      const left = rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left;
      rail.scrollTo({ left, behavior: "instant" });
      const topInset = ($("#siteHeader")?.getBoundingClientRect().height || 82) + 22;
      const rect = study.getBoundingClientRect();
      if (force || rect.top < topInset || rect.top > innerHeight - 220) {
        scrollTo({ top: Math.max(0, scrollY + rect.top - topInset), behavior: reducedMotion.matches ? "instant" : "smooth" });
      }
      if (focus) summary?.focus({ preventScroll: true });
    };
    const queueAlignment = options => {
      if (alignFrame) cancelAnimationFrame(alignFrame);
      alignFrame = requestAnimationFrame(() => {
        alignFrame = requestAnimationFrame(() => {
          alignFrame = 0;
          alignStudy(options);
          routePending = false;
        });
      });
    };
    const openFromRoute = ({ focus = false } = {}) => {
      routePending = true;
      study.open = true;
      updateLabel();
      queueAlignment({ force: true, focus });
    };
    study.addEventListener("toggle", () => {
      updateLabel();
      if (study.open && !routePending) queueAlignment({ force: false });
    });
    $$("a[href='#news-workflow']").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      if (location.hash !== "#news-workflow") history.pushState(null, "", "#news-workflow");
      openFromRoute({ focus: true });
    }));
    addEventListener("hashchange", () => {
      if (location.hash === "#news-workflow") openFromRoute({ focus: true });
    });
    if (location.hash === "#news-workflow") {
      // Fonts can change preceding section heights on a direct fragment visit.
      Promise.resolve(doc.fonts?.ready).then(() => openFromRoute());
    }
    updateLabel();
  }


  function setupCertificateDialog() {
    const dialog = $("#certificateDialog");
    const image = $("#certificateDialogImage");
    if (!dialog || !image) return;

    $$('[data-certificate-open]').forEach(button => {
      button.addEventListener("click", () => {
        image.src = button.dataset.certificateOpen;
        image.alt = $("img", button)?.alt || "证书预览";
        dialog.showModal();
      });
    });
    $("[data-dialog-close]", dialog)?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  }


  function setupUtilities() {
    const copyButton = $("#copyEmail");
    const status = $("#copyStatus");
    const printButton = $("#printPage");
    const email = ["cglezzul", "gmail.com"].join("@");

    const copyText = async (value, label) => {
      let copied = false;
      try {
        if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch {
        const input = doc.createElement("textarea");
        const previousFocus = doc.activeElement;
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        doc.body.append(input);
        input.select();
        try { copied = doc.execCommand("copy"); }
        catch { copied = false; }
        finally { input.remove(); previousFocus?.focus({ preventScroll: true }); }
      }
      status.textContent = copied ? `${label}已复制` : `无法自动复制，请手动复制${label}：${value}`;
      setTimeout(() => { status.textContent = ""; }, copied ? 2400 : 8000);
      return copied;
    };

    copyButton?.addEventListener("click", () => copyText(email, "邮箱"));
    $$('[data-copy-contact]').forEach(button => {
      button.addEventListener("click", async () => {
        const action = $(".contact-channel-action", button);
        const originalLabel = action?.textContent;
        const copied = await copyText(button.dataset.copyContact, button.dataset.contactName || "联系方式");
        if (action) {
          action.textContent = copied ? "已复制" : "请手动复制";
          setTimeout(() => { action.textContent = originalLabel; }, 2400);
        }
      });
    });

    printButton?.addEventListener("click", () => print());
  }


  setupNavigation();
  setupCapabilityRail();
  setupWorkflowStudy();
  setupCertificateDialog();
  setupUtilities();
})();
