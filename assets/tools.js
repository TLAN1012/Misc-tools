/* ---------------------------------------------------------------------------
   Tool registry — add a new tool by appending an entry here, and the hub
   homepage will pick it up automatically. Keep `href` relative so the site
   works both locally and on GitHub Pages under a sub-path.
--------------------------------------------------------------------------- */
window.TOOLS = [
  {
    slug: "screenshot-stitch",
    emoji: "🧩",
    title: "截圖貼合",
    desc: "把連續的長截圖（例如 FB 太長的貼文）自動偵測重疊、無縫拼成一張長圖。",
    href: "tools/screenshot-stitch/",
    status: "ready",
  },
  // 之後新增工具就在這裡加一筆 ↑
];
