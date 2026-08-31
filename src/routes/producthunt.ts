import type { ListItem, RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { parseRSS } from "../utils/parseRSS.js";
import { load } from "cheerio";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "producthunt",
    title: "Product Hunt",
    type: "Today",
    description: "The best new products, every day",
    link: "https://www.producthunt.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

const getList = async (noCache: boolean) => {
  // 官网页面被 Cloudflare 拦截（ 403 ），改用官方 Atom feed
  const url = "https://www.producthunt.com/feed";
  const result = await get<string>({
    url,
    noCache,
    timeout: 15000,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/atom+xml, application/xml, text/xml, */*",
      Referer: "https://www.producthunt.com/",
    },
  });

  const xml = typeof result.data === "string" ? result.data : "";
  const items = await parseRSS(xml);
  const list = items
    .map((item, index) => {
      const link = item.link || "";
      // 提取纯文本正文，剔除 "Discussion | Link" 等 HTML 噪音
      const html = item.content || item.contentSnippet || "";
      const desc = load(html).text().trim() || "";
      return {
        id: item.guid || link || index,
        title: item.title || "",
        desc: desc || undefined,
        author: item.author,
        timestamp: item.pubDate ? new Date(item.pubDate).getTime() : undefined,
        hot: undefined,
        url: link,
        mobileUrl: link,
      } satisfies ListItem;
    })
    .filter((v) => v.title && v.url);

  if (!list.length) {
    logger.warn("⚠️ [WARN] Product Hunt 数据为空，feed 结构可能已变化");
  }

  return {
    ...result,
    data: list,
  };
};
