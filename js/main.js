// Happy Max Handyman — UI behaviors.
// Sticky-header shadow, mobile menu, smooth-scroll close, scroll reveals,
// dynamic footer year.

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---- footer year ----
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- header scrolled state ----
  const header = $("#siteHeader");
  if (header) {
    const onScroll = () => {
      header.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---- mobile menu toggle ----
  const toggle = $("#menuToggle");
  const menu = $("#mobileMenu");
  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  };
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setMenu(open);
    });
    // close mobile menu on any link click
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    // close mobile menu on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
      }
    });
    // close if resized to desktop
    const mq = window.matchMedia("(min-width: 960px)");
    mq.addEventListener("change", (e) => { if (e.matches) setMenu(false); });
  }

  // ---- scroll reveal ----
  const revealEls = $$(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    // fallback: just show everything
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  // ---- offset anchor scroll under sticky header ----
  // Apply scroll-margin-top to every section that has an id we link to,
  // so smooth scroll lands cleanly below the header.
  const HEADER_H = 80;
  $$("section[id]").forEach((sec) => {
    sec.style.scrollMarginTop = HEADER_H + "px";
  });
})();
