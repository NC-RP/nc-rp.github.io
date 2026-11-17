(() => {
  "use strict";

  const article = document.querySelector(".article-page");
  const printStyles = document.querySelector('link[href$="/article-print.css"]');
  if (!article || !printStyles) return;

  const pageSize = document.createElement("style");
  pageSize.media = "print";
  document.head.append(pageSize);

  window.addEventListener("beforeprint", () => {
    const originalMedia = printStyles.media;
    const originalStyle = article.getAttribute("style");
    try {
      // Measure the print typography at the page's usable width, independently
      // of the browser window width. CSS pixels are 1/96 of an inch.
      printStyles.media = "all";
      article.style.width = "7.2in";
      article.style.display = "flow-root";
      const contentHeight = article.getBoundingClientRect().height;
      const pageHeight = Math.ceil(contentHeight + 1.3 * 96 + 24);
      pageSize.textContent = `@page { size: 8.5in ${pageHeight}px; margin: 0.65in; }`;
    } finally {
      printStyles.media = originalMedia;
      if (originalStyle === null) article.removeAttribute("style");
      else article.setAttribute("style", originalStyle);
    }
  });

  window.addEventListener("afterprint", () => {
    pageSize.textContent = "";
  });
})();
