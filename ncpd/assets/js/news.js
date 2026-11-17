(() => {
  "use strict";

  const placeholder = "/ncpd/assets/images/placeholder.png";
  const newsContainers = document.querySelectorAll("[data-news]");
  const articleContainer = document.querySelector("[data-news-article]");

  if (!newsContainers.length && !articleContainer) return;

  const articleId = new URLSearchParams(window.location.search).get("id");
  const isArticlePage = !!articleContainer;

  const endpoint =
    "https://api.erlc-northerncity.workers.dev/news" +
    (isArticlePage ? `/${encodeURIComponent(articleId || "")}` : "");

  const cacheKey = isArticlePage
    ? `ncpd.article.v1.${articleId}`
    : "ncpd.news.v1";

  const cacheDuration = isArticlePage
    ? 3 * 24 * 60 * 60 * 1000
    : 30 * 60 * 1000;

  let cached = null;
  let refreshing = false;

  function createElement(tag, text, className) {
    const el = document.createElement(tag);

    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;

    return el;
  }

  function isValidArticle(article) {
    return (
      article &&
      typeof article === "object" &&
      (typeof article.id === "number" || typeof article.id === "string") &&
      typeof article.title === "string"
    );
  }

  function isValidData(data) {
    if (!data) return false;

    if (isArticlePage) {
      return (
        String(data.id) === articleId &&
        typeof data.title === "string" &&
        typeof data.content === "string"
      );
    }

    for (const key of ["featured", "recent", "all"]) {
      if (!Array.isArray(data[key])) return false;
      if (!data[key].every(isValidArticle)) return false;
    }

    return true;
  }

  function createArticleBody(content) {
    const body = createElement("div", undefined, "article-body");

    if (!window.DOMPurify) {
      body.textContent = content;
      body.classList.add("article-body-plain");
      return body;
    }

    const trimmed = content.trim();
    const isHTML = /^<(article|section|div|p|h[1-6]|blockquote|ul|ol)\b/i.test(
      trimmed,
    );

    let html = "";

    if (isHTML) {
      html = trimmed;
    } else if (window.marked) {
      html = window.marked.parse(trimmed, {
        async: false,
        gfm: true,
        breaks: false,
      });
    } else {
      body.textContent = content;
      body.classList.add("article-body-plain");
      return body;
    }

    body.innerHTML = window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["form", "input", "button", "textarea", "select"],
    });

    return body;
  }

  function createArticleCard(article, featured = false, detail = false) {
    let cardClass = "news-card";
    let contentClass = "news-content";
    let heading = "h3";

    if (featured) {
      cardClass = "featured-article";
      contentClass = "featured-content";
      heading = "h2";
    }

    if (detail) {
      cardClass = "article-detail";
      contentClass = "article-content";
      heading = "h1";
    }

    const card = createElement("article", undefined, cardClass);
    card.id = `${featured ? "featured" : "article"}-${article.id}`;

    // Article thumbnail
    const image = createElement("img");
    image.src = placeholder;
    image.alt = article.title;
    image.loading = "lazy";

    try {
      const url = new URL(article.thumbnail_url);

      if (url.protocol === "https:") {
        image.src = url.href;
      }
    } catch {
      // Use the placeholder if the image URL is invalid.
    }

    image.addEventListener("error", () => {
      if (image.getAttribute("src") !== placeholder) {
        image.src = placeholder;
      }
    });

    const content = createElement("div", undefined, contentClass);

    content.append(
      createElement("h5", article.article_type || "Department News"),
      createElement(heading, article.title),
    );

    // Publication date
    const date = new Date(article.date_published);

    if (!Number.isNaN(date.getTime())) {
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const time = createElement("time", formattedDate, "news-date");
      time.dateTime = date.toISOString();

      content.append(time);
    }

    if (detail) {
      content.append(createArticleBody(article.content));
    } else {
      content.append(createElement("p", article.description || ""));

      const link = createElement("a", "READ MORE →");
      link.href = `/ncpd/news/article/?id=${encodeURIComponent(article.id)}`;
      link.className = featured
        ? "button dark news-card-link"
        : "news-card-link";

      link.setAttribute("aria-label", `Read more: ${article.title}`);
      content.append(link);
    }

    card.append(image, content);
    return card;
  }

  function renderNews(data) {
    if (isArticlePage) {
      document.title = `${data.title} | NCPD News`;
      articleContainer.replaceChildren(createArticleCard(data, false, true));
      return;
    }

    newsContainers.forEach((container) => {
      const type = container.dataset.news;
      const articles = type === "recent" ? data.recent.slice(0, 3) : data[type];

      if (articles.length === 0) {
        const message =
          type === "featured"
            ? "No featured stories at this time."
            : "No news at this time.";

        container.replaceChildren(createElement("p", message));
        return;
      }

      const cards = articles.map((article) =>
        createArticleCard(article, type === "featured"),
      );

      container.replaceChildren(...cards);
    });
  }

  function showArticleMessage(title, message) {
    document.title = `${title} | NCPD News`;

    articleContainer.replaceChildren(
      createElement("h1", title),
      createElement("p", message),
    );
  }

  function loadCache() {
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey));

      if (
        stored &&
        Number.isFinite(stored.savedAt) &&
        isValidData(stored.data)
      ) {
        cached = stored;
      }
    } catch {
      // Ignore storage errors and load from the API instead.
    }
  }

  function saveCache(data) {
    cached = {
      savedAt: Date.now(),
      data: data,
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch {
      // The page can still work without local storage.
    }
  }

  async function refreshNews() {
    if (refreshing) return;

    // Don't request new data while the cache is still valid.
    if (cached) {
      const age = Date.now() - cached.savedAt;

      if (age >= 0 && age < cacheDuration) return;
    }

    refreshing = true;

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (isArticlePage && response.status === 404) {
        cached = null;

        try {
          localStorage.removeItem(cacheKey);
        } catch {
          // Ignore storage errors.
        }

        showArticleMessage(
          "Article not found",
          "This article may have been removed or the link is invalid.",
        );

        return;
      }

      if (!response.ok) {
        throw new Error(`News request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!isValidData(data)) {
        throw new Error("Invalid news response");
      }

      saveCache(data);
      renderNews(data);
    } catch (error) {
      if (cached) return;

      if (isArticlePage) {
        showArticleMessage(
          "Article unavailable",
          "We could not load this article. Please try again later.",
        );
      } else {
        newsContainers.forEach((container) => {
          container.replaceChildren(
            createElement(
              "p",
              "News is currently unavailable. Please try again later.",
            ),
          );
        });
      }
    } finally {
      refreshing = false;
    }
  }

  // Make sure an article ID was provided.
  if (isArticlePage && (!articleId || !articleId.trim())) {
    showArticleMessage(
      "Article not found",
      "Choose an article from the news page.",
    );
    return;
  }

  // Show cached articles immediately, then check for updates.
  loadCache();

  if (cached) {
    renderNews(cached.data);
  }

  refreshNews();

  // Check for updates every minute.
  setInterval(refreshNews, 60000);

  // Check again when the user returns to the tab.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshNews();
    }
  });
})();
