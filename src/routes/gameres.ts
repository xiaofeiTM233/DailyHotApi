import type { ListItem, RouterData } from "../types.js";
import { load } from "cheerio";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);

  const routeData: RouterData = {
    name: "gameres",
    title: "GameRes 游资网",
    type: "最新资讯",
    description:
      "面向游戏从业者的游戏开发资讯，旨在为游戏制作人提供游戏研发类的程序技术、策划设计、艺术设计、原创设计等资讯内容。",
    link: "https://www.gameres.com",
    total: listData.data?.length || 0,
    ...listData,
  };

  return routeData;
};

const getList = async (noCache: boolean) => {
  const url = `https://www.gameres.com`;
  const result = await get<string>({
    url,
    noCache,
    // 页面较大且加载缓慢，放宽超时
    timeout: 20000,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.gameres.com/",
    },
  });
  const html = typeof result.data === "string" ? result.data : "";
  const $ = load(html);

  // 页面已移除 data-news-pane-id 容器，直接选取文章节点
  const listDom = $("article.feed-item");

  const listData = Array.from(listDom).map((el) => {
    const dom = $(el);

    const titleEl = dom.find(".feed-item-title-a").first();
    const title = titleEl.text().trim();

    const href = titleEl.attr("href");
    const url = href?.startsWith("http") ? href : `https://www.gameres.com${href ?? ""}`;

    const cover = dom.find(".thumb").attr("data-original") || "";
    const desc = dom.find(".feed-item-right > p").first().text().trim();

    const dateTime = dom.find(".mark-info").contents().first().text().trim();
    const timestamp = getTime(dateTime);

    // 热度（列表暂无评论数）
    const hot = undefined;

    return {
      title,
      desc,
      cover,
      timestamp,
      hot,
      url,
      id: url,
      mobileUrl: url,
    } satisfies ListItem;
  });

  if (!listData.length) {
    logger.warn("⚠️ [WARN] GameRes 游资网未解析到条目，页面结构可能已变化");
  }

  return {
    ...result,
    data: listData,
  };
};
