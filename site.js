(() => {
  "use strict";

  const data = window.SITE_DATA;
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const email = () => `${data.person.email.user}@${data.person.email.host}.${data.person.email.tld}`;
  const publicProjects = () => data.projects.filter(project => project.public !== false);
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function buildChrome() {
    const ambient = create("div", "ambient-background");
    ambient.setAttribute("aria-hidden", "true");
    ambient.append(
      create("span", "ambient-glow"),
      create("span", "ambient-aurora ambient-aurora-one"),
      create("span", "ambient-aurora ambient-aurora-two"),
      create("span", "ambient-orbit")
    );
    document.body.prepend(ambient);

    const current = document.body.dataset.page || "home";
    const items = [
      ["home", "首页", "index.html"],
      ["about", "档案", "about.html"],
      ["growth", "成长", "growth.html"],
      ["projects", "项目", "projects.html"]
    ];

    const header = $("#site-header");
    if (header) {
      header.className = "site-header";
      const nav = create("nav", "nav container");
      nav.setAttribute("aria-label", "主导航");

      const brand = create("a", "brand");
      brand.href = "index.html";
      brand.setAttribute("aria-label", "返回首页");
      brand.append(create("span", "brand-mark", "尹"), create("span", "", data.person.name));

      const links = create("div", "nav-links");
      links.id = "navLinks";
      items.forEach(([key, label, href]) => {
        const link = create("a", "", label);
        link.href = href;
        if (current === key || (current === "project" && key === "projects") || (current === "certificates" && key === "about")) link.setAttribute("aria-current", "page");
        links.append(link);
      });

      const actions = create("div", "nav-actions");
      const mode = create("button", "icon-btn", "◐");
      mode.id = "modeToggle";
      mode.type = "button";
      mode.title = "切换深浅色";
      mode.setAttribute("aria-label", "切换深浅色");
      const menu = create("button", "menu-btn", "☰");
      menu.id = "menuBtn";
      menu.type = "button";
      menu.setAttribute("aria-label", "打开导航");
      menu.setAttribute("aria-controls", "navLinks");
      menu.setAttribute("aria-expanded", "false");
      actions.append(mode, menu);
      nav.append(brand, links, actions);
      header.append(nav);
    }

    const footer = $("#site-footer");
    if (footer) {
      footer.className = "site-footer";
      const row = create("div", "container footer-row");
      row.append(
        create("span", "", `© ${new Date().getFullYear()} ${data.person.name}`),
        create("span", "", `个人主页 v${data.meta.version} · 更新于 ${data.meta.updated}`)
      );
      footer.append(row);
    }
  }

  function setupTheme() {
    const root = document.documentElement;
    const storedMode = localStorage.getItem("site-mode");
    root.dataset.mode = storedMode || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.dataset.theme = "cyan";
    const button = $("#modeToggle");
    const updateIcon = () => { if (button) button.textContent = root.dataset.mode === "dark" ? "☀" : "☾"; };
    updateIcon();
    button?.addEventListener("click", () => {
      root.dataset.mode = root.dataset.mode === "dark" ? "light" : "dark";
      localStorage.setItem("site-mode", root.dataset.mode);
      updateIcon();
    });
  }

  function setupNavigation() {
    const menu = $("#menuBtn");
    const links = $("#navLinks");
    menu?.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
    });
    links?.addEventListener("click", () => {
      links.classList.remove("open");
      menu?.setAttribute("aria-expanded", "false");
    });
    $("#printBtn")?.addEventListener("click", () => window.print());

    document.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target || link.hasAttribute("download") || link.href.startsWith("mailto:") || link.hash && link.pathname === location.pathname) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || !destination.pathname.endsWith(".html")) return;
      if (reducedMotion()) return;
      event.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(() => { location.href = destination.href; }, 390);
    });
  }

  function setupScroll() {
    const progress = $("#scrollProgress");
    const rail = $("#railLine");
    const percent = $("#scrollPercent");
    const back = $("#backTop");
    const header = $("#site-header");
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const value = max > 0 ? Math.min(100, Math.max(0, scrollY / max * 100)) : 0;
      if (progress) progress.style.width = `${value}%`;
      if (rail) rail.style.setProperty("--rail-progress", `${value}%`);
      if (percent) percent.textContent = `${String(Math.round(value)).padStart(2, "0")}%`;
      back?.classList.toggle("show", scrollY > 500);
      header?.classList.toggle("scrolled", scrollY > 24);
      if (!reducedMotion()) {
        const distance = Math.min(scrollY, 900);
        document.documentElement.style.setProperty("--echo-shift", `${Math.round(distance * -.028)}px`);
        document.documentElement.style.setProperty("--outline-shift", `${Math.round(Math.min(distance, 520) * .045)}px`);
        document.documentElement.style.setProperty("--grid-shift", `${Math.round(distance * -.045)}px`);
      }
      updateTimelineProgress();
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update, { passive: true });
    back?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    update();
  }

  function setupAmbientBackground() {
    if (reducedMotion()) return;
    const root = document.documentElement;
    let currentX = 72;
    let currentY = 18;
    let targetX = currentX;
    let targetY = currentY;
    let frame = 0;

    const draw = () => {
      currentX += (targetX - currentX) * .1;
      currentY += (targetY - currentY) * .1;
      root.style.setProperty("--ambient-x", `${currentX.toFixed(2)}%`);
      root.style.setProperty("--ambient-y", `${currentY.toFixed(2)}%`);
      if (Math.abs(targetX - currentX) > .05 || Math.abs(targetY - currentY) > .05) frame = requestAnimationFrame(draw);
      else frame = 0;
    };

    addEventListener("pointermove", event => {
      if (!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
      targetX = event.clientX / Math.max(1, innerWidth) * 100;
      targetY = event.clientY / Math.max(1, innerHeight) * 100;
      if (!frame) frame = requestAnimationFrame(draw);
    }, { passive: true });
  }

  function setupMotionEnhancements() {
    const staggerGroups = [".project-grid", ".capability-grid"];
    staggerGroups.forEach(selector => {
      const group = $(selector);
      if (!group) return;
      $$(":scope > .reveal", group).forEach((node, index) => {
        node.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 70}ms`);
      });
    });
    $$(".timeline-item.reveal").forEach((node, index) => {
      node.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 55}ms`);
    });
    $$(".nav-links a").forEach((node, index) => {
      node.style.setProperty("--nav-delay", `${index * 45}ms`);
    });
  }

  function setupMobileCardFocus() {
    const cards = $$(".portal-card,.capability-card");
    if (!cards.length || !(matchMedia("(pointer: coarse)").matches || innerWidth <= 760)) return;
    if (!("IntersectionObserver" in window)) {
      cards[0].classList.add("is-mobile-active");
      return;
    }
    const visibility = new Map(cards.map(card => [card, 0]));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0));
      const visible = [...visibility]
        .map(([target, intersectionRatio]) => ({ target, intersectionRatio }))
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || visible.intersectionRatio < .48) return;
      cards.forEach(card => {
        const isActive = card === visible.target;
        card.classList.toggle("is-mobile-active", isActive);
        if (card.classList.contains("has-preview")) card.setAttribute("aria-expanded", String(isActive));
      });
    }, { threshold: [.35, .48, .62, .78] });
    cards.forEach(card => observer.observe(card));

    const previews = cards.filter(card => card.classList.contains("has-preview"));
    previews.forEach(card => card.addEventListener("click", () => {
      const willOpen = !card.classList.contains("is-mobile-active");
      previews.forEach(item => {
        item.classList.remove("is-mobile-active");
        item.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        card.classList.add("is-mobile-active");
        card.setAttribute("aria-expanded", "true");
      }
    }));
  }

  function setupPortalCardMotion() {
    const grid = $(".portal-grid");
    const cards = $$(".portal-card", grid || document);
    if (!grid || !cards.length || reducedMotion() || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;

    cards.forEach(card => {
      let frame = 0;
      const reset = () => {
        cancelAnimationFrame(frame);
        card.classList.remove("is-pointer-active");
        grid.classList.remove("is-card-hovering");
        card.style.setProperty("--card-rx", "0deg");
        card.style.setProperty("--card-ry", "0deg");
        card.style.setProperty("--layer-x", "0px");
        card.style.setProperty("--layer-y", "0px");
      };
      card.addEventListener("pointerenter", () => {
        cards.forEach(item => item.classList.remove("is-pointer-active"));
        card.classList.add("is-pointer-active");
        grid.classList.add("is-card-hovering");
      });
      card.addEventListener("pointermove", event => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
          const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
          card.style.setProperty("--card-rx", `${(-y * 3.6).toFixed(2)}deg`);
          card.style.setProperty("--card-ry", `${(x * 4.8).toFixed(2)}deg`);
          card.style.setProperty("--layer-x", `${(x * 10).toFixed(1)}px`);
          card.style.setProperty("--layer-y", `${(y * 8).toFixed(1)}px`);
          card.style.setProperty("--spot-x", `${((x + 1) * 50).toFixed(1)}%`);
          card.style.setProperty("--spot-y", `${((y + 1) * 50).toFixed(1)}%`);
        });
      });
      card.addEventListener("pointerleave", reset);
    });
  }

  function setupCapabilityCardMotion() {
    const grid = $("#capabilityGrid");
    const cards = $$(".capability-card", grid || document);
    if (!grid || !cards.length || reducedMotion() || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;

    cards.forEach(card => {
      let frame = 0;
      const reset = () => {
        cancelAnimationFrame(frame);
        card.classList.remove("is-pointer-active");
        grid.classList.remove("is-capability-hovering");
        card.style.setProperty("--cap-rx", "0deg");
        card.style.setProperty("--cap-ry", "0deg");
        card.style.setProperty("--cap-spot-x", "50%");
        card.style.setProperty("--cap-spot-y", "50%");
        card.style.setProperty("--cap-shift-x", "0px");
        card.style.setProperty("--cap-shift-y", "0px");
      };
      card.addEventListener("pointerenter", () => {
        cards.forEach(item => item.classList.remove("is-pointer-active"));
        card.classList.add("is-pointer-active");
        grid.classList.add("is-capability-hovering");
      });
      card.addEventListener("pointermove", event => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
          const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
          card.style.setProperty("--cap-rx", `${(-y * 3.2).toFixed(2)}deg`);
          card.style.setProperty("--cap-ry", `${(x * 4).toFixed(2)}deg`);
          card.style.setProperty("--cap-spot-x", `${((x + 1) * 50).toFixed(1)}%`);
          card.style.setProperty("--cap-spot-y", `${((y + 1) * 50).toFixed(1)}%`);
          card.style.setProperty("--cap-shift-x", `${(x * 9).toFixed(1)}px`);
          card.style.setProperty("--cap-shift-y", `${(y * 7).toFixed(1)}px`);
        });
      });
      card.addEventListener("pointerleave", reset);
    });
  }

  function setupFeaturedWorkMotion() {
    const card = $(".featured-work");
    if (!card || reducedMotion() || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      card.style.setProperty("--work-x", "0px");
      card.style.setProperty("--work-y", "0px");
      card.style.setProperty("--work-spot-x", "50%");
      card.style.setProperty("--work-spot-y", "50%");
    };
    card.addEventListener("pointermove", event => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        card.style.setProperty("--work-x", `${(x * 11).toFixed(1)}px`);
        card.style.setProperty("--work-y", `${(y * 8).toFixed(1)}px`);
        card.style.setProperty("--work-spot-x", `${((x + 1) * 50).toFixed(1)}%`);
        card.style.setProperty("--work-spot-y", `${((y + 1) * 50).toFixed(1)}%`);
      });
    });
    card.addEventListener("pointerleave", reset);
  }

  function setupProjectCategoryMotion() {
    const grid = $("#projectCategoryGrid");
    const cards = $$(".project-category-card", grid || document);
    if (!grid || !cards.length || reducedMotion() || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;

    cards.forEach(card => {
      let frame = 0;
      const reset = () => {
        cancelAnimationFrame(frame);
        card.classList.remove("is-pointer-active");
        grid.classList.remove("is-category-hovering");
        card.style.setProperty("--category-rx", "0deg");
        card.style.setProperty("--category-ry", "0deg");
      };
      card.addEventListener("pointerenter", () => {
        cards.forEach(item => item.classList.remove("is-pointer-active"));
        card.classList.add("is-pointer-active");
        grid.classList.add("is-category-hovering");
      });
      card.addEventListener("pointermove", event => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
          const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
          card.style.setProperty("--category-rx", `${(-y * 2.6).toFixed(2)}deg`);
          card.style.setProperty("--category-ry", `${(x * 3.2).toFixed(2)}deg`);
          card.style.setProperty("--category-spot-x", `${((x + 1) * 50).toFixed(1)}%`);
          card.style.setProperty("--category-spot-y", `${((y + 1) * 50).toFixed(1)}%`);
        });
      });
      card.addEventListener("pointerleave", reset);
    });
  }

  function setupInteractiveVisual() {
    const visual = $("#interactiveVisual");
    if (!visual || reducedMotion()) return;
    const setMotion = (x, y) => {
      visual.style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
      visual.style.setProperty("--tilt-y", `${(x * 9).toFixed(2)}deg`);
      visual.style.setProperty("--move-x", `${(x * 13).toFixed(1)}px`);
      visual.style.setProperty("--move-y", `${(y * 10).toFixed(1)}px`);
      visual.style.setProperty("--move-x-reverse", `${(-x * 16).toFixed(1)}px`);
      visual.style.setProperty("--move-y-reverse", `${(-y * 12).toFixed(1)}px`);
    };
    const reset = () => {
      setMotion(0, 0);
      visual.classList.remove("is-interacting");
    };

    if (matchMedia("(hover:hover) and (pointer:fine)").matches) {
      visual.addEventListener("pointerenter", () => visual.classList.add("is-interacting"));
      visual.addEventListener("pointermove", event => {
        const rect = visual.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        setMotion(x, y);
      });
      visual.addEventListener("pointerleave", reset);
      return;
    }

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = visual.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const y = Math.max(-1, Math.min(1, (innerHeight / 2 - center) / innerHeight));
        setMotion(y * .35, y * .7);
      });
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update, { passive: true });
    update();
  }

  function setupReveal() {
    const nodes = $$(".reveal");
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      nodes.forEach(node => node.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });
    nodes.forEach(node => observer.observe(node));
  }

  async function copyEmail(button) {
    const value = email();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = create("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    const previous = button.textContent;
    button.textContent = "已复制";
    showToast("邮箱已复制");
    setTimeout(() => { button.textContent = previous; }, 1500);
  }

  function showToast(message) {
    let toast = $("#siteToast");
    if (!toast) {
      toast = create("div", "site-toast");
      toast.id = "siteToast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.remove("show");
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function bindEmailButtons() {
    $$("[data-copy-email]").forEach(button => {
      if (button.dataset.showEmail === "true") button.textContent = `${email()} · 复制`;
      button.addEventListener("click", () => copyEmail(button));
    });
    $$('[data-email-text]').forEach(node => { node.textContent = email(); });
    $$('[data-email-link]').forEach(node => { node.href = `mailto:${email()}`; });
  }

  function makeProjectCard(project, index) {
    const card = create("article", "project-card reveal");
    if (project.featured) card.classList.add("is-featured");
    card.dataset.category = project.category || "other";
    card.dataset.project = project.id;
    const category = (data.projectCategories || []).find(item => item.id === project.category);
    const visual = create("div", "project-visual");
    if (project.cover) {
      visual.classList.add("has-image");
      const image = create("img");
      image.src = project.cover;
      image.alt = project.coverAlt || `${project.title}项目封面`;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.remove();
        visual.classList.remove("has-image");
      }, { once: true });
      visual.append(image);
    } else {
      visual.classList.add("is-placeholder", `theme-${project.visualTheme || "default"}`);
      const placeholder = create("div", "project-placeholder-art");
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.append(
        create("span", "project-placeholder-kicker", project.visualTheme === "game" ? "CAMPUS / DEFENSE" : "PROJECT / PREVIEW"),
        create("strong", "", project.visualTheme === "game" ? "CORE" : "YYB"),
        create("i", "", "封面待补充")
      );
      visual.append(placeholder);
    }
    const visualMeta = create("div", "project-visual-meta");
    visualMeta.append(create("span", "project-no", String(index + 1).padStart(2, "0")), create("span", "project-status", project.status || "作品"));
    visual.append(visualMeta);
    const body = create("div", "project-body");
    const meta = create("div", "project-meta");
    meta.append(create("span", "", category?.title || "其他作品"), create("span", "", project.period || ""));
    const title = create("div", "project-title-link");
    title.append(create("h3", "", project.title));
    body.append(meta, title, create("p", "project-summary", project.summary || ""));
    const facts = create("dl", "project-card-facts");
    [["我的职责", project.role], ["当前成果", project.result]].forEach(([label, value]) => {
      if (!value) return;
      const row = create("div");
      row.append(create("dt", "", label), create("dd", "", value));
      facts.append(row);
    });
    const tags = create("div", "project-tags");
    (project.stack || []).slice(0, 4).forEach(tag => tags.append(create("span", "badge", tag)));
    const actions = create("div", "button-row project-card-actions");
    if (project.github) {
      const github = create("a", "btn", "GitHub ↗");
      github.href = project.github;
      github.target = "_blank";
      github.rel = "noopener";
      actions.append(github);
    }
    if (project.demo) {
      const demo = create("a", "btn", "在线演示 ↗");
      demo.href = project.demo;
      demo.target = "_blank";
      demo.rel = "noopener";
      actions.append(demo);
    }
    if (!actions.children.length) actions.append(create("span", "project-link-placeholder", "项目网址待补"));
    if (facts.children.length) body.append(facts);
    if (tags.children.length) body.append(tags);
    body.append(actions);
    card.append(visual, body);
    return card;
  }

  function renderHome() {
    if (document.body.dataset.page !== "home") return;
    $("#heroIdentity").textContent = data.person.identity;
    $("#heroName").textContent = data.person.name;
    $("#heroEnglish").textContent = data.person.englishName;
    $("#heroSummary").textContent = data.person.summary;
    $("#heroSchool").textContent = data.education.school;
    $("#heroMajor").textContent = `${data.education.major} · ${data.education.degree}`;
    $("#heroEducationPeriod").textContent = data.education.period;
    (data.person.roles || []).forEach((role, index) => {
      const chip = create("span", "", role.title);
      $("#heroRoleList")?.append(chip);
    });
    (data.heroShowcases || []).forEach((item, index) => {
      const card = $(`#heroShowcase${index + 1}`);
      if (!card) return;
      card.querySelector("b").textContent = item.title;
      card.querySelector("small").textContent = item.english;
      const media = card.querySelector(".visual-card-media");
      media.classList.add(`theme-${item.theme || "default"}`);
      if (item.previewFit) media.classList.add(`fit-${item.previewFit}`);
      if (item.previewTone) media.classList.add(`tone-${item.previewTone}`);
      if (item.preview) {
        const image = create("img");
        image.src = item.preview;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        media.append(image);
        card.classList.add("has-preview");
      }
    });

    const featured = publicProjects().find(project => project.featured) || publicProjects()[0];
    const featuredHost = $("#featuredWork");
    if (featured && featuredHost) {
      const category = (data.projectCategories || []).find(item => item.id === featured.category);
      const card = create("article", "featured-work reveal");
      const media = create("a", "featured-work-media");
      media.href = featured.demo || featured.github || "projects.html";
      if (featured.demo || featured.github) {
        media.target = "_blank";
        media.rel = "noopener";
      }
      const image = create("img");
      image.src = featured.cover;
      image.alt = featured.coverAlt || featured.title;
      image.loading = "lazy";
      image.decoding = "async";
      media.append(image, create("span", "featured-work-view", "体验作品 ↗"));
      const body = create("div", "featured-work-body");
      const meta = create("div", "featured-work-meta");
      meta.append(create("span", "", category?.title || "代表作品"), create("span", "", featured.status || "可运行作品"));
      const title = create("h3");
      const titleParts = featured.title.split(/[：:]/).map(part => part.trim()).filter(Boolean);
      (titleParts.length > 1 ? titleParts : [featured.title]).forEach(part => title.append(create("span", "", part)));
      const summary = create("p", "", featured.homeSummary || featured.summary);
      const metrics = create("div", "featured-work-metrics");
      (featured.metrics || []).forEach(item => {
        const metric = create("span");
        metric.append(create("strong", "", item.value), create("small", "", item.label));
        metrics.append(metric);
      });
      const action = create("a", "btn primary", "在线体验 ↗");
      action.href = featured.demo || featured.github || "projects.html";
      if (featured.demo || featured.github) {
        action.target = "_blank";
        action.rel = "noopener";
      }
      body.append(meta, title, summary);
      if (metrics.children.length) body.append(metrics);
      body.append(action);
      card.append(media, body);
      featuredHost.append(card);
    }

    const grid = $("#capabilityGrid");
    (data.capabilities || []).forEach(item => {
      const card = create("article", `capability-card capability-${item.visual} reveal`);
      card.dataset.mark = item.mark || "";
      if (item.preview) {
        card.classList.add("has-preview");
        card.tabIndex = 0;
        card.setAttribute("aria-label", `${item.title}，查看作品预览`);
        card.setAttribute("aria-expanded", "false");
        const preview = create("div", "capability-preview");
        if (item.previewFit) preview.classList.add(`fit-${item.previewFit}`);
        if (item.previewTone) preview.classList.add(`tone-${item.previewTone}`);
        const previewImage = create("img");
        previewImage.src = item.preview;
        previewImage.alt = item.previewAlt || item.title;
        previewImage.loading = "lazy";
        previewImage.decoding = "async";
        preview.append(previewImage);
        card.append(preview);
      }
      const visual = create("div", `capability-visual capability-visual-${item.visual}`);
      visual.setAttribute("aria-hidden", "true");
      if (item.visual === "ai") {
        for (let index = 0; index < 5; index += 1) visual.append(create("span"));
        for (let index = 0; index < 4; index += 1) visual.append(create("i"));
      } else if (item.visual === "slides") {
        ["01", "02", "03"].forEach(label => visual.append(create("span", "", label)));
      } else if (item.visual === "creative") {
        visual.append(
          create("i", "creative-window creative-window-one"),
          create("i", "creative-window creative-window-two"),
          create("i", "creative-window creative-window-three")
        );
      }
      card.append(visual, create("h3", "capability-title", item.title));
      grid?.append(card);
    });
  }

  function buildAchievementCard(item) {
    const category = (data.achievementCategories || []).find(entry => entry.id === item.type);
    const card = create("article", "card achievement-item reveal");
    if (item.image) {
      const media = create("a", "achievement-media");
      media.href = item.file || item.image;
      media.target = "_blank";
      media.rel = "noopener";
      media.setAttribute("aria-label", `查看${item.title}原图`);
      const image = create("img");
      image.src = item.image;
      image.alt = item.alt || item.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => media.remove(), { once: true });
      media.append(image);
      card.append(media);
    }
    const body = create("div", "achievement-item-body");
    body.append(create("span", "badge", category?.title || "成果"), create("h3", "", item.title));
    const details = [
      ["颁发机构", item.issuer],
      ["颁发日期", item.date],
      ["有效期至", item.validUntil]
    ].filter(([, value]) => value);
    if (details.length) {
      const meta = create("dl", "achievement-item-meta");
      details.forEach(([label, value]) => {
        const row = create("div");
        row.append(create("dt", "", label), create("dd", "", value));
        meta.append(row);
      });
      body.append(meta);
    }
    if (item.file && !item.image) {
      const link = create("a", "btn", "查看文件 ↗");
      link.href = item.file;
      link.target = "_blank";
      link.rel = "noopener";
      body.append(link);
    }
    card.append(body);
    return card;
  }

  function renderAbout() {
    if (document.body.dataset.page !== "about") return;
    $("#educationSchool").textContent = data.education.school;
    $("#educationMajor").textContent = `${data.education.major} · ${data.education.degree}`;
    $("#educationPeriod").textContent = data.education.period;
    $("#educationLocation").textContent = data.education.location;
    $("#educationStatus").textContent = data.education.status;
    const achievements = (data.achievements || []).filter(item => item.public !== false);
    (data.achievementCategories || []).forEach(category => {
      const count = achievements.filter(item => item.type === category.id).length;
      const canEnter = Boolean(count && category.href);
      const card = create(canEnter ? "a" : "article", "achievement-category-card reveal");
      card.dataset.category = category.id;
      if (count) card.classList.add("has-records");
      if (canEnter) {
        card.classList.add("is-entry");
        card.href = category.href;
        card.setAttribute("aria-label", `进入${category.title}库，共 ${count} 条公开记录`);
      }
      const top = create("div", "achievement-category-top");
      top.append(create("span", "", category.english), create("b", "", String(count).padStart(2, "0")));
      card.append(top, create("h3", "", category.title), create("span", "achievement-category-desc", category.description), create("span", "achievement-category-state", canEnter ? `进入${category.title}库 ↗` : count ? `${count} 条公开记录` : "暂无公开记录"));
      $("#achievementCategoryGrid").append(card);
    });
  }

  function renderCertificates() {
    if (document.body.dataset.page !== "certificates") return;
    const certificates = (data.achievements || []).filter(item => item.public !== false && item.type === "certificates");
    $("#certificateCount").textContent = String(certificates.length).padStart(2, "0");
    if (!certificates.length) {
      $("#certificateEmpty").hidden = false;
      return;
    }
    certificates.forEach(item => $("#certificateItems").append(buildAchievementCard(item)));
  }

  function renderGrowth() {
    if (document.body.dataset.page !== "growth") return;
    const records = data.growth.filter(item => item.public).sort((a, b) => b.date.localeCompare(a.date));
    $("#growthRecordCount").textContent = String(records.length).padStart(2, "0");
    if (records.length) {
      const firstYear = records[records.length - 1].date.slice(0, 4);
      $("#growthDateRange").textContent = `${firstYear}—至今`;
    }
    const types = ["全部", ...new Set(records.map(item => item.type))];
    types.forEach((type, index) => {
      const button = create("button", "filter-btn", type);
      button.type = "button";
      button.dataset.filter = type;
      button.setAttribute("aria-pressed", String(index === 0));
      $("#growthFilters").append(button);
    });
    records.forEach((item, index) => {
      const article = create("article", "timeline-item reveal");
      article.id = item.id;
      article.dataset.type = item.type;
      const [year, month, day] = item.date.split("-");
      const date = create("time", "timeline-date");
      date.dateTime = item.date;
      date.append(create("span", "", year), create("strong", "", `${month}.${day}`));
      const content = create("div", "timeline-content");
      const top = create("div", "timeline-top");
      top.append(create("span", "badge", item.type), create("span", "timeline-index", String(index + 1).padStart(2, "0")));
      content.append(top, create("h3", "", item.title), create("p", "", item.summary), create("div", "timeline-evidence", item.evidence));
      article.append(date, content);
      $("#timeline").append(article);
    });
    $("#growthFilters").addEventListener("click", event => {
      const button = event.target.closest(".filter-btn");
      if (!button) return;
      $$(".filter-btn", event.currentTarget).forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      $$(".timeline-item").forEach(item => item.classList.toggle("is-filtered", button.dataset.filter !== "全部" && item.dataset.type !== button.dataset.filter));
      updateTimelineProgress();
    });
  }

  function updateTimelineProgress() {
    const timeline = $("#timeline");
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const distance = innerHeight * .68 - rect.top;
    const value = Math.max(0, Math.min(100, distance / Math.max(1, rect.height) * 100));
    timeline.style.setProperty("--timeline-progress", `${value}%`);
  }

  function renderProjects() {
    if (document.body.dataset.page !== "projects") return;
    const projects = publicProjects();
    const categories = data.projectCategories || [];
    const collection = $("#projectCollection");
    const grid = $("#projectGrid");

    const showCategory = (category, options = {}) => {
      const { scroll = true, updateUrl = true } = options;
      const matches = projects.filter(project => (project.category || "other") === category.id);
      $$(".project-category-card", $("#projectCategoryGrid")).forEach(card => {
        card.setAttribute("aria-pressed", String(card.dataset.category === category.id));
      });
      grid.replaceChildren();
      $("#projectCollectionTitle").textContent = `${category.title} · ${String(matches.length).padStart(2, "0")}`;
      collection.hidden = matches.length === 0;
      matches.forEach((project, index) => grid.append(makeProjectCard(project, index)));
      if (updateUrl) {
        const url = new URL(location.href);
        url.searchParams.set("category", category.id);
        history.replaceState(null, "", url);
      }
      if (matches.length) {
        setupReveal();
        setupMotionEnhancements();
        if (scroll) collection.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      }
    };

    categories.forEach(category => {
      const count = projects.filter(project => (project.category || "other") === category.id).length;
      const button = create("button", "project-category-card reveal");
      button.type = "button";
      button.dataset.category = category.id;
      button.dataset.mark = category.mark || "+";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${category.title}，${count} 个公开作品`);
      const countLabel = create("span", "project-category-count");
      countLabel.append(create("b", "", String(count).padStart(2, "0")), create("i", "", "WORKS"));
      const examples = create("span", "project-category-examples");
      (category.examples || []).forEach(item => examples.append(create("em", "", item)));
      button.append(
        countLabel,
        create("strong", "", category.title),
        create("span", "project-category-description", category.description),
        examples,
        create("span", "project-category-action", count ? "查看作品 ↗" : "暂无公开作品")
      );
      button.addEventListener("click", () => showCategory(category));
      $("#projectCategoryGrid").append(button);
    });

    const requestedCategory = new URLSearchParams(location.search).get("category");
    const initialCategory = categories.find(category => category.id === requestedCategory);
    if (initialCategory && projects.some(project => (project.category || "other") === initialCategory.id)) {
      showCategory(initialCategory, { scroll: false, updateUrl: false });
    }
  }

  function renderResume() {
    if (document.body.dataset.page !== "resume") return;
    $("#resumeName").textContent = data.person.name;
    $("#resumeRole").textContent = data.person.role;
    $("#resumeLocation").textContent = data.person.location;
    $("#resumeEmail").textContent = email();
    $("#resumeProfile").textContent = data.resume.profile;
    $("#resumeSchool").textContent = data.education.school;
    $("#resumeMajor").textContent = `${data.education.major} · ${data.education.degree}`;
    $("#resumePeriod").textContent = `${data.education.period}｜${data.education.location}`;
    data.resume.currentCapabilities.forEach(item => {
      const li = create("li");
      const strong = create("strong", "", `${item.title}：`);
      li.append(strong, document.createTextNode(item.text));
      $("#resumeCapabilities").append(li);
    });
    data.interests.forEach(item => {
      const li = create("li");
      li.append(create("strong", "", `${item.title}：`), document.createTextNode(item.summary));
      $("#resumeInterests").append(li);
    });
    const projects = publicProjects().filter(project => project.includeInResume !== false);
    if (projects.length) {
      $("#resumeProjectsSection").hidden = false;
      projects.forEach(project => {
        const li = create("li");
        li.append(create("strong", "", `${project.title}：`), document.createTextNode(project.result || project.summary));
        $("#resumeProjects").append(li);
      });
    }
    if (data.resume.experience.length) $("#resumeExperienceSection").hidden = false;
    const awardItems = [
      ...data.resume.awards.map(item => typeof item === "string" ? item : [item.title, item.issuer, item.date].filter(Boolean).join(" · ")),
      ...(data.achievements || []).filter(item => item.public !== false).map(item => [item.title, item.issuer, item.date].filter(Boolean).join(" · "))
    ].filter(Boolean);
    if (awardItems.length) {
      $("#resumeAwardsSection").hidden = false;
      const list = create("ul", "resume-list");
      awardItems.forEach(item => list.append(create("li", "", item)));
      $("#resumeAwards").append(list);
    }
    $("#resumePrint")?.addEventListener("click", () => window.print());
  }

  function init() {
    document.documentElement.classList.add("js");
    buildChrome();
    renderHome();
    renderAbout();
    renderCertificates();
    renderGrowth();
    renderProjects();
    renderResume();
    setupTheme();
    setupAmbientBackground();
    setupNavigation();
    setupScroll();
    setupMotionEnhancements();
    setupCapabilityCardMotion();
    setupFeaturedWorkMotion();
    setupPortalCardMotion();
    setupProjectCategoryMotion();
    setupMobileCardFocus();
    setupInteractiveVisual();
    setupReveal();
    bindEmailButtons();
    requestAnimationFrame(() => document.body.classList.add("is-ready"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
