(() => {
  const dropdown = document.querySelector(".nav-dropdown");
  const toggle = dropdown.querySelector(".nav-dropdown-toggle");
  const links = document.getElementById(toggle.getAttribute("aria-controls"));

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    links.hidden = !open;
  };

  dropdown.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") setOpen(true);
  });

  dropdown.addEventListener("pointerleave", (event) => {
    if (
      event.pointerType === "mouse" &&
      !dropdown.contains(document.activeElement)
    ) {
      setOpen(false);
    }
  });

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  dropdown.addEventListener("focusout", (event) => {
    if (!dropdown.contains(event.relatedTarget)) setOpen(false);
  });

  links.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!dropdown.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !links.hidden) {
      event.preventDefault();
      const returnFocus = dropdown.contains(document.activeElement);
      setOpen(false);
      if (returnFocus) toggle.focus();
    }
  });
})();
